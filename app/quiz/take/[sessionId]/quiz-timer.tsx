"use client";

import { useState, useEffect, useRef } from "react";

interface QuizTimerProps {
  timeLimit: number; // in seconds
  onTimeUp: () => void;
  isActive: boolean;
}

export function QuizTimer({ timeLimit, onTimeUp, isActive }: QuizTimerProps) {
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasCalledTimeUp = useRef(false);

  useEffect(() => {
    // Reset timer when timeLimit changes (new question)
    setTimeLeft(timeLimit);
    hasCalledTimeUp.current = false;
  }, [timeLimit]);

  useEffect(() => {
    if (!isActive) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setTimeLeft((prevTime) => {
        const newTime = prevTime - 1;
        
        if (newTime <= 0 && !hasCalledTimeUp.current) {
          hasCalledTimeUp.current = true;
          onTimeUp();
          return 0;
        }
        
        return newTime;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isActive, onTimeUp]);

  const minutes = Math.floor(Math.max(0, timeLeft) / 60);
  const seconds = Math.max(0, timeLeft) % 60;
  const progressPercentage = ((timeLimit - timeLeft) / timeLimit) * 100;
  
  // Color logic: green -> yellow -> red
  const getColor = () => {
    const percentage = (timeLeft / timeLimit) * 100;
    if (percentage > 50) return "text-green-600";
    if (percentage > 20) return "text-yellow-600";
    return "text-red-600";
  };

  const getProgressColor = () => {
    const percentage = (timeLeft / timeLimit) * 100;
    if (percentage > 50) return "bg-green-600";
    if (percentage > 20) return "bg-yellow-600";
    return "bg-red-600";
  };

  return (
    <div className="flex items-center space-x-4">
      <div className="flex items-center space-x-2">
        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className={`font-mono text-lg font-semibold ${getColor()}`}>
          {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
        </span>
      </div>
      
      <div className="flex-1 max-w-xs">
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className={`h-2 rounded-full transition-all duration-1000 ease-linear ${getProgressColor()}`}
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>
      
      {timeLeft <= 10 && timeLeft > 0 && (
        <span className="text-red-600 text-sm font-medium animate-pulse">
          Hurry up!
        </span>
      )}
      
      {timeLeft === 0 && (
        <span className="text-red-600 text-sm font-medium">
          Time's up!
        </span>
      )}
    </div>
  );
}
