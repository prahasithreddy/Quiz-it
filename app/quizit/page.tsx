"use client";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  const handleCreateQuiz = () => {
    router.push('/quizit/dashboard');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        {/* Main Header */}
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-8">
          AI Quiz Generator
        </h1>
        
        {/* Create Quiz Button */}
        <button
          onClick={handleCreateQuiz}
          className="px-8 py-4 bg-blue-600 text-white text-lg font-semibold rounded-lg hover:bg-blue-700 transition-colors duration-200 shadow-lg hover:shadow-xl"
        >
          Create Quiz
        </button>
        
        {/* Optional subtitle */}
        <p className="mt-6 text-gray-600 text-lg">
          Generate quizzes from your documents instantly
        </p>
      </div>
    </div>
  );
}