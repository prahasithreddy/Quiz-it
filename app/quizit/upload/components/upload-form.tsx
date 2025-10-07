"use client";
import { useCallback, useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import QuizView from "../../../../components/quiz/quiz-view";
import { SendQuizForm } from "../../../../components/quiz/send-quiz-form";

type Step = "select-questions" | "generating" | "results";

export function UploadForm() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [numQuestions, setNumQuestions] = useState(10);
  const [difficulty, setDifficulty] = useState("medium");
  const [questionType, setQuestionType] = useState<"mcq" | "true-false" | "both">("mcq");
  const [quizName, setQuizName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [step, setStep] = useState<Step>("select-questions");
  const [documentPreview, setDocumentPreview] = useState<string | null>(null);
  const [generationMetadata, setGenerationMetadata] = useState<any>(null);

  // Note: sessionStorage from landing page can't preserve actual file content
  // Users need to re-select their file on this page

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
    
    // Create preview URL
    const url = URL.createObjectURL(f);
    setDocumentPreview(url);
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
    form.append("language", "en"); // Default to English
    if (questionType === "both") {
      form.append("questionTypes", "mcq");
      form.append("questionTypes", "true-false");
    } else {
      form.append("questionTypes", questionType);
    }
    if (quizName.trim()) {
      form.append("quizName", quizName.trim());
    }
    
    setLoading(true);
    setStep("generating");
    setResult(null);
    
    try {
      const resp = await fetch("/api/ingest", { method: "POST", body: form });
      const data = await resp.json();
      if (!resp.ok) {
        // Enhanced error handling with more specific messages
        let errorMessage = data?.error || "Request failed";
        if (data?.details && Array.isArray(data.details)) {
          errorMessage += " Details: " + data.details.join(", ");
        }
        setError(errorMessage);
        setStep("select-questions");
      } else {
        // Extract metadata for enhanced user feedback
        const { _metadata, ...quiz } = data;
        setResult(quiz);
        setGenerationMetadata(_metadata);
        setStep("results");
      }
    } catch (err: any) {
      setError(err?.message || "Unexpected error occurred. Please try again.");
      setStep("select-questions");
    } finally {
      setLoading(false);
    }
  }

  const handleCancel = () => {
    // Clean up any document preview URLs and navigate back
    if (documentPreview) {
      URL.revokeObjectURL(documentPreview);
    }
    router.push('/quizit');
  };

  if (step === "generating") {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center max-w-md">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-lg font-medium text-gray-900 mb-2">Generating questions...</div>
          <div className="text-sm text-gray-500 space-y-1">
            <div>📄 Analyzing document structure and content</div>
            <div>🧠 Creating intelligent content chunks</div>
            <div>❓ Generating {numQuestions} {questionType === 'both' ? 'diverse' : questionType} questions</div>
            <div>✨ Ensuring quality and accuracy</div>
          </div>
          <div className="mt-4 text-xs text-gray-400">
            This may take 30-60 seconds depending on document complexity
          </div>
        </div>
      </div>
    );
  }

  if (step === "results" && result) {
    const totalQuestions = result.sections?.reduce((sum: number, section: any) => sum + (section.questions?.length || 0), 0) || 0;
    
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between bg-white p-6 rounded-lg shadow-sm border-2 border-gray-200" style={{ backgroundColor: '#ffffff', border: '2px solid #e2e8f0' }}>
          <div>
            <h2 className="text-3xl font-bold text-gray-900" style={{ color: '#0f172a' }}>Generated Questions</h2>
            {generationMetadata?.generation && (
              <p className="text-sm text-gray-600 mt-2">
                {totalQuestions} questions generated from {generationMetadata.generation.chunksUsed} content sections
                {generationMetadata.generation.sourceQuality && (
                  <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
                    generationMetadata.generation.sourceQuality === 'high' 
                      ? 'bg-green-100 text-green-800' 
                      : generationMetadata.generation.sourceQuality === 'medium'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {generationMetadata.generation.sourceQuality} quality source
                  </span>
                )}
              </p>
            )}
          </div>
          <div className="flex items-center space-x-4">
            <SendQuizForm quiz={result} />
            <button 
              onClick={() => {
                setStep("select-questions");
                setGenerationMetadata(null);
              }} 
              className="px-4 py-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 font-semibold rounded-lg border-2 border-blue-600 hover:border-blue-800 transition-all duration-200"
              style={{ 
                color: '#2563eb',
                border: '2px solid #2563eb',
                backgroundColor: 'transparent'
              }}
            >
              Generate New Questions
            </button>
          </div>
        </div>

        {/* Content Quality Warnings */}
        {generationMetadata?.generation?.contentWarnings && generationMetadata.generation.contentWarnings.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">Document Processing Notes</h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <ul className="list-disc pl-5 space-y-1">
                    {generationMetadata.generation.contentWarnings.map((warning: string, index: number) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-lg border-2 border-gray-200 p-8" style={{ backgroundColor: '#ffffff', border: '2px solid #e2e8f0' }}>
          <QuizView quiz={result} />
        </div>
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-2 gap-8 h-[calc(100vh-200px)]">
      {/* Left Side - Document Preview */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        {!file ? (
          <div
            className="h-full border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center p-8"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { 
              e.preventDefault(); 
              const f = e.dataTransfer.files?.[0]; 
              if (f) onDrop(f); 
            }}
          >
            <div className="text-center">
              <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-lg font-medium text-gray-900 mb-2">Upload your document</p>
              <p className="text-sm text-gray-500 mb-4">Drag and drop a PDF or DOCX file here</p>
              <label className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-colors">
                <input
                  type="file"
                  accept={acceptedTypes.join(",")}
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) onDrop(f); }}
                />
                Choose File
              </label>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Document Preview</h3>
              <button
                onClick={() => {
                  setFile(null);
                  setDocumentPreview(null);
                  if (documentPreview) URL.revokeObjectURL(documentPreview);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Document preview area */}
            <div className="flex-1 bg-gray-50 rounded-lg p-6 overflow-hidden">
              <div className="bg-white rounded shadow-sm p-6 h-full">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-lg mb-4">
                    <svg className="w-8 h-8 text-red-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                    </svg>
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-2">{file.name}</h4>
                  <p className="text-sm text-gray-500">Ready to generate questions</p>
                  
                  {/* Mock document content preview */}
                  <div className="mt-6 text-left bg-gray-50 rounded p-4">
                    <div className="space-y-3 text-xs text-gray-600">
                      <div className="font-semibold">Document Preview:</div>
                      <div className="space-y-2">
                        <div className="h-2 bg-gray-200 rounded w-full"></div>
                        <div className="h-2 bg-gray-200 rounded w-5/6"></div>
                        <div className="h-2 bg-gray-200 rounded w-4/6"></div>
                        <div className="h-2 bg-gray-200 rounded w-full"></div>
                        <div className="h-2 bg-gray-200 rounded w-3/4"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right Side - Question Configuration */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Pick a question type:</h2>
        </div>

        <div className="space-y-4 mb-6">
          {          [
            { value: "mcq", label: "Multiple-choice questions" },
            { value: "true-false", label: "True-or-false questions" },
            { value: "both", label: "Both" }
          ].map((option) => (
            <label
              key={option.value}
              className={`flex items-center space-x-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                questionType === option.value
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <input
                type="radio"
                name="questionType"
                value={option.value}
                checked={questionType === option.value}
                onChange={(e) => setQuestionType(e.target.value as any)}
                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
              />
              <span className="font-medium text-gray-900">{option.label}</span>
            </label>
          ))}
        </div>

        {/* Quiz Name */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Quiz Name
          </label>
          <input
            type="text"
            value={quizName}
            onChange={(e) => setQuizName(e.target.value)}
            placeholder="Enter a name for your quiz (optional)"
            className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm hover:border-gray-400 transition-colors"
          />
          <p className="text-xs text-gray-500 mt-1">If left empty, we'll generate a name based on your document content</p>
        </div>

        {/* Number of Questions */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Number of questions
          </label>
          <div className="relative">
            <select
              value={numQuestions}
              onChange={(e) => setNumQuestions(Number(e.target.value))}
              className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none cursor-pointer shadow-sm hover:border-gray-400 transition-colors"
            >
              {[5, 10, 15, 20, 25, 30].map(num => (
                <option key={num} value={num} className="text-gray-900 bg-white py-2">{num} questions</option>
              ))}
            </select>
          </div>
        </div>

        {/* Additional Settings */}
        <div className="mb-8">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Difficulty
            </label>
            <div className="relative">
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none cursor-pointer shadow-sm hover:border-gray-400 transition-colors"
              >
                <option value="easy" className="text-gray-900 bg-white py-2">Easy</option>
                <option value="medium" className="text-gray-900 bg-white py-2">Medium</option>
                <option value="hard" className="text-gray-900 bg-white py-2">Hard</option>
              </select>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between">
          <button
            onClick={handleCancel}
            className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span>Cancel</span>
          </button>
          
          <button
            onClick={generate}
            disabled={loading || !file}
            className="flex items-center space-x-2 px-8 py-4 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg border-2 border-blue-600 hover:border-blue-700"
            style={{
              backgroundColor: '#2563eb',
              color: '#ffffff',
              border: '2px solid #2563eb',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
            }}
          >
            <span>Generate Questions</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}


