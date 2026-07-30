"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { Plus, Settings, Search, Filter, Loader2, X, Trash2, MapPin } from "lucide-react";
import { toast } from "sonner";
import type { CompanyLetter, LetterType } from "@/types";

const COMPANIES = ["TNT", "HYPE", "GOAT", "NOVA"];

function romanize(num: number) {
  if (isNaN(num)) return "";
  const digits = String(+num).split(""),
    key = ["","I","II","III","IV","V","VI","VII","VIII","IX",
           "","X","XX","XXX","XL","L","LX","LXX","LXXX","XC",
           "","C","CC","CCC","CD","D","DC","DCC","DCCC","CM"],
    roman = [];
  let i = 3;
  while (i--) {
    const pop = digits.pop();
    roman.push(key[+pop! + (i * 10)]);
  }
  return Array(+(digits.join("") || 0) + 1).join("M") + roman.reverse().join("");
}

export default function LettersPage() {
  const supabase = createClient() as any;
  const [letters, setLetters] = useState<CompanyLetter[]>([]);
  const [letterTypes, setLetterTypes] = useState<LetterType[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterCompany, setFilterCompany] = useState<string>("ALL");

  // Modals
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    fetchData();
  }, [filterCompany]);

  async function fetchData() {
    setLoading(true);
    
    // Fetch letter types
    const { data: tData } = await supabase.from("letter_types").select("*").order("name");
    if (tData) setLetterTypes(tData as LetterType[]);

    // Fetch letters
    let q = supabase
      .from("company_letters")
      .select(`
        *,
        letter_types:letter_type_id(*),
        users:issued_to(name, role)
      `)
      .order("created_at", { ascending: false });

    if (filterCompany !== "ALL") {
      q = q.eq("company", filterCompany);
    }

    const { data: lData } = await q;
    if (lData) setLetters(lData as CompanyLetter[]);
    
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Surat Menyurat</h1>
          <p className="text-sm text-slate-500 mt-1">Kelola dan terbitkan nomor surat keluar resmi perusahaan.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={() => setShowTypeModal(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 hover:text-slate-900 transition-all shadow-sm"
          >
            <Settings size={16} />
            <span className="hidden sm:inline">Tipe Surat</span>
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:bg-primary/90 transition-all shadow-sm shadow-primary/20"
          >
            <Plus size={16} />
            Buat Surat
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-200px)]">
        <div className="p-4 border-b border-slate-100 flex gap-4">
          <select
            value={filterCompany}
            onChange={(e) => setFilterCompany(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:outline-none focus:border-primary/50"
          >
            <option value="ALL">Semua Perusahaan</option>
            {COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin mb-2" />
              <p className="text-xs font-bold uppercase tracking-widest">Memuat Data...</p>
            </div>
          ) : letters.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-400">
              <p className="text-xs font-bold uppercase tracking-widest">Belum ada surat</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {letters.map((letter) => (
                <div key={letter.id} className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors flex justify-between items-center group">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded text-[10px] font-black tracking-widest uppercase bg-primary/10 text-primary">
                        {letter.company}
                      </span>
                      <span className="text-xs font-bold text-slate-500">{letter.letter_types?.name}</span>
                    </div>
                    <p className="text-lg font-black font-mono text-slate-900 tracking-tight">{letter.full_number}</p>
                    {letter.users && (
                      <p className="text-xs text-slate-500 mt-1">Diberikan ke: <span className="font-bold text-slate-700">{letter.users.name}</span></p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      {format(new Date(letter.created_at!), "dd MMM yyyy", { locale: id })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showTypeModal && (
        <TypeModal 
          types={letterTypes} 
          onClose={() => setShowTypeModal(false)} 
          onUpdate={fetchData} 
        />
      )}
      
      {showCreateModal && (
        <CreateModal 
          types={letterTypes} 
          onClose={() => setShowCreateModal(false)} 
          onUpdate={fetchData} 
        />
      )}
    </div>
  );
}

// ----------------------------------------------------
// Tipe Surat Modal
// ----------------------------------------------------
function TypeModal({ types, onClose, onUpdate }: { types: LetterType[], onClose: () => void, onUpdate: () => void }) {
  const supabase = createClient() as any;
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !code) return toast.error("Semua field wajib diisi");
    
    setSaving(true);
    const { error } = await supabase.from("letter_types").insert({ name, code });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Tipe surat ditambahkan!");
      setName("");
      setCode("");
      onUpdate();
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Hapus tipe surat ini?")) return;
    const { error } = await supabase.from("letter_types").delete().eq("id", id);
    if (error) toast.error("Gagal menghapus: Mungkin sedang digunakan.");
    else {
      toast.success("Tipe surat dihapus!");
      onUpdate();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h2 className="text-lg font-black text-slate-800">Kelola Tipe Surat</h2>
          <button onClick={onClose} className="p-2 bg-slate-100 text-slate-400 rounded-full hover:bg-slate-200 hover:text-slate-600 transition">
            <X size={16} />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto">
          <form onSubmit={handleAdd} className="flex gap-2 mb-6">
            <input 
              type="text" placeholder="Nama (e.g. Surat Teguran)" 
              value={name} onChange={e => setName(e.target.value)}
              className="flex-1 min-w-0 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-primary"
            />
            <input 
              type="text" placeholder="Kode (e.g. ST)" 
              value={code} onChange={e => setCode(e.target.value)}
              className="w-24 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-primary uppercase"
            />
            <button disabled={saving} className="px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 disabled:opacity-50">
              <Plus size={16} />
            </button>
          </form>

          <div className="space-y-2">
            {types.map(t => (
              <div key={t.id} className="flex justify-between items-center p-3 rounded-xl border border-slate-100 bg-slate-50">
                <div>
                  <p className="text-sm font-bold text-slate-700">{t.name}</p>
                  <p className="text-[10px] font-black tracking-widest text-primary uppercase">{t.code}</p>
                </div>
                <button onClick={() => handleDelete(t.id)} className="text-red-400 hover:text-red-600 p-2">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {types.length === 0 && <p className="text-center text-xs text-slate-400 py-4">Belum ada tipe surat.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// Buat Surat Modal
// ----------------------------------------------------
function CreateModal({ types, onClose, onUpdate }: { types: LetterType[], onClose: () => void, onUpdate: () => void }) {
  const supabase = createClient() as any;
  const [company, setCompany] = useState<string>("TNT");
  const [typeId, setTypeId] = useState<string>("");
  const [issuedTo, setIssuedTo] = useState<string>("");
  const [users, setUsers] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (types.length > 0 && !typeId) setTypeId(types[0].id);
    supabase.from("users").select("id, name, role").order("name").then((res: any) => {
      if (res.data) setUsers(res.data);
    });
  }, [types]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!company || !typeId) return toast.error("Perusahaan dan Tipe wajib dipilih");
    
    setSaving(true);
    try {
      const type = types.find(t => t.id === typeId);
      if (!type) throw new Error("Tipe surat tidak valid");

      const date = new Date();
      const currentYear = date.getFullYear();
      const currentMonth = romanize(date.getMonth() + 1);

      // Get max running number
      const { data: maxData, error: maxErr } = await supabase
        .from("company_letters")
        .select("running_number")
        .eq("company", company)
        .eq("letter_type_id", typeId)
        .eq("year", currentYear)
        .order("running_number", { ascending: false })
        .limit(1);

      if (maxErr) throw maxErr;

      let nextNum = 1;
      if (maxData && maxData.length > 0) {
        nextNum = maxData[0].running_number + 1;
      }

      const paddedNum = nextNum.toString().padStart(3, "0");
      
      let compCode = "HR-TNT";
      if (company === "HYPE") compCode = "HR-HMI";
      else if (company === "GOAT") compCode = "HR-TSM";
      else if (company === "NOVA") compCode = "HR-NC";

      const fullNumber = `${paddedNum}/${type.code}/${compCode}/${currentMonth}/${currentYear}`;

      const insertData = {
        company,
        letter_type_id: typeId,
        running_number: nextNum,
        month: currentMonth,
        year: currentYear,
        full_number: fullNumber,
        issued_to: issuedTo || null,
      };

      const { error } = await supabase.from("company_letters").insert(insertData);
      if (error) throw error;

      toast.success(`Surat berhasil dibuat: ${fullNumber}`);
      onUpdate();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h2 className="text-lg font-black text-slate-800">Buat Nomor Surat</h2>
          <button onClick={onClose} className="p-2 bg-slate-100 text-slate-400 rounded-full hover:bg-slate-200 hover:text-slate-600 transition">
            <X size={16} />
          </button>
        </div>
        
        <form onSubmit={handleSave} className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Perusahaan</label>
            <select 
              value={company} onChange={e => setCompany(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-primary"
            >
              {COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tipe Surat</label>
            <select 
              value={typeId} onChange={e => setTypeId(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-primary"
            >
              {types.map(t => <option key={t.id} value={t.id}>{t.name} ({t.code})</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Diberikan Ke (Opsional)</label>
            <select 
              value={issuedTo} onChange={e => setIssuedTo(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-primary"
            >
              <option value="">-- Pilih Karyawan --</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
            </select>
          </div>

          <button disabled={saving} type="submit" className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:bg-primary/90 transition-all shadow-sm shadow-primary/20 disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus size={16} />}
            Generate Nomor Surat
          </button>
        </form>
      </div>
    </div>
  );
}
