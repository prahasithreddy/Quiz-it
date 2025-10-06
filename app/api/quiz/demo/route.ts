import { NextRequest } from "next/server";
import { createDemoSession } from "../../../../lib/quiz/create-demo-session";
import { logger } from "../../../../lib/logger";

export const dynamic = "force-dynamic";

// POST /api/quiz/demo - Create a demo quiz session for testing
export async function POST(req: NextRequest) {
  try {
    logger.info("Creating demo quiz session");
    
    const sessionId = createDemoSession();
    const quizLink = `${new URL(req.url).origin}/quiz/take/${sessionId}`;
    
    logger.info({ sessionId, quizLink }, "Demo quiz session created successfully");
    
    return Response.json({ 
      success: true, 
      sessionId,
      quizLink,
      message: "Demo quiz session created! Click the link to start."
    });

  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : String(error) }, "Failed to create demo quiz session");
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

