"use client";

import { createPortal } from "react-dom";
import { TriangleAlert } from "lucide-react";

interface Props {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  type?: "warning" | "danger" | "info";
  confirmLabel?: string;
  cancelLabel?: string;
}

const colors = {
  warning: "bg-orange-500",
  danger:  "bg-red-500",
  info:    "bg-blue-500",
};

export default function ConfirmDialog({
  isOpen, title, message, onConfirm, onCancel,
  type = "warning", confirmLabel = "Ya, Lanjut", cancelLabel = "Batal",
}: Props) {
  if (!isOpen) return null;

  return createPortal(
    <div className="ab-confirm-overlay ab-animate-fadeIn">
      <div className="rounded-[32px] p-8 max-w-sm w-full mx-4 shadow-2xl ab-animate-scaleIn border border-[var(--ab-border)]" style={{ background: "var(--ab-bg-surface)" }}>
        <div className="flex flex-col items-center text-center">
          <div className={`${colors[type]} w-16 h-16 rounded-3xl flex items-center justify-center text-white mb-6 shadow-lg`}>
            <TriangleAlert size={32} />
          </div>
          <h3 className="text-xl font-black text-gray-800 dark:text-white mb-2 tracking-tighter capitalize">
            {title}
          </h3>
          <p className="text-gray-500 dark:text-slate-400 text-sm font-medium leading-relaxed mb-8">
            {message}
          </p>
          <div className="flex gap-3 w-full">
            <button
              onClick={onCancel}
              className="flex-1 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest text-gray-400 hover:text-gray-600 hover:bg-gray-50 dark:hover:bg-slate-700 transition-all border border-gray-100 dark:border-slate-700"
            >
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest bg-blue-600 text-white hover:bg-blue-700 shadow-lg active:scale-95 transition-all"
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
