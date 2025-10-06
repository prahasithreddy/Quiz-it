"use client";

import { useState, useEffect, useCallback } from "react";
import { QuizTimer } from "./quiz-timer";

interface QuizResults {
  totalQuestions: number;
  correctAnswers: number;
  incorrectAnswers: number;
  unansweredQuestions: number;
  score: number;
  timeSpent: number;
  questionResults: {
    questionNumber: number;
    question: string;
    type: string;
    difficulty: string;
    userAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
    timeSpent: number;
    explanation: string;
  }[];
}

interface QuizSession {
  id: string;
  isStarted: boolean;
  isCompleted: boolean;
  currentQuestionIndex: number;
  settings: {
    validityHours: number;
    timePerQuestionSeconds: number;
    allowBackTracking: boolean;
    showExplanations: boolean;
    randomizeQuestionOrder: boolean;
  };
  quizTitle: string;
  expiresAt: string;
  completedAt?: string;
  startedAt?: string;
}

interface Progress {
  currentQuestion: number;
  totalQuestions: number;
  percentComplete: number;
}

interface Question {
  id: string;
  type: "mcq" | "true-false" | "short-answer";
  prompt: string;
  difficulty: string;
  options?: { id: string; text: string }[];
}

interface QuizTakerProps {
  sessionId: string;
}

export function QuizTaker({ sessionId }: QuizTakerProps) {
  const [session, setSession] = useState<QuizSession | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [quizResults, setQuizResults] = useState<QuizResults | null>(null);
  const [loadingResults, setLoadingResults] = useState(false);

  const fetchResults = useCallback(async () => {
    try {
      setLoadingResults(true);
      const response = await fetch(`/api/quiz/session/${sessionId}?results=true`);
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to load results");
        return;
      }

      setQuizResults(data.results);
      setSession(data.session);
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoadingResults(false);
    }
  }, [sessionId]);

  const fetchSession = useCallback(async () => {
    try {
      const response = await fetch(`/api/quiz/session/${sessionId}`);
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to load quiz");
        return;
      }

      setSession(data.session);
      setProgress(data.progress);
      setCurrentQuestion(data.currentQuestion);
      setError(null);
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  // Set startTime when currentQuestion changes (new question loaded)
  useEffect(() => {
    if (currentQuestion && !startTime) {
      setStartTime(new Date());
    }
  }, [currentQuestion, startTime]);

  const startQuiz = async () => {
    try {
      setSubmitting(true);
      const response = await fetch(`/api/quiz/session/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Failed to start quiz");
        return;
      }

      // Refresh session data
      await fetchSession();
      setStartTime(new Date());
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const submitAnswer = useCallback(async (forceSubmit = false) => {
    
    if (!currentQuestion || !startTime) {
      return;
    }
    
    // Allow submission with null answer if forced (time up) or if answer is provided
    if (!forceSubmit && selectedAnswer === null) {
      return;
    }

    try {
      setSubmitting(true);
      const timeSpent = Math.round((new Date().getTime() - startTime.getTime()) / 1000);

      const response = await fetch(`/api/quiz/session/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "answer",
          sessionId,
          questionId: currentQuestion.id,
          answer: selectedAnswer, // This can be null for unanswered questions
          timeSpentSeconds: timeSpent,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Failed to submit answer");
        return;
      }

      // Update state with new question
      setProgress(data.progress);
      setCurrentQuestion(data.nextQuestion);
      setSelectedAnswer(null);
      
      // Set startTime for next question immediately, or null if quiz completed
      if (data.nextQuestion) {
        setStartTime(new Date());
      } else {
        setStartTime(null);
      }

      // If quiz is completed, update session and fetch results
      if (data.isCompleted) {
        setSession(prev => prev ? { ...prev, isCompleted: true } : null);
        // Fetch detailed results
        setTimeout(() => fetchResults(), 500);
      }

    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [currentQuestion, startTime, selectedAnswer, sessionId, fetchResults]);

  const handleTimeUp = useCallback(() => {
    if (currentQuestion && !submitting) {
      // Auto-submit when time is up, regardless of whether an answer was selected
      submitAnswer(true);
    }
  }, [currentQuestion, submitting, submitAnswer]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-lg font-medium text-gray-900">Loading quiz...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Quiz Unavailable</h2>
        <p className="text-gray-600 mb-4">{error}</p>
        <button
          onClick={fetchSession}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  // Quiz completed
  if (session.isCompleted) {
    if (loadingResults) {
      return (
        <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-lg font-medium text-gray-900">Loading your results...</div>
        </div>
      );
    }

    if (!quizResults) {
      return (
        <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Quiz Completed!</h2>
          <p className="text-gray-600 mb-6">Thank you for taking the quiz. Your responses have been recorded.</p>
          <button
            onClick={fetchResults}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
          >
            View Results
          </button>
        </div>
      );
    }

    const getScoreColor = (score: number) => {
      if (score >= 80) return "text-green-600";
      if (score >= 60) return "text-yellow-600";
      return "text-red-600";
    };

    const getScoreBgColor = (score: number) => {
      if (score >= 80) return "bg-green-100";
      if (score >= 60) return "bg-yellow-100";
      return "bg-red-100";
    };

    const getScoreBorderColor = (score: number) => {
      if (score >= 80) return "border-green-200";
      if (score >= 60) return "border-yellow-200";
      return "border-red-200";
    };

    return (
      <div className="bg-white rounded-lg shadow-sm border p-8">
        <div className="text-center">
          {/* Score Display */}
          <div className={`w-32 h-32 ${getScoreBgColor(quizResults.score)} ${getScoreBorderColor(quizResults.score)} border-4 rounded-full flex items-center justify-center mx-auto mb-6`}>
            <span className={`text-4xl font-bold ${getScoreColor(quizResults.score)}`}>
              {quizResults.score}%
            </span>
          </div>

          {/* Title and Message */}
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Quiz Completed!</h1>
          <h2 className="text-xl text-gray-600 mb-6">{session.quizTitle}</h2>

          {/* Performance Message */}
          <div className={`inline-block px-6 py-3 rounded-full ${getScoreBgColor(quizResults.score)} ${getScoreBorderColor(quizResults.score)} border-2 mb-6`}>
            <p className={`font-semibold ${getScoreColor(quizResults.score)}`}>
              {quizResults.score >= 80 ? "🎉 Excellent work!" :
               quizResults.score >= 60 ? "👍 Good job!" :
               "💪 Keep practicing!"}
            </p>
          </div>

          {/* Simple Stats */}
          <div className="text-gray-600 mb-6">
            <p>You answered {quizResults.correctAnswers} out of {quizResults.totalQuestions} questions correctly</p>
          </div>

          {/* Completion Info */}
          <div className="text-sm text-gray-500">
            Completed on {session.completedAt ? new Date(session.completedAt).toLocaleString() : 'Unknown time'}
          </div>
        </div>
      </div>
    );
  }

  // Quiz not started yet
  if (!session.isStarted) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        
        <h1 className="text-3xl font-bold text-gray-900 mb-4">{session.quizTitle}</h1>
        
        <div className="bg-blue-50 rounded-lg p-6 mb-6">
          <h3 className="font-semibold text-blue-900 mb-3">Quiz Information</h3>
          <div className="space-y-2 text-sm text-blue-800">
            {progress && <p>Total Questions: {progress.totalQuestions}</p>}
            <p>Time per Question: {session.settings.timePerQuestionSeconds} seconds</p>
            <p>Expires: {new Date(session.expiresAt).toLocaleDateString()} at {new Date(session.expiresAt).toLocaleTimeString()}</p>
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-yellow-800">
            ⚠️ Once you start the quiz, you cannot pause or go back to previous questions.
            Make sure you have a stable internet connection.
          </p>
        </div>

        <button
          onClick={startQuiz}
          disabled={submitting}
          className="px-10 py-4 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-xl border-2 border-blue-600 hover:border-blue-700 text-lg"
          style={{
            backgroundColor: '#2563eb',
            color: '#ffffff',
            border: '2px solid #2563eb',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
          }}
        >
          {submitting ? "Starting..." : "🚀 Start Quiz"}
        </button>
      </div>
    );
  }

  // Quiz in progress
  if (!currentQuestion) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
        <p className="text-gray-600">Loading next question...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      {/* Progress bar */}
      {progress && (
        <div className="p-4 border-b bg-gray-50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              Question {progress.currentQuestion} of {progress.totalQuestions}
            </span>
            <span className="text-sm text-gray-500">{progress.percentComplete}% Complete</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress.percentComplete}%` }}
            />
          </div>
        </div>
      )}

      {/* Timer */}
      <div className="p-4 border-b bg-red-50">
        <QuizTimer
          key={currentQuestion.id} // Force remount when question changes
          timeLimit={session.settings.timePerQuestionSeconds}
          onTimeUp={handleTimeUp}
          isActive={!submitting}
        />
      </div>

      {/* Question */}
      <div className="p-8">
        <div className="mb-6">
          <div className="flex items-center space-x-2 mb-4">
            <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded">
              {currentQuestion.difficulty.toUpperCase()}
            </span>
            <span className="px-2 py-1 bg-blue-100 text-blue-600 text-xs font-medium rounded">
              {currentQuestion.type.toUpperCase().replace('-', ' ')}
            </span>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 leading-relaxed">
            {currentQuestion.prompt}
          </h2>
        </div>

        {/* Answer options */}
        <div className="space-y-3 mb-8">
          {currentQuestion.type === "mcq" && currentQuestion.options && (
            currentQuestion.options.map((option, index) => (
              <label key={option.id} className="block">
                <div className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  selectedAnswer === option.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}>
                  <div className="flex items-center">
                    <input
                      type="radio"
                      name="answer"
                      value={option.id}
                      checked={selectedAnswer === option.id}
                      onChange={(e) => setSelectedAnswer(e.target.value)}
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500 mr-3"
                    />
                    <span className="text-gray-900">
                      {String.fromCharCode(65 + index)}) {option.text}
                    </span>
                  </div>
                </div>
              </label>
            ))
          )}

          {currentQuestion.type === "true-false" && (
            <>
              <label className="block">
                <div className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  selectedAnswer === true
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}>
                  <div className="flex items-center">
                    <input
                      type="radio"
                      name="answer"
                      value="true"
                      checked={selectedAnswer === true}
                      onChange={() => setSelectedAnswer(true)}
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500 mr-3"
                    />
                    <span className="text-gray-900">True</span>
                  </div>
                </div>
              </label>
              <label className="block">
                <div className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  selectedAnswer === false
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}>
                  <div className="flex items-center">
                    <input
                      type="radio"
                      name="answer"
                      value="false"
                      checked={selectedAnswer === false}
                      onChange={() => setSelectedAnswer(false)}
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500 mr-3"
                    />
                    <span className="text-gray-900">False</span>
                  </div>
                </div>
              </label>
            </>
          )}

          {currentQuestion.type === "short-answer" && (
            <textarea
              value={selectedAnswer as string || ""}
              onChange={(e) => setSelectedAnswer(e.target.value)}
              placeholder="Type your answer here..."
              className="w-full p-4 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 resize-none"
              rows={4}
            />
          )}
        </div>

        {/* Submit button */}
        <div className="flex justify-between items-center">
          {selectedAnswer === null && (
            <p className="text-sm text-amber-600 font-medium">
              ⚠️ No answer selected - this will be marked as incorrect
            </p>
          )}
          <button
            onClick={() => submitAnswer(false)}
            disabled={submitting}
            className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg border-2 border-blue-600 hover:border-blue-700 ml-auto"
            style={{
              backgroundColor: '#2563eb',
              color: '#ffffff',
              border: '2px solid #2563eb',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
            }}
          >
            {submitting ? "Submitting..." : "Next Question →"}
          </button>
        </div>
      </div>
    </div>
  );
}
