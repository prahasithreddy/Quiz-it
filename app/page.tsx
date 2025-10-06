"use client";
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const [isDragOver, setIsDragOver] = useState(false);
  const router = useRouter();

  const handleFileSelect = useCallback((file: File) => {
    // Store file in sessionStorage and navigate to upload page
    const fileData = {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified
    };
    sessionStorage.setItem('selectedFile', JSON.stringify(fileData));
    // Create a URL for the file and store it
    const url = URL.createObjectURL(file);
    sessionStorage.setItem('fileURL', url);
    router.push('/upload');
  }, [router]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb Navigation */}
      <nav className="px-6 py-4">
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <span className="hover:text-gray-900 cursor-pointer">🏠 Home</span>
          <span>•</span>
          <span className="text-gray-900">AI Question Generator</span>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Main Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            AI Question Generator
          </h1>
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Upload Section */}
          <div className="order-2 lg:order-1">
            <div
              className={`border-2 border-dashed rounded-2xl p-8 md:p-16 text-center transition-all duration-200 ${
                isDragOver 
                  ? 'border-blue-400 bg-blue-50' 
                  : 'border-blue-300 bg-gradient-to-br from-blue-500 to-blue-700'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {/* PDF Icon */}
              <div className="mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-white bg-opacity-20 rounded-lg">
                  <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                    <text x="7" y="16" fontSize="4" fill="currentColor" fontWeight="bold">PDF</text>
                  </svg>
                </div>
              </div>

              {/* File Input Button */}
              <div className="mb-6">
                <label className="inline-flex items-center px-6 py-3 bg-white text-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors font-medium">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  CHOOSE FILES
                  <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.docx"
                    onChange={handleFileInputChange}
                  />
                </label>
              </div>

              <p className="text-white text-opacity-90">or drop files here</p>
            </div>

            {/* Description */}
            <div className="mt-8">
              <p className="text-gray-700 leading-relaxed">
                Instantly create multiple-choice, true-or-false, or open-ended tests. Upload a PDF, 
                and our AI quiz generator will quickly provide questions and potential answers.
              </p>
            </div>
          </div>

          {/* Features Section */}
          <div className="order-1 lg:order-2">
            <div className="space-y-6">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center mt-1">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-gray-900">Free and easy test maker for teachers</p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center mt-1">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-gray-900">Simple PDF to quiz maker for studying</p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center mt-1">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-gray-900">Generates questions and answers in seconds</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="mt-20 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Free Online Test & Quiz Maker from PDF
          </h2>
          <p className="text-gray-600 text-lg max-w-3xl mx-auto">
            The Smallpdf AI Question Generator takes any PDF document and quickly 
            transforms it into comprehensive quizzes and tests for educational purposes.
          </p>
        </div>
      </div>
    </div>
  );
}
