import { NextRequest } from "next/server";
import { quizSessionStore } from "../../../../lib/quiz/session-store";
import { logger } from "../../../../lib/logger";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  logger.info({ ip }, "Dashboard request");

  try {
    const quizzes = quizSessionStore.getAllQuizzes();
    
    logger.info({ count: quizzes.length }, "Retrieved quizzes for dashboard");
    
    return Response.json({ 
      success: true,
      quizzes 
    });

  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : String(error) }, "Dashboard request failed");
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
