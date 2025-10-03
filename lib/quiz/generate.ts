import OpenAI from "openai";
import { z } from "zod";
import { env } from "../../env";
import { chunkTextByParagraphs } from "../chunking";
import { logger } from "../logger";
import { QuizSchema, type Quiz } from "./schema";

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

export const GenerationParamsSchema = z.object({
  numQuestions: z.number().int().positive().max(50).default(10),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  language: z.string().default("en"),
  questionTypes: z.array(z.enum(["mcq", "true-false", "short-answer"]))
    .default(["mcq", "true-false", "short-answer"]),
});
export type GenerationParams = z.infer<typeof GenerationParamsSchema>;

export async function generateQuizFromText(text: string, params: GenerationParams): Promise<Quiz> {
  const chunks = chunkTextByParagraphs(text);
  const system = `You are an expert educator. Generate a JSON quiz strictly matching this TypeScript-like schema:\n\n` +
    `type QuestionType = "mcq" | "true-false" | "short-answer";\n` +
    `type McqOption = { id: string; text: string };\n` +
    `type QuestionBase = { id: string; type: QuestionType; prompt: string; difficulty: "easy"|"medium"|"hard"; sourceSpan?: string; explanation: string };\n` +
    `type McqQuestion = QuestionBase & { type: "mcq"; options: McqOption[]; correctOptionId: string };\n` +
    `type TrueFalseQuestion = QuestionBase & { type: "true-false"; answer: boolean };\n` +
    `type ShortAnswerQuestion = QuestionBase & { type: "short-answer"; answer: string };\n` +
    `type QuizSection = { id: string; title: string; questions: (McqQuestion|TrueFalseQuestion|ShortAnswerQuestion)[] };\n` +
    `type Quiz = { meta: { title: string; language: string; numQuestions: number; createdAt: string }; sections: QuizSection[] };\n\n` +
    `CRITICAL MCQ OPTIONS REQUIREMENTS:\n` +
    `- Always provide exactly 4 options for MCQ questions\n` +
    `- Each option must be plausible and related to the question\n` +
    `- Options should be distinct and not overlap in meaning\n` +
    `- Avoid obviously wrong options (like "All of the above" or "None of the above")\n` +
    `- Use clear, concise language for each option\n` +
    `- Ensure the correct answer is not obviously longer or shorter than distractors\n` +
    `- Make distractors believable but definitively incorrect\n\n` +
    `Rules: Use only information from the document. Provide explanations and sourceSpan. Ensure valid JSON and non-empty fields.`;

  const user = `Create about ${params.numQuestions} questions at ${params.difficulty} difficulty in ${params.language}.`;
  const context = chunks.slice(0, 6).map((c, i) => `# Chunk ${i + 1}\n${c}`).join("\n\n");

  const prompt = `${user}\n\nDocument Context (selected chunks):\n${context}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini", // cost-efficient
    temperature: 0.2,
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content ?? "";
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    logger.error({ err, contentSnippet: content.slice(0, 200) }, "LLM returned non-JSON");
    throw new Error("Failed to parse quiz JSON");
  }

  const validated = QuizSchema.safeParse(parsed);
  if (!validated.success) {
    logger.error({ issues: validated.error.issues }, "Quiz schema validation failed");
    throw new Error("Quiz validation failed");
  }
  return validated.data;
}


