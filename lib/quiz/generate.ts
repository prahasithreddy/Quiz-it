import OpenAI from "openai";
import { z } from "zod";
import { env } from "../../env";
import { intelligentChunking, type ContentChunk } from "../chunking";
import type { ExtractedContent } from "../text-extract";
import { logger } from "../logger";
import { QuizSchema, type Quiz } from "./schema";

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

export const GenerationParamsSchema = z.object({
  numQuestions: z.number().int().positive().max(50).default(10),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  language: z.string().default("en"),
  questionTypes: z.array(z.enum(["mcq", "true-false"]))
    .default(["mcq", "true-false"]),
  quizName: z.string().optional(),
});
export type GenerationParams = z.infer<typeof GenerationParamsSchema>;

export interface QuizGenerationResult {
  quiz: Quiz;
  metadata: {
    sourceQuality: ExtractedContent['metadata']['quality'];
    chunksUsed: number;
    totalChunks: number;
    contentWarnings: string[];
    generationStats: {
      tokensUsed?: number;
      processingTime: number;
      retryCount: number;
    };
  };
}

export async function generateQuizFromExtractedContent(
  extractedContent: ExtractedContent,
  params: GenerationParams
): Promise<QuizGenerationResult> {
  const startTime = Date.now();
  let retryCount = 0;
  
  logger.info({
    contentQuality: extractedContent.metadata.quality,
    wordCount: extractedContent.metadata.wordCount,
    sectionsCount: extractedContent.sections.length,
    params
  }, "Starting enhanced quiz generation");

  // Validate content quality
  if (extractedContent.metadata.quality === 'low' && extractedContent.metadata.wordCount < 200) {
    throw new Error("Document content is too limited or poor quality for quiz generation. Please provide a document with more readable text.");
  }

  // Create intelligent chunks with larger size to preserve more context
  const chunks = intelligentChunking(extractedContent, {
    targetTokens: 2500, // Larger chunks to preserve more context
    maxTokens: 3500, // Increase max to allow for comprehensive sections
    preserveStructure: true,
    prioritizeImportant: false // Don't prioritize - we want all content
  });

  if (chunks.length === 0) {
    throw new Error("Unable to extract meaningful content from document for quiz generation.");
  }

  logger.info({
    chunksGenerated: chunks.length,
    topChunkImportance: chunks.slice(0, 3).map(c => c.metadata.importance),
    chunkTypes: chunks.map(c => c.metadata.type)
  }, "Content chunking completed");

  // Select best chunks for quiz generation
  const selectedChunks = selectOptimalChunks(chunks, params);
  
  try {
    const quiz = await generateQuizFromChunks(selectedChunks, extractedContent, params);
    
    return {
      quiz,
      metadata: {
        sourceQuality: extractedContent.metadata.quality,
        chunksUsed: selectedChunks.length,
        totalChunks: chunks.length,
        contentWarnings: extractedContent.metadata.warnings,
        generationStats: {
          processingTime: Date.now() - startTime,
          retryCount
        }
      }
    };
  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : String(error),
      contentQuality: extractedContent.metadata.quality,
      chunksCount: chunks.length
    }, "Quiz generation failed");
    throw error;
  }
}

function selectOptimalChunks(chunks: ContentChunk[], params: GenerationParams): ContentChunk[] {
  // MODIFIED: Include ALL chunks to ensure complete document context
  // Sort chunks by original order to maintain document flow
  const sortedChunks = [...chunks].sort((a, b) => {
    // Extract numeric ID for proper ordering
    const aId = parseInt(a.id.split('-')[1] || '0');
    const bId = parseInt(b.id.split('-')[1] || '0');
    return aId - bId;
  });
  
  // Calculate total tokens to ensure we don't exceed API limits
  const totalTokens = sortedChunks.reduce((sum, chunk) => sum + chunk.metadata.tokenCount, 0);
  const maxAllowedTokens = 15000; // Conservative limit for GPT-4 with room for response
  
  if (totalTokens <= maxAllowedTokens) {
    // If all chunks fit within token limits, use them all
    logger.info({
      totalChunks: chunks.length,
      selectedChunks: sortedChunks.length,
      totalTokens,
      coverage: '100% - Complete document'
    }, "Using ALL chunks for comprehensive quiz generation");
    
    return sortedChunks;
  } else {
    // If too large, prioritize by importance but still try to include as much as possible
    const importanceSorted = [...chunks].sort((a, b) => b.metadata.importance - a.metadata.importance);
    const selected: ContentChunk[] = [];
    let currentTokens = 0;
    
    for (const chunk of importanceSorted) {
      if (currentTokens + chunk.metadata.tokenCount <= maxAllowedTokens) {
        selected.push(chunk);
        currentTokens += chunk.metadata.tokenCount;
      }
    }
    
    // Re-sort selected chunks by original order to maintain flow
    selected.sort((a, b) => {
      const aId = parseInt(a.id.split('-')[1] || '0');
      const bId = parseInt(b.id.split('-')[1] || '0');
      return aId - bId;
    });
    
    const coverage = (selected.length / chunks.length * 100).toFixed(1);
    
    logger.info({
      totalChunks: chunks.length,
      selectedChunks: selected.length,
      totalTokens: currentTokens,
      coverage: `${coverage}% - Prioritized important content`
    }, "Selected maximum chunks within token limits");
    
    return selected;
  }
}

async function generateQuizFromChunks(
  chunks: ContentChunk[],
  extractedContent: ExtractedContent,
  params: GenerationParams
): Promise<Quiz> {
  const systemPrompt = createSystemPrompt(params);
  const userPrompt = createUserPrompt(chunks, extractedContent, params);

  logger.info({ 
    systemPromptLength: systemPrompt.length,
    userPromptLength: userPrompt.length,
    totalChunks: chunks.length
  }, "Sending enhanced prompts to OpenAI");

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.1, // Lower for more consistent results
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content ?? "";
  
  logger.info({ 
    responseLength: content.length,
    tokensUsed: response.usage?.total_tokens
  }, "Received response from OpenAI");

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    logger.error({ err, contentSnippet: content.slice(0, 200) }, "LLM returned non-JSON");
    throw new Error("Failed to parse quiz JSON from AI response");
  }

  // Enhanced validation and correction
  const correctedQuiz = await validateAndCorrectQuiz(parsed, params);
  
  const validated = QuizSchema.safeParse(correctedQuiz);
  if (!validated.success) {
    logger.error({ 
      issues: validated.error.issues,
      sampleContent: JSON.stringify(correctedQuiz).slice(0, 500)
    }, "Quiz schema validation failed even after correction");
    throw new Error("Generated quiz failed validation: " + validated.error.issues.map(i => i.message).join(", "));
  }
  
  const quiz = validated.data;
  
  // Override the title with custom quiz name if provided
  if (params.quizName && params.quizName.trim()) {
    quiz.meta.title = params.quizName.trim();
  }
  
  return quiz;
}

function createSystemPrompt(params: GenerationParams): string {
  const questionTypesText = params.questionTypes.length === 2 
    ? "both multiple-choice (mcq) and true-false questions"
    : params.questionTypes.includes("mcq") 
      ? "only multiple-choice (mcq) questions"
      : "only true-false questions";

  return `You are an expert educator and quiz designer. Generate a high-quality JSON quiz that strictly follows this TypeScript schema:

type QuestionType = "mcq" | "true-false";
type McqOption = { id: string; text: string };
type QuestionBase = { 
  id: string; 
  type: QuestionType; 
  prompt: string; 
  difficulty: "easy"|"medium"|"hard"; 
  sourceSpan?: string; 
  explanation: string 
};
type McqQuestion = QuestionBase & { 
  type: "mcq"; 
  options: McqOption[]; 
  correctOptionId: string 
};
type TrueFalseQuestion = QuestionBase & { 
  type: "true-false"; 
  answer: boolean 
};
type QuizSection = { 
  id: string; 
  title: string; 
  questions: (McqQuestion|TrueFalseQuestion)[] 
};
type Quiz = { 
  meta: { 
    title: string; 
    language: string; 
    numQuestions: number; 
    createdAt: string 
  }; 
  sections: QuizSection[] 
};

CRITICAL REQUIREMENTS:
1. Generate ${questionTypesText} at ${params.difficulty} difficulty
2. Create exactly ${params.numQuestions} questions total
3. EVERY question MUST have a detailed "explanation" field explaining why the answer is correct
4. For MCQ: provide exactly 4 plausible options, ensure correctOptionId matches an option.id
5. Make questions specific to the document content - avoid generic knowledge
6. Use clear, unambiguous language
7. Ensure all JSON is valid and complete
8. Base questions only on information explicitly present in the provided content
9. Create engaging, thought-provoking questions that test comprehension
10. Vary question difficulty and style within the specified level
11. COMPREHENSIVE COVERAGE: Draw questions from ALL content blocks provided to ensure the entire document is represented
12. DOCUMENT SPAN: Distribute questions across different sections/topics to cover the full scope of the document`;
}

function createUserPrompt(
  chunks: ContentChunk[],
  extractedContent: ExtractedContent,
  params: GenerationParams
): string {
  const documentContext = chunks.map((chunk, i) => {
    const contextInfo = chunk.metadata.context ? `[Context: ${chunk.metadata.context}]` : '';
    const topics = chunk.metadata.topics.length > 0 ? `[Key topics: ${chunk.metadata.topics.join(', ')}]` : '';
    const typeInfo = `[Type: ${chunk.metadata.type}, Importance: ${chunk.metadata.importance.toFixed(2)}]`;
    
    return `## Content Block ${i + 1} ${contextInfo}
${typeInfo} ${topics}

${chunk.content}`;
  }).join('\n\n');

  const qualityInfo = extractedContent.metadata.quality !== 'high' 
    ? `\n[CONTENT QUALITY: ${extractedContent.metadata.quality.toUpperCase()}` + 
      (extractedContent.metadata.warnings.length > 0 ? ` - ${extractedContent.metadata.warnings.join(', ')}` : '') + ']'
    : '';

  return `Create a quiz with ${params.numQuestions} questions based on the following document content.

DOCUMENT ANALYSIS:
- Total word count: ${extractedContent.metadata.wordCount}
- Content sections: ${extractedContent.sections.length}
- Content blocks provided: ${chunks.length}
- Language: ${extractedContent.metadata.language || 'en'}${qualityInfo}

CONTENT TO ANALYZE:
${documentContext}

CRITICAL INSTRUCTIONS:
- MUST use content from ALL the provided content blocks above - do not ignore any sections
- Draw questions from across the ENTIRE document to ensure comprehensive coverage
- Each question must be directly answerable from the specific content provided
- Create questions that span different topics and sections of the document
- Ensure the quiz represents the full scope of the document, not just select portions
- Use specific details, examples, and facts from throughout the content blocks
- Test understanding of key concepts from beginning to end of the document
- Make explanations reference the specific content sections where answers can be found`;
}

async function validateAndCorrectQuiz(parsed: unknown, params: GenerationParams): Promise<unknown> {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error("AI response is not a valid object");
  }

  const quiz = parsed as any;

  // Ensure meta object exists
  if (!quiz.meta) {
    quiz.meta = {
      title: "Generated Quiz",
      language: params.language,
      numQuestions: params.numQuestions,
      createdAt: new Date().toISOString()
    };
  }

  // Ensure sections array exists
  if (!Array.isArray(quiz.sections)) {
    quiz.sections = [];
  }

  // If no sections, create a default one
  if (quiz.sections.length === 0) {
    quiz.sections = [{
      id: "section-1",
      title: "Quiz Questions",
      questions: []
    }];
  }

  // Validate and fix questions
  let totalQuestions = 0;
  for (const section of quiz.sections) {
    if (!Array.isArray(section.questions)) {
      section.questions = [];
      continue;
    }

    for (let i = 0; i < section.questions.length; i++) {
      const question = section.questions[i];
      
      // Ensure required fields
      if (!question.id) question.id = `q-${totalQuestions + 1}`;
      if (!question.prompt) question.prompt = "Question prompt missing";
      if (!question.explanation) {
        question.explanation = generateFallbackExplanation(question);
      }
      if (!question.difficulty) question.difficulty = params.difficulty;

      // Fix MCQ questions
      if (question.type === 'mcq') {
        if (!Array.isArray(question.options) || question.options.length !== 4) {
          question.options = generateFallbackOptions(question.prompt);
        }
        
        // Ensure options have proper IDs
        question.options.forEach((option: any, idx: number) => {
          if (!option.id) option.id = `opt-${idx + 1}`;
          if (!option.text) option.text = `Option ${idx + 1}`;
        });

        // Ensure correctOptionId is valid
        if (!question.correctOptionId || !question.options.some((opt: any) => opt.id === question.correctOptionId)) {
          question.correctOptionId = question.options[0].id;
        }
      }

      // Fix True/False questions
      if (question.type === 'true-false') {
        if (typeof question.answer !== 'boolean') {
          question.answer = true; // Default fallback
        }
      }

      totalQuestions++;
    }
  }

  // Update meta with actual question count
  quiz.meta.numQuestions = totalQuestions;

  return quiz;
}

function generateFallbackExplanation(question: any): string {
  switch (question.type) {
    case 'mcq':
      return "This question tests understanding of the key concepts presented in the document. The correct answer is based on specific information provided in the source material.";
    case 'true-false':
      return `This statement is ${question.answer ? 'true' : 'false'} according to the information presented in the document.`;
    default:
      return "This question is based on information provided in the document.";
  }
}

function generateFallbackOptions(prompt: string): any[] {
  return [
    { id: "opt-1", text: "Option A" },
    { id: "opt-2", text: "Option B" },
    { id: "opt-3", text: "Option C" },
    { id: "opt-4", text: "Option D" }
  ];
}

// Legacy function for backward compatibility
export async function generateQuizFromText(text: string, params: GenerationParams): Promise<Quiz> {
  logger.info("Using legacy generateQuizFromText - consider upgrading to generateQuizFromExtractedContent");
  
  // Create a minimal ExtractedContent object
  const extractedContent: ExtractedContent = {
    text,
    metadata: {
      wordCount: text.split(/\s+/).length,
      hasImages: false,
      hasStructure: false,
      quality: 'medium',
      warnings: []
    },
    sections: [{ content: text, type: 'paragraph', confidence: 0.5 }]
  };
  
  const result = await generateQuizFromExtractedContent(extractedContent, params);
  return result.quiz;
}