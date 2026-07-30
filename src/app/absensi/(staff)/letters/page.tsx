"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { FileText, Loader2, Download } from "lucide-react";
import type { CompanyLetter } from "@/types";

export default function MyLettersPage() {
  const supabase = createClient() as any;
  const { user } = useAuth();
  const [letters, setLetters] = useState<CompanyLetter[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) fetchData();
  }, [user?.id]);

  async function fetchData() {
    setLoading(true);
    const { data } = await supabase
      .from("company_letters")
      .select(`*, letter_types:letter_type_id(*)`)
      .eq("issued_to", user!.id)
      .order("created_at", { ascending: false });

    if (data) setLetters(data as CompanyLetter[]);
    setLoading(false);
  }

  function handleDownload(letter: CompanyLetter) {
    // For now just alert, in the future this could generate a PDF
    alert(`Mendownload surat: ${letter.full_number}\n\nFitur PDF Generator akan segera hadir.`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Surat Saya</h1>
        <p className="text-sm text-slate-500 mt-1">Daftar surat resmi yang diterbitkan untuk Anda.</p>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-200px)]">
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin mb-2" />
              <p className="text-xs font-bold uppercase tracking-widest">Memuat Data...</p>
            </div>
          ) : letters.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-400">
              <p className="text-xs font-bold uppercase tracking-widest">Belum ada surat untuk Anda</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {letters.map((letter) => (
                <div key={letter.id} className="p-4 rounded-2xl border border-slate-100 bg-slate-50 hover:bg-white transition-all hover:shadow-md flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 group">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <FileText size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 rounded text-[10px] font-black tracking-widest uppercase bg-primary/10 text-primary">
                          {letter.company}
                        </span>
                        <span className="text-xs font-bold text-slate-500">{letter.letter_types?.name}</span>
                      </div>
                      <p className="text-lg font-black font-mono text-slate-900 tracking-tight">{letter.full_number}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                        Diterbitkan: {format(new Date(letter.created_at!), "dd MMMM yyyy", { locale: id })}
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleDownload(letter)}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all shadow-sm group-hover:shadow"
                  >
                    <Download size={16} />
                    Unduh Surat
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
