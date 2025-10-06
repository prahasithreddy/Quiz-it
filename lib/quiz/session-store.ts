import { QuizSession } from './session-schema';
import { Quiz } from './schema';
import * as fs from 'fs';
import * as path from 'path';

// Persistent file-based store for quiz sessions
// In production, this should be replaced with a proper database
class QuizSessionStore {
  private sessions = new Map<string, QuizSession>();
  private dataDir: string;
  private sessionsFile: string;

  constructor() {
    // Create sessions directory in project root
    this.dataDir = path.join(process.cwd(), '.quiz-sessions');
    this.sessionsFile = path.join(this.dataDir, 'sessions.json');
    this.loadSessions();
  }

  private loadSessions(): void {
    try {
      // Create directory if it doesn't exist
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }

      // Create file if it doesn't exist
      if (!fs.existsSync(this.sessionsFile)) {
        fs.writeFileSync(this.sessionsFile, '{}');
        return;
      }

      // Load sessions from file
      const data = fs.readFileSync(this.sessionsFile, 'utf-8');
      const sessionsData = JSON.parse(data);
      
      // Convert dates back from ISO strings and populate the Map
      for (const [id, sessionData] of Object.entries(sessionsData)) {
        const session = this.deserializeSession(sessionData as any);
        
        // Only load non-expired sessions
        if (new Date() <= session.expiresAt) {
          this.sessions.set(id, session);
        }
      }
    } catch (error) {
      console.warn('Failed to load quiz sessions from file, starting with empty store:', error);
      this.sessions.clear();
    }
  }

  private saveSessions(): void {
    try {
      // Convert Map to plain object with serialized dates
      const sessionsData: Record<string, any> = {};
      for (const [id, session] of this.sessions.entries()) {
        sessionsData[id] = this.serializeSession(session);
      }

      // Write to file
      fs.writeFileSync(this.sessionsFile, JSON.stringify(sessionsData, null, 2));
    } catch (error) {
      console.error('Failed to save quiz sessions to file:', error);
    }
  }

  private serializeSession(session: QuizSession): any {
    return {
      ...session,
      createdAt: session.createdAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
      startedAt: session.startedAt?.toISOString(),
      completedAt: session.completedAt?.toISOString(),
      answers: session.answers.map(answer => ({
        ...answer,
        answeredAt: answer.answeredAt.toISOString(),
      })),
    };
  }

  private deserializeSession(data: any): QuizSession {
    return {
      ...data,
      createdAt: new Date(data.createdAt),
      expiresAt: new Date(data.expiresAt),
      startedAt: data.startedAt ? new Date(data.startedAt) : undefined,
      completedAt: data.completedAt ? new Date(data.completedAt) : undefined,
      answers: data.answers.map((answer: any) => ({
        ...answer,
        answeredAt: new Date(answer.answeredAt),
      })),
    };
  }

  create(session: QuizSession): void {
    this.sessions.set(session.id, session);
    this.saveSessions();
  }

  get(id: string): QuizSession | null {
    const session = this.sessions.get(id);
    if (!session) return null;
    
    // Check if session has expired
    if (new Date() > session.expiresAt) {
      this.sessions.delete(id);
      this.saveSessions();
      return null;
    }
    
    return session;
  }

  update(id: string, updates: Partial<QuizSession>): QuizSession | null {
    const session = this.get(id);
    if (!session) return null;
    
    const updatedSession = { ...session, ...updates };
    this.sessions.set(id, updatedSession);
    this.saveSessions();
    return updatedSession;
  }

  delete(id: string): boolean {
    const deleted = this.sessions.delete(id);
    if (deleted) {
      this.saveSessions();
    }
    return deleted;
  }

  // Clean up expired sessions (should be called periodically)
  cleanupExpired(): number {
    const now = new Date();
    let cleaned = 0;
    
    for (const [id, session] of this.sessions.entries()) {
      if (now > session.expiresAt) {
        this.sessions.delete(id);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      this.saveSessions();
    }
    
    return cleaned;
  }

  // Get all questions in order for a quiz session
  getQuizQuestions(session: QuizSession) {
    const quiz = session.quizData as Quiz;
    const allQuestions = quiz.sections.flatMap(section => 
      section.questions.map(question => ({ 
        ...question, 
        sectionTitle: section.title 
      }))
    );

    // Randomize order if setting is enabled
    if (session.settings.randomizeQuestionOrder) {
      return this.shuffleArray(allQuestions);
    }
    
    return allQuestions;
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}

// Export singleton instance
export const quizSessionStore = new QuizSessionStore();

// Utility functions
export function generateSessionId(): string {
  return `quiz_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function isSessionExpired(session: QuizSession): boolean {
  return new Date() > session.expiresAt;
}

export function getSessionProgress(session: QuizSession): {
  currentQuestion: number;
  totalQuestions: number;
  percentComplete: number;
} {
  const quiz = session.quizData as Quiz;
  const totalQuestions = quiz.sections.reduce((sum, section) => sum + section.questions.length, 0);
  const currentQuestion = session.currentQuestionIndex + 1;
  const percentComplete = Math.round((session.currentQuestionIndex / totalQuestions) * 100);
  
  return {
    currentQuestion,
    totalQuestions,
    percentComplete,
  };
}
