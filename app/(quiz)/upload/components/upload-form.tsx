"use client";
import { useCallback, useMemo, useState } from "react";
import QuizView from "../../../../components/quiz/quiz-view";

type Step = "choose-type" | "upload" | "generating" | "results";

export function UploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const [numQuestions, setNumQuestions] = useState(10);
  const [difficulty, setDifficulty] = useState("medium");
  const [language, setLanguage] = useState("en");
  const [questionType, setQuestionType] = useState<"mcq" | "true-false" | "short-answer">("mcq");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [step, setStep] = useState<Step>("choose-type");

  const acceptedTypes = useMemo(() => [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ], []);

  const onDrop = useCallback((f: File) => {
    if (!acceptedTypes.includes(f.type)) {
      setError("Only PDF or DOCX files are supported");
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      setError("File too large. Max 20MB");
      return;
    }
    setError(null);
    setFile(f);
  }, [acceptedTypes]);

  async function generate() {
    if (!file) {
      setError("Please select a file");
      return;
    }
    const form = new FormData();
    form.append("file", file);
    form.append("numQuestions", String(numQuestions));
    form.append("difficulty", difficulty);
    form.append("language", language);
    form.append("questionTypes", questionType);
    setLoading(true);
    setStep("generating");
    setResult(null);
    try {
      const resp = await fetch("/api/ingest", { method: "POST", body: form });
      const data = await resp.json();
      if (!resp.ok) {
        setError(data?.error || "Request failed");
        setStep("upload");
      } else {
        setResult(data);
        setStep("results");
      }
    } catch (err: any) {
      setError(err?.message || "Unexpected error");
      setStep("upload");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl">
      {step === "choose-type" && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Pick a question type:</h2>
          <div className="space-y-3">
            {["mcq", "true-false", "short-answer"].map((qt) => (
              <button
                key={qt}
                onClick={() => { setQuestionType(qt as any); setStep("upload"); }}
                className={`w-full text-left border rounded-lg p-4 ${questionType === qt ? "border-blue-600 ring-2 ring-blue-200" : "border-gray-200"}`}
              >
                <span className="font-medium capitalize">{qt.replace("-", " ")}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {step === "upload" && (
        <section className="space-y-5">
          <h2 className="text-xl font-semibold">Generate Questions</h2>
          <div
            className="border-2 border-dashed rounded-xl p-8 text-center bg-blue-50/40"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) onDrop(f); }}
          >
            <div className="mb-3">Add PDF or DOCX</div>
            <div className="text-xs text-gray-500 mb-4">Supported: PDF, DOCX · Max 20MB</div>
            <label className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded cursor-pointer">
              <input
                type="file"
                accept={acceptedTypes.join(",")}
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onDrop(f); }}
              />
              Select files
            </label>
            {file && <div className="mt-3 text-sm">Selected: <span className="font-medium">{file.name}</span></div>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium">Questions</label>
              <input type="number" min={1} max={50} value={numQuestions} onChange={(e) => setNumQuestions(Number(e.target.value))} className="mt-1 w-full border p-2 rounded" />
            </div>
            <div>
              <label className="block text-sm font-medium">Difficulty</label>
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="mt-1 w-full border p-2 rounded">
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium">Language</label>
              <input value={language} onChange={(e) => setLanguage(e.target.value)} className="mt-1 w-full border p-2 rounded" />
            </div>
          </div>

          <button onClick={generate} disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50">
            Generate questions
          </button>
          {error && <p className="text-red-600 text-sm">{error}</p>}
        </section>
      )}

      {step === "generating" && (
        <section className="py-10 text-center">
          <div className="animate-pulse text-sm text-gray-700">Analyzing with AI…</div>
        </section>
      )}

      {step === "results" && result && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Multiple-choice questions</h2>
          <div className="p-4 bg-white border rounded-lg shadow-sm">
            <QuizView quiz={result} />
          </div>
          <div>
            <button className="text-sm text-blue-600 underline" onClick={() => setStep("upload")}>Refine these questions</button>
          </div>
        </section>
      )}
    </div>
  );
}


