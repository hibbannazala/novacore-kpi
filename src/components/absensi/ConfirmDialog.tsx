"use client";

import { useState, useEffect } from "react";
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
  warning: "bg-amber-500 text-white shadow-amber-500/30",
  danger:  "bg-rose-500 text-white shadow-rose-500/30",
  info:    "bg-blue-600 text-white shadow-blue-500/30",
};

export default function ConfirmDialog({
  isOpen, title, message, onConfirm, onCancel,
  type = "warning", confirmLabel = "Ya, Lanjut", cancelLabel = "Batal",
}: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock scroll on body and main container when modal is open
  useEffect(() => {
    if (!isOpen) return;
    const originalBodyOverflow = document.body.style.overflow;
    const mainEl = document.querySelector("main");
    const originalMainOverflow = mainEl ? mainEl.style.overflow : "";

    document.body.style.overflow = "hidden";
    if (mainEl) mainEl.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      if (mainEl) mainEl.style.overflow = originalMainOverflow;
    };
  }, [isOpen]);

  if (!isOpen || !mounted || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md overflow-y-auto overscroll-contain animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        className="w-full max-w-sm sm:max-w-md my-auto bg-[var(--ab-bg-surface)] rounded-[32px] p-6 sm:p-8 border border-[var(--ab-border)] shadow-2xl ab-animate-scaleIn max-h-[90vh] overflow-y-auto relative text-center"
      >
        <div className="flex flex-col items-center">
          <div className={`${colors[type]} w-14 h-14 sm:w-16 sm:h-16 rounded-3xl flex items-center justify-center mb-5 shadow-lg`}>
            <TriangleAlert size={30} />
          </div>
          <h3 className="text-lg sm:text-xl font-black text-[var(--ab-text-main)] mb-2 tracking-tight capitalize">
            {title}
          </h3>
          <p className="text-[var(--ab-text-dim)] text-xs sm:text-sm font-medium leading-relaxed mb-6 sm:mb-8 px-2">
            {message}
          </p>
          <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:gap-3 w-full">
            <button
              type="button"
              onClick={onCancel}
              className="w-full sm:flex-1 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest text-[var(--ab-text-dim)] hover:bg-[var(--ab-bg-main)] transition-all border border-[var(--ab-border)]"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className={`w-full sm:flex-1 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest text-white shadow-lg active:scale-95 transition-all ${
                type === "danger"
                  ? "bg-rose-600 hover:bg-rose-700 shadow-rose-600/20"
                  : type === "warning"
                  ? "bg-amber-500 hover:bg-amber-600 shadow-amber-500/20"
                  : "bg-blue-600 hover:bg-blue-700 shadow-blue-600/20"
              }`}
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
