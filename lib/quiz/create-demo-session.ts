import { quizSessionStore, generateSessionId } from './session-store';
import { Quiz } from './schema';

export function createDemoSession(): string {
  const demoQuiz: Quiz = {
    meta: {
      title: "JavaScript Fundamentals Demo Quiz",
      language: "en",
      numQuestions: 3,
      createdAt: new Date().toISOString(),
    },
    sections: [
      {
        id: "section-1",
        title: "Basic JavaScript Concepts",
        questions: [
          {
            id: "q1",
            type: "mcq" as const,
            prompt: "What is the correct way to declare a variable in modern JavaScript?",
            difficulty: "easy" as const,
            explanation: "let and const are the modern ways to declare variables, with const being preferred for values that won't be reassigned.",
            options: [
              { id: "a", text: "var myVariable = 'hello';" },
              { id: "b", text: "let myVariable = 'hello';" },
              { id: "c", text: "variable myVariable = 'hello';" },
              { id: "d", text: "def myVariable = 'hello';" }
            ],
            correctOptionId: "b",
          },
          {
            id: "q2",
            type: "true-false" as const,
            prompt: "JavaScript is a statically typed language.",
            difficulty: "easy" as const,
            explanation: "JavaScript is dynamically typed, meaning variable types are determined at runtime, not compile time.",
            answer: false,
          },
          {
            id: "q3",
            type: "short-answer" as const,
            prompt: "What method would you use to add an element to the end of an array in JavaScript?",
            difficulty: "medium" as const,
            explanation: "The push() method adds one or more elements to the end of an array and returns the new length of the array.",
            answer: "push",
          },
        ],
      },
    ],
  };

  const sessionId = generateSessionId();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

  const session = {
    id: sessionId,
    quizId: `demo_${sessionId}`, // Demo quiz ID
    quizData: demoQuiz,
    recipientEmail: "demo@example.com",
    recipientName: "Demo User",
    senderName: "Quiz System",
    subject: "Demo Quiz: JavaScript Fundamentals",
    message: "This is a demo quiz for testing purposes.",
    settings: {
      validityHours: 24,
      timePerQuestionSeconds: 30,
      allowBackTracking: false,
      showExplanations: true,
      randomizeQuestionOrder: false,
    },
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

  quizSessionStore.create(session);
  return sessionId;
}

