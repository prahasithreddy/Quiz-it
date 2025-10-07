import { z } from "zod";

export const QuestionTypeEnum = z.enum(["mcq", "true-false"]);
export const GenerationQuestionTypeEnum = z.enum(["mcq", "true-false", "both"]);

export const McqOptionSchema = z.object({
  id: z.string().min(1, "Option ID cannot be empty"),
  text: z.string().min(1, "Option text cannot be empty").max(200, "Option text should be concise"),
});

export const QuestionBaseSchema = z.object({
  id: z.string(),
  type: QuestionTypeEnum,
  prompt: z.string().min(1),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  sourceSpan: z.string().optional(),
  explanation: z.string().min(1),
});

export const McqQuestionSchema = QuestionBaseSchema.extend({
  type: z.literal("mcq"),
  options: z.array(McqOptionSchema).length(4, "MCQ questions must have exactly 4 options"),
  correctOptionId: z.string(),
}).refine(
  (data) => data.options.some(option => option.id === data.correctOptionId),
  {
    message: "correctOptionId must match one of the option IDs",
    path: ["correctOptionId"],
  }
);

export const TrueFalseQuestionSchema = QuestionBaseSchema.extend({
  type: z.literal("true-false"),
  answer: z.boolean(),
});

export const AnyQuestionSchema = z.discriminatedUnion("type", [
  McqQuestionSchema,
  TrueFalseQuestionSchema,
]);

export const QuizSectionSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  questions: z.array(AnyQuestionSchema).min(1),
});

export const QuizMetaSchema = z.object({
  title: z.string().min(1),
  language: z.string().default("en"),
  numQuestions: z.number().int().positive(),
  createdAt: z.string(),
});

export const QuizSchema = z.object({
  meta: QuizMetaSchema,
  sections: z.array(QuizSectionSchema).min(1),
});

export type QuestionType = z.infer<typeof QuestionTypeEnum>;
export type Quiz = z.infer<typeof QuizSchema>;


