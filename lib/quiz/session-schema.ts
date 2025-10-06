import { z } from "zod";

// Schema for quiz session settings
export const QuizSessionSettingsSchema = z.object({
  validityHours: z.number().min(1).max(168).default(48), // 1 hour to 1 week
  timePerQuestionSeconds: z.number().min(10).max(300).default(30), // 10 seconds to 5 minutes
  allowBackTracking: z.boolean().default(false),
  showExplanations: z.boolean().default(true),
  randomizeQuestionOrder: z.boolean().default(false),
});

// Schema for creating a quiz session
export const CreateQuizSessionSchema = z.object({
  recipientEmail: z.string().email("Please enter a valid email address"),
  recipientName: z.string().min(1, "Recipient name is required").optional(),
  senderName: z.string().min(1, "Your name is required").optional(),
  subject: z.string().min(1, "Subject is required").optional(),
  message: z.string().optional(),
  settings: QuizSessionSettingsSchema,
});

// Schema for quiz session stored in database/memory
export const QuizSessionSchema = z.object({
  id: z.string(),
  quizData: z.any(), // The generated quiz object
  recipientEmail: z.string().email(),
  recipientName: z.string().optional(),
  senderName: z.string().optional(),
  subject: z.string().optional(),
  message: z.string().optional(),
  settings: QuizSessionSettingsSchema,
  createdAt: z.date(),
  expiresAt: z.date(),
  isStarted: z.boolean().default(false),
  startedAt: z.date().optional(),
  isCompleted: z.boolean().default(false),
  completedAt: z.date().optional(),
  currentQuestionIndex: z.number().default(0),
  answers: z.array(z.object({
    questionId: z.string(),
    answer: z.union([z.string(), z.boolean()]), // MCQ option ID, short answer text, or boolean for T/F
    answeredAt: z.date(),
    timeSpentSeconds: z.number(),
  })).default([]),
});

// Schema for taking quiz session
export const QuizAnswerSchema = z.object({
  sessionId: z.string(),
  questionId: z.string(),
  answer: z.union([z.string(), z.boolean()]),
  timeSpentSeconds: z.number().min(0),
});

export type QuizSessionSettings = z.infer<typeof QuizSessionSettingsSchema>;
export type CreateQuizSession = z.infer<typeof CreateQuizSessionSchema>;
export type QuizSession = z.infer<typeof QuizSessionSchema>;
export type QuizAnswer = z.infer<typeof QuizAnswerSchema>;

