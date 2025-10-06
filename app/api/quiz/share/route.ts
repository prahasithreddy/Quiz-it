import { NextRequest } from "next/server";
import { z } from "zod";
import { CreateQuizSessionSchema } from "../../../../lib/quiz/session-schema";
import { quizSessionStore, generateSessionId } from "../../../../lib/quiz/session-store";
import { sendEmail, generateQuizEmailTemplate } from "../../../../lib/email";
import { env } from "../../../../env";
import { logger } from "../../../../lib/logger";
import { allowRequest } from "../../../../lib/rate-limit";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  quizData: z.any(), // The generated quiz object
  emailData: CreateQuizSessionSchema,
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  logger.info({ ip }, "Starting quiz share request");

  // Rate limiting
  const rate = await allowRequest(`quiz-share:${ip}`, 5, 300_000); // 5 requests per 5 minutes
  if (!rate.success) {
    logger.warn({ ip, rate }, "Rate limit exceeded for quiz sharing");
    return Response.json({ error: "Too many requests" }, { 
      status: 429, 
      headers: { "Retry-After": Math.ceil((rate.reset - Date.now()) / 1000).toString() } 
    });
  }

  try {
    const body = await req.json();
    const parsed = requestSchema.safeParse(body);
    
    if (!parsed.success) {
      logger.warn({ issues: parsed.error.issues }, "Invalid quiz share request");
      return Response.json({ error: "Invalid request data", details: parsed.error.issues }, { status: 400 });
    }

    const { quizData, emailData } = parsed.data;

    // Generate unique quiz ID to group all sessions for this quiz
    const quizId = `quiz_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + emailData.settings.validityHours * 60 * 60 * 1000);
    
    const createdSessions: string[] = [];
    const failedEmails: string[] = [];
    
    // Create a session for each recipient
    for (const recipientEmail of emailData.recipientEmails) {
      const sessionId = generateSessionId();
      
      // Create quiz session
      const session = {
        id: sessionId,
        quizId,
        quizData,
        recipientEmail,
        recipientName: undefined, // We removed this field from the form
        senderName: emailData.senderName,
        subject: emailData.subject || `Quiz: ${quizData.meta?.title || 'Untitled Quiz'}`,
        message: emailData.message,
        settings: emailData.settings,
        createdAt: now,
        expiresAt,
        isStarted: false,
        startedAt: undefined,
        isCompleted: false,
        completedAt: undefined,
        currentQuestionIndex: 0,
        answers: [],
        score: undefined,
      };

      // Store the session
      quizSessionStore.create(session);

      // Generate quiz link
      const quizLink = `${env.BASE_URL}/quizit/quiz/take/${sessionId}`;

      // Generate email content
      const emailTemplate = generateQuizEmailTemplate({
        recipientName: undefined,
        senderName: emailData.senderName,
        subject: session.subject,
        message: emailData.message,
        quizTitle: quizData.meta?.title || 'Untitled Quiz',
        quizLink,
        validityHours: emailData.settings.validityHours,
        timePerQuestion: emailData.settings.timePerQuestionSeconds,
      });

      // Send email
      const emailSent = await sendEmail({
        to: recipientEmail,
        subject: session.subject,
        html: emailTemplate.html,
        text: emailTemplate.text,
      });

      if (emailSent) {
        createdSessions.push(sessionId);
        logger.info({ 
          sessionId, 
          quizId,
          recipientEmail,
          validityHours: emailData.settings.validityHours,
          expiresAt: expiresAt.toISOString()
        }, "Quiz session created and email sent successfully");
      } else {
        failedEmails.push(recipientEmail);
        logger.error({ sessionId, recipientEmail }, "Failed to send quiz email");
      }
    }

    // Return results
    if (createdSessions.length === 0) {
      return Response.json({ error: "Failed to send any quiz invites" }, { status: 500 });
    }

    if (failedEmails.length > 0) {
      logger.warn({ failedEmails, createdSessions }, "Some emails failed to send");
    }

    return Response.json({ 
      success: true, 
      quizId,
      sessionIds: createdSessions,
      failedEmails,
      totalSent: createdSessions.length,
      expiresAt: expiresAt.toISOString(),
    });

  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : String(error) }, "Quiz share request failed");
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

