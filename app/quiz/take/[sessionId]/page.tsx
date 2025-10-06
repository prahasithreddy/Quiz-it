import { QuizTaker } from "./quiz-taker";

interface PageProps {
  params: {
    sessionId: string;
  };
}

export default function TakeQuizPage({ params }: PageProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <QuizTaker sessionId={params.sessionId} />
      </div>
    </div>
  );
}

