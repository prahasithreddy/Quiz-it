import { useState } from "react";
import { Quiz } from "../../types/quiz";

export default function QuizView({ quiz }: { quiz: Quiz }) {
  const [showAnswers, setShowAnswers] = useState<Record<string, boolean>>({});
  const toggle = (id: string) => setShowAnswers((s) => ({ ...s, [id]: !s[id] }));

  // Create a flat list of all questions with sequential numbering
  const allQuestions = quiz.sections.flatMap(section => 
    section.questions.map(question => ({ ...question, sectionTitle: section.title }))
  );

  return (
    <section className="space-y-6">
      <header className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{quiz.meta.title}</h2>
        <p className="text-sm text-gray-600">
          {quiz.meta.numQuestions} Questions · {quiz.meta.language.toUpperCase()}
        </p>
      </header>

      <div className="space-y-8">
        {allQuestions.map((question, index) => (
          <div key={question.id} className="bg-white rounded-lg p-8 border-2 border-gray-200 shadow-lg" style={{ backgroundColor: '#ffffff', border: '2px solid #e2e8f0' }}>
            {/* Question Number and Text */}
            <div className="mb-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4" style={{ color: '#0f172a' }}>
                {index + 1}. {question.prompt}
              </h3>
            </div>

            {/* Multiple Choice Options */}
            {question.type === "mcq" && (
              <div className="mb-4 space-y-2">
                {question.options.map((option, optionIndex) => (
                  <div 
                    key={option.id}
                    className={`text-gray-900 ${
                      showAnswers[question.id] && option.id === question.correctOptionId
                        ? 'font-semibold text-green-800'
                        : ''
                    }`}
                  >
                    {String.fromCharCode(65 + optionIndex)}) {option.text}
                    {showAnswers[question.id] && option.id === question.correctOptionId && (
                      <span className="ml-2 text-green-600">✓</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* True/False Options */}
            {question.type === "true-false" && (
              <div className="mb-4 space-y-2">
                <div className={`text-gray-900 ${showAnswers[question.id] && question.answer === true ? 'font-semibold text-green-800' : ''}`}>
                  A) True
                  {showAnswers[question.id] && question.answer === true && (
                    <span className="ml-2 text-green-600">✓</span>
                  )}
                </div>
                <div className={`text-gray-900 ${showAnswers[question.id] && question.answer === false ? 'font-semibold text-green-800' : ''}`}>
                  B) False
                  {showAnswers[question.id] && question.answer === false && (
                    <span className="ml-2 text-green-600">✓</span>
                  )}
                </div>
              </div>
            )}

            {/* Short Answer */}
            {question.type === "short-answer" && showAnswers[question.id] && (
              <div className="mb-4 text-gray-900">
                <strong>Answer:</strong> {question.answer}
              </div>
            )}

            {/* Show Answer Button */}
            <button
              onClick={() => toggle(question.id)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg text-sm font-semibold transition-all duration-200 shadow-lg border-2 border-blue-600 hover:border-blue-700"
              style={{
                backgroundColor: '#2563eb',
                color: '#ffffff',
                border: '2px solid #2563eb',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
              }}
            >
              {showAnswers[question.id] ? "Hide Answer" : "Show Answer"}
            </button>

            {/* Explanation */}
            {showAnswers[question.id] && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-900">
                  <strong>Explanation:</strong> {question.explanation}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}


