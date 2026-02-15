import { useEffect, useState } from "react";

export interface ToastMessage {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

interface ToastProps {
  toast: ToastMessage | null;
  onClose: () => void;
}

export default function Toast({ toast, onClose }: ToastProps) {
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        onClose();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toast, onClose]);

  if (!toast) return null;

  const bgColor =
    toast.type === "success"
      ? "bg-green-600"
      : toast.type === "error"
        ? "bg-red-600"
        : "bg-blue-600";

  return (
    <div
      className={`fixed bottom-4 right-4 px-6 py-3 ${bgColor} text-white rounded-full shadow-lg animate-in fade-in slide-in-from-bottom-4 z-50`}
    >
      {toast.message}
    </div>
  );
}
