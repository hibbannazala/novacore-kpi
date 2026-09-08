"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, ExternalLink, ZoomIn } from "lucide-react";

interface ImageLightboxModalProps {
  imageUrl: string | null;
  onClose: () => void;
  title?: string;
}

export default function ImageLightboxModal({ imageUrl, onClose, title }: ImageLightboxModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!imageUrl) return;
    const originalBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalBodyOverflow;
    };
  }, [imageUrl]);

  if (!mounted || !imageUrl || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100000] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar */}
        <div className="w-full flex items-center justify-between pb-3 text-white px-2">
          <div className="flex items-center gap-2">
            <ZoomIn size={16} className="text-amber-400" />
            <span className="text-xs font-black uppercase tracking-wider">
              {title || "Bukti Lembur"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="Buka ukuran asli di tab baru"
            >
              <ExternalLink size={16} />
            </a>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Image Display */}
        <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-black/40 flex items-center justify-center max-h-[80vh] w-auto">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt="Bukti Lembur"
            className="max-h-[80vh] max-w-full w-auto object-contain rounded-xl select-none"
          />
        </div>
      </div>
    </div>,
    document.body
  );
}
