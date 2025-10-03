import type { Metadata } from "next";
import { UploadForm } from "./components/upload-form";

export const metadata: Metadata = {
  title: "Upload Document → Generate Quiz",
  description: "Upload a PDF or DOCX to generate a quiz.",
  robots: { index: true, follow: true },
};

export default function Page() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold mb-2">Document to Quiz</h1>
      <p className="text-sm text-gray-600 mb-6">Upload a PDF or DOCX and configure quiz parameters.</p>
      <UploadForm />
    </main>
  );
}


