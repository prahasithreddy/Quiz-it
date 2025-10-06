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

    // Generate session ID and calculate expiration
    const sessionId = generateSessionId();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + emailData.settings.validityHours * 60 * 60 * 1000);

    // Create quiz session
    const session = {
      id: sessionId,
      quizData,
      recipientEmail: emailData.recipientEmail,
      recipientName: emailData.recipientName,
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
    };

    // Store the session
    quizSessionStore.create(session);

    // Generate quiz link
    const quizLink = `${env.BASE_URL}/quiz/take/${sessionId}`;

    // Generate email content
    const emailTemplate = generateQuizEmailTemplate({
      recipientName: emailData.recipientName,
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
      to: emailData.recipientEmail,
      subject: session.subject,
      html: emailTemplate.html,
      text: emailTemplate.text,
    });

    if (!emailSent) {
      logger.error({ sessionId, recipientEmail: emailData.recipientEmail }, "Failed to send quiz email");
      return Response.json({ error: "Failed to send email" }, { status: 500 });
    }

    logger.info({ 
      sessionId, 
      recipientEmail: emailData.recipientEmail,
      validityHours: emailData.settings.validityHours,
      expiresAt: expiresAt.toISOString()
    }, "Quiz session created and email sent successfully");

    return Response.json({ 
      success: true, 
      sessionId,
      expiresAt: expiresAt.toISOString(),
      quizLink // Return for development/testing purposes
    });

  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : String(error) }, "Quiz share request failed");
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

