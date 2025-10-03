import { NextRequest } from "next/server";
import { z } from "zod";
import { allowRequest } from "../../../lib/rate-limit";
import { logger } from "../../../lib/logger";
import { arrayBufferFromReadable, extractTextFromDocx, extractTextFromPdf, normalizeText } from "../../../lib/text-extract";
import { generateQuizFromText, GenerationParamsSchema } from "../../../lib/quiz/generate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const formSchema = z.object({
  numQuestions: z.coerce.number().int().positive().max(50).default(10),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  language: z.string().default("en"),
  questionTypes: z.array(z.enum(["mcq", "true-false", "short-answer"]))
    .default(["mcq", "true-false", "short-answer"]),
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  logger.info({ ip }, "Starting quiz generation request");

  const rate = await allowRequest(`ingest:${ip}`, 10, 60_000);
  if (!rate.success) {
    logger.warn({ ip, rate }, "Rate limit exceeded");
    return Response.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": Math.ceil((rate.reset - Date.now()) / 1000).toString() } });
  }

  const ctype = req.headers.get("content-type") || "";
  logger.debug({ contentType: ctype }, "Checking content type");
  if (!ctype.includes("multipart/form-data")) {
    logger.warn({ contentType: ctype }, "Invalid content type");
    return Response.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    logger.warn("No file provided in request");
    return Response.json({ error: "File is required" }, { status: 400 });
  }

  const numQuestions = form.get("numQuestions");
  const difficulty = form.get("difficulty");
  const language = form.get("language");
  const qTypes = form.getAll("questionTypes");

  logger.info({ 
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type,
    numQuestions,
    difficulty,
    language,
    questionTypes: qTypes
  }, "Processing file upload");

  const parsed = formSchema.safeParse({
    numQuestions,
    difficulty,
    language,
    questionTypes: qTypes.length ? qTypes : undefined,
  });
  if (!parsed.success) {
    logger.warn({ 
      validationErrors: parsed.error.issues,
      providedData: { numQuestions, difficulty, language, questionTypes: qTypes }
    }, "Form validation failed");
    return Response.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }

  const mime = file.type;
  const size = file.size;
  logger.debug({ mime, size, fileName: file.name }, "File details");
  
  if (size > 20 * 1024 * 1024) {
    logger.warn({ size, fileName: file.name }, "File too large");
    return Response.json({ error: "File too large" }, { status: 413 });
  }

  let text = "";
  try {
    logger.info({ fileName: file.name, mime }, "Starting text extraction");
    const arrayBuffer = await file.arrayBuffer();
    logger.debug({ 
      arrayBufferSize: arrayBuffer.byteLength,
      fileName: file.name 
    }, "File converted to ArrayBuffer");

    if (mime === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      logger.info({ fileName: file.name }, "Extracting text from PDF");
      text = await extractTextFromPdf(arrayBuffer);
    } else if (
      mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      file.name.toLowerCase().endsWith(".docx")
    ) {
      logger.info({ fileName: file.name }, "Extracting text from DOCX");
      text = await extractTextFromDocx(arrayBuffer);
    } else {
      logger.warn({ mime, fileName: file.name }, "Unsupported file type");
      return Response.json({ error: "Unsupported media type" }, { status: 415 });
    }

    logger.info({ 
      extractedTextLength: text.length,
      fileName: file.name 
    }, "Text extraction completed");
  } catch (err) {
    logger.error({ 
      err: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      fileName: file.name,
      mime 
    }, "Text extraction failed");
    return Response.json({ error: "Failed to extract text" }, { status: 500 });
  }

  logger.info({ 
    originalTextLength: text.length,
    fileName: file.name 
  }, "Starting text normalization");

  const cleaned = normalizeText(text);
  logger.info({ 
    originalLength: text.length,
    cleanedLength: cleaned.length,
    fileName: file.name 
  }, "Text normalization completed");

  if (!cleaned || cleaned.length < 20) {
    logger.warn({ 
      cleanedLength: cleaned.length,
      fileName: file.name 
    }, "Document appears empty after processing");
    return Response.json({ error: "Document appears empty" }, { status: 400 });
  }

  try {
    logger.info({ 
      cleanedTextLength: cleaned.length,
      params: parsed.data,
      fileName: file.name 
    }, "Starting quiz generation");

    const params = GenerationParamsSchema.parse(parsed.data);
    logger.debug({ params }, "Quiz generation parameters validated");

    const quiz = await generateQuizFromText(cleaned, params);
    const totalQuestions = quiz.sections.reduce((sum, section) => sum + section.questions.length, 0);
    logger.info({ 
      numQuestions: params.numQuestions, 
      language: params.language,
      difficulty: params.difficulty,
      questionTypes: params.questionTypes,
      fileName: file.name,
      quizQuestionsGenerated: totalQuestions,
      sectionsGenerated: quiz.sections.length
    }, "Quiz generation completed successfully");
    
    return Response.json(quiz, { status: 200 });
  } catch (err) {
    logger.error({ 
      err: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      fileName: file.name,
      params: parsed.data
    }, "Quiz generation failed");
    return Response.json({ error: "Failed to generate quiz" }, { status: 500 });
  }
}


