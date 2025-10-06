import { NextRequest } from "next/server";
import { z } from "zod";
import { QuizAnswerSchema } from "../../../../../lib/quiz/session-schema";
import { quizSessionStore, getSessionProgress } from "../../../../../lib/quiz/session-store";
import { logger } from "../../../../../lib/logger";
import { allowRequest } from "../../../../../lib/rate-limit";

export const dynamic = "force-dynamic";

// Helper function to calculate quiz results
function calculateResults(session: any, questions: any[]) {
  const results = {
    totalQuestions: questions.length,
    correctAnswers: 0,
    incorrectAnswers: 0,
    unansweredQuestions: 0,
    score: 0,
    timeSpent: 0,
    questionResults: [] as any[],
  };

  // Create a map of answers for quick lookup
  const answerMap = new Map();
  session.answers.forEach((answer: any) => {
    answerMap.set(answer.questionId, answer);
    results.timeSpent += answer.timeSpentSeconds;
  });

  // Check each question
  questions.forEach((question, index) => {
    const userAnswer = answerMap.get(question.id);
    let isCorrect = false;
    let userAnswerText = "No answer";

    if (userAnswer) {
      if (question.type === 'mcq') {
        isCorrect = userAnswer.answer === question.correctOptionId;
        const selectedOption = question.options?.find((opt: any) => opt.id === userAnswer.answer);
        userAnswerText = selectedOption ? selectedOption.text : "Invalid option";
      } else if (question.type === 'true-false') {
        isCorrect = userAnswer.answer === question.answer;
        userAnswerText = userAnswer.answer ? "True" : "False";
      } else if (question.type === 'short-answer') {
        // For short answer, we'll do a simple case-insensitive comparison
        isCorrect = userAnswer.answer?.toLowerCase().trim() === question.answer?.toLowerCase().trim();
        userAnswerText = userAnswer.answer || "No answer";
      }
    } else {
      results.unansweredQuestions++;
    }

    if (isCorrect) {
      results.correctAnswers++;
    } else if (userAnswer) {
      results.incorrectAnswers++;
    }

    // Get correct answer text
    let correctAnswerText = "";
    if (question.type === 'mcq') {
      const correctOption = question.options?.find((opt: any) => opt.id === question.correctOptionId);
      correctAnswerText = correctOption ? correctOption.text : "Unknown";
    } else if (question.type === 'true-false') {
      correctAnswerText = question.answer ? "True" : "False";
    } else if (question.type === 'short-answer') {
      correctAnswerText = question.answer || "No correct answer set";
    }

    results.questionResults.push({
      questionNumber: index + 1,
      question: question.prompt,
      type: question.type,
      difficulty: question.difficulty,
      userAnswer: userAnswerText,
      correctAnswer: correctAnswerText,
      isCorrect,
      timeSpent: userAnswer?.timeSpentSeconds || 0,
      explanation: question.explanation || "",
    });
  });

  results.score = Math.round((results.correctAnswers / results.totalQuestions) * 100);
  return results;
}

// GET /api/quiz/session/[sessionId] - Get quiz session details
export async function GET(req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await params;
    const url = new URL(req.url);
    const getResults = url.searchParams.get('results') === 'true';
    
    if (!sessionId) {
      return Response.json({ error: "Session ID is required" }, { status: 400 });
    }

    const session = quizSessionStore.get(sessionId);
    if (!session) {
      return Response.json({ error: "Quiz session not found or expired" }, { status: 404 });
    }

    const progress = getSessionProgress(session);
    const questions = quizSessionStore.getQuizQuestions(session);
    const currentQuestion = questions[session.currentQuestionIndex];

    // If requesting results and quiz is completed, return detailed results
    if (getResults && session.isCompleted) {
      const results = calculateResults(session, questions);
      return Response.json({
        session: {
          id: session.id,
          isStarted: session.isStarted,
          isCompleted: session.isCompleted,
          quizTitle: session.quizData.meta?.title || 'Untitled Quiz',
          completedAt: session.completedAt?.toISOString(),
          startedAt: session.startedAt?.toISOString(),
        },
        results,
      });
    }

    return Response.json({
      session: {
        id: session.id,
        isStarted: session.isStarted,
        isCompleted: session.isCompleted,
        currentQuestionIndex: session.currentQuestionIndex,
        settings: session.settings,
        quizTitle: session.quizData.meta?.title || 'Untitled Quiz',
        expiresAt: session.expiresAt.toISOString(),
      },
      progress,
      currentQuestion: currentQuestion ? {
        id: currentQuestion.id,
        type: currentQuestion.type,
        prompt: currentQuestion.prompt,
        difficulty: currentQuestion.difficulty,
        options: currentQuestion.type === 'mcq' ? currentQuestion.options : undefined,
      } : null,
      totalQuestions: progress.totalQuestions,
    });

  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : String(error) }, "Failed to get quiz session");
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/quiz/session/[sessionId] - Start quiz or submit answer
export async function POST(req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  
  // Rate limiting
  const rate = await allowRequest(`quiz-answer:${ip}`, 30, 60_000); // 30 requests per minute
  if (!rate.success) {
    return Response.json({ error: "Too many requests" }, { 
      status: 429, 
      headers: { "Retry-After": Math.ceil((rate.reset - Date.now()) / 1000).toString() } 
    });
  }

  try {
    const { sessionId } = await params;
    const body = await req.json();
    
    if (!sessionId) {
      return Response.json({ error: "Session ID is required" }, { status: 400 });
    }

    const session = quizSessionStore.get(sessionId);
    if (!session) {
      return Response.json({ error: "Quiz session not found or expired" }, { status: 404 });
    }

    // Handle starting the quiz
    if (body.action === "start") {
      if (session.isStarted) {
        return Response.json({ error: "Quiz already started" }, { status: 400 });
      }

      const updatedSession = quizSessionStore.update(sessionId, {
        isStarted: true,
        startedAt: new Date(),
      });

      if (!updatedSession) {
        return Response.json({ error: "Failed to start quiz" }, { status: 500 });
      }

      logger.info({ sessionId }, "Quiz session started");
      return Response.json({ success: true, message: "Quiz started" });
    }

    // Handle submitting an answer
    if (body.action === "answer") {
      const answerData = QuizAnswerSchema.safeParse(body);
      if (!answerData.success) {
        return Response.json({ error: "Invalid answer data", details: answerData.error.issues }, { status: 400 });
      }

      if (!session.isStarted) {
        return Response.json({ error: "Quiz not started" }, { status: 400 });
      }

      if (session.isCompleted) {
        return Response.json({ error: "Quiz already completed" }, { status: 400 });
      }

      const questions = quizSessionStore.getQuizQuestions(session);
      const currentQuestion = questions[session.currentQuestionIndex];

      if (!currentQuestion || currentQuestion.id !== answerData.data.questionId) {
        return Response.json({ error: "Invalid question ID" }, { status: 400 });
      }

      // Add answer to session
      const newAnswer = {
        questionId: answerData.data.questionId,
        answer: answerData.data.answer,
        answeredAt: new Date(),
        timeSpentSeconds: answerData.data.timeSpentSeconds,
      };

      const newAnswers = [...session.answers, newAnswer];
      const nextQuestionIndex = session.currentQuestionIndex + 1;
      const isCompleted = nextQuestionIndex >= questions.length;

      const updatedSession = quizSessionStore.update(sessionId, {
        answers: newAnswers,
        currentQuestionIndex: nextQuestionIndex,
        isCompleted,
        completedAt: isCompleted ? new Date() : undefined,
      });

      if (!updatedSession) {
        return Response.json({ error: "Failed to save answer" }, { status: 500 });
      }

      logger.info({ 
        sessionId, 
        questionId: answerData.data.questionId,
        timeSpent: answerData.data.timeSpentSeconds,
        isCompleted 
      }, "Answer submitted");

      const progress = getSessionProgress(updatedSession);
      const nextQuestion = !isCompleted ? questions[nextQuestionIndex] : null;

      return Response.json({
        success: true,
        isCompleted,
        progress,
        nextQuestion: nextQuestion ? {
          id: nextQuestion.id,
          type: nextQuestion.type,
          prompt: nextQuestion.prompt,
          difficulty: nextQuestion.difficulty,
          options: nextQuestion.type === 'mcq' ? nextQuestion.options : undefined,
        } : null,
      });
    }

    return Response.json({ error: "Invalid action" }, { status: 400 });

  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : String(error) }, "Quiz session request failed");
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
