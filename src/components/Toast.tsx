import React from 'react';
import { CheckCircle } from 'lucide-react';

interface ToastProps {
  message: string | null;
}

export const Toast: React.FC<ToastProps> = ({ message }) => {
  if (!message) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 bg-[#2e7d32] text-white py-3 px-5 rounded-lg shadow-xl flex items-center gap-2.5 text-sm font-semibold animate-in slide-in-from-bottom-5 duration-300">
      <CheckCircle className="w-4 h-4 shrink-0 text-white" />
      <span>{message}</span>
    </div>
  );
};
