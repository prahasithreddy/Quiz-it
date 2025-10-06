"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Quiz } from "../../types/quiz";

interface SendQuizFormProps {
  quiz: Quiz;
  onSuccess?: () => void;
}

export function SendQuizForm({ quiz, onSuccess }: SendQuizFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const [formData, setFormData] = useState({
    recipientEmails: [""],
    senderName: "",
    subject: `Quiz: ${quiz.meta.title}`,
    message: "",
    validityHours: 48,
    timePerQuestionSeconds: 30,
    allowBackTracking: false,
    showExplanations: true,
    randomizeQuestionOrder: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const addEmailField = () => {
    setFormData(prev => ({
      ...prev,
      recipientEmails: [...prev.recipientEmails, ""]
    }));
  };

  const removeEmailField = (index: number) => {
    setFormData(prev => ({
      ...prev,
      recipientEmails: prev.recipientEmails.filter((_, i) => i !== index)
    }));
  };

  const updateEmail = (index: number, email: string) => {
    setFormData(prev => ({
      ...prev,
      recipientEmails: prev.recipientEmails.map((e, i) => i === index ? email : e)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Filter out empty emails and validate
    const validEmails = formData.recipientEmails.filter(email => email.trim() !== "");
    if (validEmails.length === 0) {
      setError("Please add at least one recipient email");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/quiz/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quizData: quiz,
          emailData: {
            recipientEmails: validEmails,
            senderName: formData.senderName || undefined,
            subject: formData.subject || undefined,
            message: formData.message || undefined,
            settings: {
              validityHours: formData.validityHours,
              timePerQuestionSeconds: formData.timePerQuestionSeconds,
              allowBackTracking: formData.allowBackTracking,
              showExplanations: formData.showExplanations,
              randomizeQuestionOrder: formData.randomizeQuestionOrder,
            },
          },
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        setError(data.error || "Failed to send quiz");
        return;
      }

      setSuccess(true);
      onSuccess?.();
      
      // Reset form and redirect to dashboard after success
      setTimeout(() => {
        setIsOpen(false);
        setSuccess(false);
        setFormData(prev => ({
          ...prev,
          recipientEmails: [""],
          message: "",
        }));
        
        // Redirect to main dashboard
        router.push('/quizit/dashboard');
      }, 2000);

    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center space-x-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:ring-4 focus:ring-green-200 transition-all duration-200 font-semibold shadow-lg border-2 border-green-600 hover:border-green-700"
        style={{ 
          backgroundColor: '#16a34a', 
          color: '#ffffff',
          border: '2px solid #16a34a',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
        }}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <span className="font-semibold">Send Quiz via Email</span>
      </button>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-xl border-2 border-gray-200 p-6" style={{ backgroundColor: '#ffffff', border: '2px solid #e2e8f0' }}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-gray-900" style={{ color: '#0f172a' }}>Send Quiz via Email</h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-500 hover:text-gray-700 p-2 rounded-full hover:bg-gray-100"
          style={{ color: '#64748b' }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {success ? (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h4 className="text-xl font-semibold text-gray-900 mb-2">Quiz Sent!</h4>
          <p className="text-gray-600">The quiz has been sent to {formData.recipientEmails.filter(e => e.trim()).length} recipient{formData.recipientEmails.filter(e => e.trim()).length !== 1 ? 's' : ''}</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Recipient Information */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Recipient Emails *
              </label>
              <button
                type="button"
                onClick={addEmailField}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                + Add Another
              </button>
            </div>
            <div className="space-y-2">
              {formData.recipientEmails.map((email, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <input
                    type="email"
                    required={index === 0} // Only first email is required
                    value={email}
                    onChange={(e) => updateEmail(index, e.target.value)}
                    className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white font-medium"
                    placeholder={index === 0 ? "student@example.com" : "additional@example.com"}
                    style={{
                      backgroundColor: '#ffffff',
                      color: '#0f172a',
                      border: '2px solid #d1d5db',
                      fontSize: '16px'
                    }}
                  />
                  {formData.recipientEmails.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeEmailField(index)}
                      className="p-2 text-red-500 hover:text-red-700 rounded-lg hover:bg-red-50"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Your Name (optional)
            </label>
            <input
              type="text"
              value={formData.senderName}
              onChange={(e) => setFormData(prev => ({ ...prev, senderName: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Teacher Name"
            />
          </div>

          {/* Email Content */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Subject
            </label>
            <input
              type="text"
              value={formData.subject}
              onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Message (optional)
            </label>
            <textarea
              value={formData.message}
              onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              placeholder="Additional message for the recipient..."
            />
          </div>

          {/* Quiz Settings */}
          <div className="border-t pt-4">
            <h4 className="font-medium text-gray-900 mb-3">Quiz Settings</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Link Validity (hours)
                </label>
                <select
                  value={formData.validityHours}
                  onChange={(e) => setFormData(prev => ({ ...prev, validityHours: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value={1}>1 hour</option>
                  <option value={6}>6 hours</option>
                  <option value={12}>12 hours</option>
                  <option value={24}>1 day</option>
                  <option value={48}>2 days</option>
                  <option value={72}>3 days</option>
                  <option value={168}>1 week</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Time per Question (seconds)
                </label>
                <select
                  value={formData.timePerQuestionSeconds}
                  onChange={(e) => setFormData(prev => ({ ...prev, timePerQuestionSeconds: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value={15}>15 seconds</option>
                  <option value={30}>30 seconds</option>
                  <option value={45}>45 seconds</option>
                  <option value={60}>1 minute</option>
                  <option value={90}>1.5 minutes</option>
                  <option value={120}>2 minutes</option>
                  <option value={180}>3 minutes</option>
                  <option value={300}>5 minutes</option>
                </select>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.showExplanations}
                  onChange={(e) => setFormData(prev => ({ ...prev, showExplanations: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">Show explanations after completion</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.randomizeQuestionOrder}
                  onChange={(e) => setFormData(prev => ({ ...prev, randomizeQuestionOrder: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">Randomize question order</span>
              </label>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !formData.recipientEmails.some(email => email.trim() !== "")}
              className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-semibold shadow-lg border-2 border-blue-600 hover:border-blue-700"
              style={{
                backgroundColor: '#2563eb',
                color: '#ffffff',
                border: '2px solid #2563eb',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
              }}
            >
              {loading ? "Sending..." : "🚀 Send Quiz"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
