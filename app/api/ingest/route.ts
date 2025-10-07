import { NextRequest } from "next/server";
import { z } from "zod";
import { allowRequest } from "../../../lib/rate-limit";
import { logger } from "../../../lib/logger";
import { 
  extractTextFromDocx, 
  extractTextFromPdf, 
  type ExtractedContent 
} from "../../../lib/text-extract";
import { 
  generateQuizFromExtractedContent, 
  GenerationParamsSchema,
  type QuizGenerationResult 
} from "../../../lib/quiz/generate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const formSchema = z.object({
  numQuestions: z.coerce.number().int().positive().max(50).default(10),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  language: z.string().default("en"),
  questionTypes: z.array(z.enum(["mcq", "true-false"]))
    .default(["mcq", "true-false"]),
  quizName: z.string().optional(),
});

interface ProcessingResult {
  success: boolean;
  extractedContent?: ExtractedContent;
  error?: string;
  warnings?: string[];
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const startTime = Date.now();
  
  logger.info({ ip }, "Starting enhanced quiz generation request");

  const rate = await allowRequest(`ingest:${ip}`, 10, 60_000);
  if (!rate.success) {
    logger.warn({ ip, rate }, "Rate limit exceeded");
    return Response.json(
      { error: "Too many requests" }, 
      { 
        status: 429, 
        headers: { "Retry-After": Math.ceil((rate.reset - Date.now()) / 1000).toString() } 
      }
    );
  }

  const ctype = req.headers.get("content-type") || "";
  if (!ctype.includes("multipart/form-data")) {
    logger.warn({ contentType: ctype }, "Invalid content type");
    return Response.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  // Parse form data
  let form: FormData;
  try {
    form = await req.formData();
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : String(error) }, "Failed to parse form data");
    return Response.json({ error: "Invalid form data" }, { status: 400 });
  }

  // Validate file
  const file = form.get("file");
  if (!(file instanceof File)) {
    logger.warn("No file provided in request");
    return Response.json({ error: "File is required" }, { status: 400 });
  }

  if (file.size > 20 * 1024 * 1024) {
    logger.warn({ size: file.size, fileName: file.name }, "File too large");
    return Response.json({ error: "File too large (max 20MB)" }, { status: 413 });
  }

  // Parse and validate parameters
  const numQuestions = form.get("numQuestions");
  const difficulty = form.get("difficulty");
  const language = form.get("language");
  const qTypes = form.getAll("questionTypes");
  
  // Handle single question type case
  if (qTypes.length === 0) {
    const singleType = form.get("questionTypes");
    if (singleType) {
      qTypes.push(singleType as string);
    }
  }
  
  const quizName = form.get("quizName");

  logger.info({ 
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type,
    numQuestions,
    difficulty,
    language,
    questionTypes: qTypes,
    quizName
  }, "Processing enhanced file upload");

  const parsed = formSchema.safeParse({
    numQuestions,
    difficulty,
    language,
    questionTypes: qTypes.length ? qTypes : undefined,
    quizName: quizName ? (quizName as string) : undefined,
  });

  if (!parsed.success) {
    logger.warn({ 
      validationErrors: parsed.error.issues,
      providedData: { numQuestions, difficulty, language, questionTypes: qTypes }
    }, "Form validation failed");
    return Response.json({ 
      error: "Invalid parameters", 
      details: parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`)
    }, { status: 400 });
  }

  // Extract content from document
  const extractionResult = await extractDocumentContent(file);
  
  if (!extractionResult.success) {
    logger.error({ 
      fileName: file.name,
      error: extractionResult.error 
    }, "Document extraction failed");
    return Response.json({ 
      error: extractionResult.error || "Failed to extract document content"
    }, { status: 400 });
  }

  const extractedContent = extractionResult.extractedContent!;
  
  // Log extraction results
  logger.info({
    fileName: file.name,
    extractedWordCount: extractedContent.metadata.wordCount,
    contentQuality: extractedContent.metadata.quality,
    sectionsFound: extractedContent.sections.length,
    warnings: extractedContent.metadata.warnings,
    extractionTime: Date.now() - startTime
  }, "Document extraction completed");

  // Provide detailed feedback on content quality
  if (extractedContent.metadata.quality === 'low') {
    const qualityIssues = extractedContent.metadata.warnings;
    logger.warn({ fileName: file.name, qualityIssues }, "Low quality content detected");
    
    if (extractedContent.metadata.wordCount < 100) {
      return Response.json({ 
        error: "Document contains insufficient text for quiz generation. Please ensure your document has readable text content (at least 100 words)."
      }, { status: 400 });
    }
  }

  // Generate quiz using enhanced pipeline
  try {
    logger.info({ 
      fileName: file.name,
      params: parsed.data 
    }, "Starting enhanced quiz generation");

    const params = GenerationParamsSchema.parse(parsed.data);
    const result: QuizGenerationResult = await generateQuizFromExtractedContent(extractedContent, params);
    
    const totalQuestions = result.quiz.sections.reduce((sum, section) => sum + section.questions.length, 0);
    const processingTime = Date.now() - startTime;
    
    logger.info({ 
      fileName: file.name,
      requestedQuestions: params.numQuestions, 
      generatedQuestions: totalQuestions,
      sectionsGenerated: result.quiz.sections.length,
      chunksUsed: result.metadata.chunksUsed,
      totalChunks: result.metadata.totalChunks,
      sourceQuality: result.metadata.sourceQuality,
      processingTime,
      language: params.language,
      difficulty: params.difficulty,
      questionTypes: params.questionTypes
    }, "Enhanced quiz generation completed successfully");
    
    // Create response with metadata
    const response = {
      ...result.quiz,
      _metadata: {
        generation: {
          sourceQuality: result.metadata.sourceQuality,
          chunksUsed: result.metadata.chunksUsed,
          totalChunks: result.metadata.totalChunks,
          processingTime,
          contentWarnings: result.metadata.contentWarnings.length > 0 ? result.metadata.contentWarnings : undefined
        }
      }
    };
    
    return Response.json(response, { status: 200 });
    
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error({ 
      error: error.message,
      stack: error.stack,
      fileName: file.name,
      params: parsed.data,
      contentQuality: extractedContent.metadata.quality,
      processingTime: Date.now() - startTime
    }, "Enhanced quiz generation failed");
    
    // Provide more specific error messages
    let errorMessage = "Failed to generate quiz";
    if (error.message.includes("content is too limited")) {
      errorMessage = "The document content is too limited for quiz generation. Please provide a document with more substantial text content.";
    } else if (error.message.includes("validation failed")) {
      errorMessage = "The generated quiz failed quality validation. Please try again or use a different document.";
    } else if (error.message.includes("Unable to extract")) {
      errorMessage = "Unable to extract meaningful content from the document. Please ensure the document contains readable text.";
    }
    
    return Response.json({ error: errorMessage }, { status: 500 });
  }
}

async function extractDocumentContent(file: File): Promise<ProcessingResult> {
  const mime = file.type;
  const fileName = file.name.toLowerCase();
  
  try {
    logger.info({ fileName: file.name, mime }, "Starting enhanced text extraction");
    const arrayBuffer = await file.arrayBuffer();
    
    let extractedContent: ExtractedContent;
    
    if (mime === "application/pdf" || fileName.endsWith(".pdf")) {
      logger.info({ fileName: file.name }, "Extracting enhanced content from PDF");
      extractedContent = await extractTextFromPdf(arrayBuffer);
    } else if (
      mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      fileName.endsWith(".docx")
    ) {
      logger.info({ fileName: file.name }, "Extracting enhanced content from DOCX");
      extractedContent = await extractTextFromDocx(arrayBuffer);
    } else {
      logger.warn({ mime, fileName }, "Unsupported file type");
      return {
        success: false,
        error: "Unsupported file type. Please upload a PDF or DOCX file."
      };
    }

    // Validate extracted content
    if (!extractedContent.text || extractedContent.text.trim().length === 0) {
      return {
        success: false,
        error: "No readable text found in the document. The file may be image-based, scanned, or corrupted.",
        warnings: extractedContent.metadata.warnings
      };
    }

    if (extractedContent.metadata.wordCount < 50) {
      return {
        success: false,
        error: "Document contains too little text (less than 50 words). Please provide a document with more content.",
        warnings: extractedContent.metadata.warnings
      };
    }

    logger.info({
      fileName: file.name,
      wordCount: extractedContent.metadata.wordCount,
      quality: extractedContent.metadata.quality,
      sections: extractedContent.sections.length,
      warnings: extractedContent.metadata.warnings.length
    }, "Enhanced text extraction completed successfully");

    return {
      success: true,
      extractedContent,
      warnings: extractedContent.metadata.warnings
    };

  } catch (error) {
    logger.error({ 
      error: error instanceof Error ? error.message : String(error),
      fileName: file.name,
      mime 
    }, "Enhanced text extraction failed");
    
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to extract text from document"
    };
  }
}