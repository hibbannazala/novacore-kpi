"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { PenLine } from "lucide-react";

interface Props {
  isOpen: boolean;
  title: string;
  message: string;
  placeholder?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export default function PromptDialog({ isOpen, title, message, placeholder, onConfirm, onCancel }: Props) {
  const [value, setValue] = useState("");

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!value.trim()) return;
    onConfirm(value.trim());
    setValue("");
  };

  return createPortal(
    <div className="ab-confirm-overlay ab-animate-fadeIn">
      <div className="bg-white dark:bg-slate-800 rounded-[32px] p-8 max-w-sm w-full mx-4 shadow-2xl ab-animate-scaleIn border border-gray-100 dark:border-slate-700">
        <div className="flex flex-col items-center text-center">
          <div className="bg-blue-500 w-16 h-16 rounded-3xl flex items-center justify-center text-white mb-6 shadow-lg">
            <PenLine size={32} />
          </div>
          <h3 className="text-xl font-black text-gray-800 dark:text-white mb-2 tracking-tighter">{title}</h3>
          <p className="text-gray-500 dark:text-slate-400 text-sm font-medium leading-relaxed mb-4">{message}</p>
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder ?? "Tulis alasan..."}
            rows={3}
            className="w-full rounded-2xl px-4 py-3 text-sm border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 text-gray-800 dark:text-white resize-none outline-none focus:ring-2 focus:ring-blue-500/30 mb-6"
            autoFocus
          />
          <div className="flex gap-3 w-full">
            <button
              onClick={() => { setValue(""); onCancel(); }}
              className="flex-1 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest text-gray-400 hover:text-gray-600 hover:bg-gray-50 dark:hover:bg-slate-700 transition-all border border-gray-100 dark:border-slate-700"
            >
              Batal
            </button>
            <button
              onClick={handleConfirm}
              disabled={!value.trim()}
              className="flex-1 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest bg-blue-600 text-white hover:bg-blue-700 shadow-lg active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Kirim
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
