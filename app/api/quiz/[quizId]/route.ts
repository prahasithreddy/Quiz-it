import { NextRequest } from "next/server";
import { quizSessionStore } from "../../../../lib/quiz/session-store";
import { logger } from "../../../../lib/logger";
import { Quiz } from "../../../../lib/quiz/schema";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{
    quizId: string;
  }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const { quizId } = await params;
  
  logger.info({ ip, quizId }, "Quiz details request");

  try {
    const sessions = quizSessionStore.getSessionsByQuizId(quizId);
    
    if (sessions.length === 0) {
      return Response.json({ error: "Quiz not found" }, { status: 404 });
    }

    // Get quiz metadata from first session
    const firstSession = sessions[0];
    const quiz = firstSession.quizData as Quiz;

    // Calculate scores for completed sessions
    const sessionsWithScores = sessions.map(session => {
      let score: number | undefined;
      
      if (session.isCompleted && session.answers.length > 0) {
        const totalQuestions = quiz.sections.reduce((sum, section) => sum + section.questions.length, 0);
        let correctAnswers = 0;

        // Calculate correct answers
        for (const answer of session.answers) {
          const question = quiz.sections
            .flatMap(section => section.questions)
            .find(q => q.id === answer.questionId);
          
          if (question) {
            let isCorrect = false;
            
            if (question.type === 'mcq') {
              isCorrect = answer.answer === question.correctOptionId;
            } else if (question.type === 'true-false') {
              isCorrect = answer.answer === question.answer;
            } else if (question.type === 'short-answer') {
              // Simple string comparison for short answer (could be improved with fuzzy matching)
              isCorrect = String(answer.answer).toLowerCase().trim() === question.answer.toLowerCase().trim();
            }
            
            if (isCorrect) correctAnswers++;
          }
        }
        
        score = Math.round((correctAnswers / totalQuestions) * 100);
      }

      return {
        id: session.id,
        recipientEmail: session.recipientEmail,
        recipientName: session.recipientName,
        isStarted: session.isStarted,
        startedAt: session.startedAt?.toISOString(),
        isCompleted: session.isCompleted,
        completedAt: session.completedAt?.toISOString(),
        score,
        currentQuestionIndex: session.currentQuestionIndex,
        totalQuestions: quiz.sections.reduce((sum, section) => sum + section.questions.length, 0),
        expiresAt: session.expiresAt.toISOString(),
      };
    });
    
    logger.info({ quizId, sessionCount: sessions.length }, "Retrieved quiz details");
    
    return Response.json({ 
      success: true,
      quiz: {
        id: quizId,
        title: quiz.meta.title,
        numQuestions: quiz.meta.numQuestions,
        createdAt: firstSession.createdAt.toISOString(),
        senderName: firstSession.senderName,
        subject: firstSession.subject,
      },
      sessions: sessionsWithScores
    });

  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : String(error), quizId }, "Quiz details request failed");
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
