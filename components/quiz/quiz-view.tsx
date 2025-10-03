import { useState } from "react";
import { Quiz } from "../../types/quiz";

export default function QuizView({ quiz }: { quiz: Quiz }) {
  const [showAnswers, setShowAnswers] = useState<Record<string, boolean>>({});
  const toggle = (id: string) => setShowAnswers((s) => ({ ...s, [id]: !s[id] }));
  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-xl font-semibold">{quiz.meta.title}</h2>
        <p className="text-sm text-foreground/80">Questions: {quiz.meta.numQuestions} · Language: {quiz.meta.language}</p>
      </header>
      {quiz.sections.map((section) => (
        <section key={section.id} className="space-y-3">
          <h3 className="font-medium">{section.title}</h3>
          <ol className="list-decimal pl-5 space-y-3">
            {section.questions.map((q) => (
              <li key={q.id}>
                <div className="font-medium text-foreground">{q.prompt}</div>
                {q.type === "mcq" && (
                  <div className="mt-2">
                    <div className="grid grid-cols-1 gap-2">
                      {q.options.map((opt, index) => (
                        <div 
                          key={opt.id} 
                          className={`p-2 rounded border ${
                            showAnswers[q.id] && opt.id === q.correctOptionId 
                              ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-300' 
                              : 'bg-white border-zinc-200 text-foreground dark:bg-zinc-900 dark:border-zinc-700 dark:text-foreground'
                          }`}
                        >
                          <span className="font-medium">{String.fromCharCode(65 + index)}.</span> {opt.text}
                          {showAnswers[q.id] && opt.id === q.correctOptionId && (
                            <span className="ml-2 text-xs font-semibold text-green-600 dark:text-green-400">✓ Correct</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {q.type === "true-false" && showAnswers[q.id] && <div className="text-sm text-foreground">Answer: {q.answer ? "True" : "False"}</div>}
                {q.type === "short-answer" && showAnswers[q.id] && <div className="text-sm text-foreground">Answer: {q.answer}</div>}
                {showAnswers[q.id] && <div className="text-xs text-foreground/70">Explanation: {q.explanation}</div>}
                <button onClick={() => toggle(q.id)} className="mt-1 text-xs text-blue-600 underline dark:text-blue-400">
                  {showAnswers[q.id] ? "Hide answer" : "Show answer"}
                </button>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </section>
  );
}


