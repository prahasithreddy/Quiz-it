import { QuizTaker } from "./quiz-taker";

interface PageProps {
  params: Promise<{
    sessionId: string;
  }>;
}

export default async function TakeQuizPage({ params }: PageProps) {
  const { sessionId } = await params;
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <QuizTaker sessionId={sessionId} />
      </div>
    </div>
  );
}

