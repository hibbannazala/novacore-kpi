import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Plus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { saveAs } from "file-saver";
import type { LetterType } from "@/types";

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

export default function CreateModal({ types, onClose, onUpdate }: { types: LetterType[], onClose: () => void, onUpdate: () => void }) {
  const supabase = createClient() as any;
  const [company, setCompany] = useState<string>("TNT");
  const [typeId, setTypeId] = useState<string>("");
  const [issuedTo, setIssuedTo] = useState<string>("");
  const [users, setUsers] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  // Template parsing state
  const [variables, setVariables] = useState<string[]>([]);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [templateBlob, setTemplateBlob] = useState<ArrayBuffer | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [fullNumberPreview, setFullNumberPreview] = useState("");

  useEffect(() => {
    if (types.length > 0 && !typeId) setTypeId(types[0].id);
    supabase.from("users").select("id, name, role").order("name").then((res: any) => {
      if (res.data) setUsers(res.data);
    });
  }, [types]);

  // Handle template loading when type changes
  useEffect(() => {
    async function loadTemplate() {
      const type = types.find(t => t.id === typeId);
      if (!type || !type.template_url) {
        setVariables([]);
        setTemplateBlob(null);
        setFormData({});
        return;
      }

      setLoadingTemplate(true);
      try {
        const res = await fetch(type.template_url);
        const arrayBuffer = await res.arrayBuffer();
        setTemplateBlob(arrayBuffer);
        
        const zip = new PizZip(arrayBuffer);
        const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
        
        const text = doc.getFullText();
        const matches = text.match(/\{[^{}]+\}/g) || [];
        const uniqueVars = Array.from(new Set(matches.map(m => m.slice(1, -1))));
        
        setVariables(uniqueVars);
        const initialForm: Record<string, string> = {};
        uniqueVars.forEach(v => initialForm[v] = "");
        setFormData(initialForm);
      } catch (err) {
        console.error(err);
        toast.error("Gagal membaca variabel dari template");
      } finally {
        setLoadingTemplate(false);
      }
    }
    loadTemplate();
  }, [typeId]);

  // Preview full number
  useEffect(() => {
    async function getPreview() {
      if (!company || !typeId) return;
      const type = types.find(t => t.id === typeId);
      if (!type) return;

      const date = new Date();
      const currentYear = date.getFullYear();
      const currentMonth = romanize(date.getMonth() + 1);

      const { data: maxData } = await supabase
        .from("company_letters")
        .select("running_number")
        .eq("company", company)
        .eq("letter_type_id", typeId)
        .eq("year", currentYear)
        .order("running_number", { ascending: false })
        .limit(1);

      let nextNum = 1;
      if (maxData && maxData.length > 0) {
        nextNum = maxData[0].running_number + 1;
      }

      const paddedNum = nextNum.toString().padStart(3, "0");
      let compCode = "HR-TNT";
      if (company === "HYPE") compCode = "HR-HMI";
      else if (company === "GOAT") compCode = "HR-TSM";
      else if (company === "NOVA") compCode = "HR-NC";

      const preview = `${paddedNum}/${type.code}/${compCode}/${currentMonth}/${currentYear}`;
      setFullNumberPreview(preview);
      
      setFormData(prev => ({ ...prev, nomor_surat: preview }));
    }
    getPreview();
  }, [company, typeId]);

  // Auto-fill from user
  useEffect(() => {
    if (issuedTo) {
      const user = users.find(u => u.id === issuedTo);
      if (user) {
        setFormData(prev => ({
          ...prev,
          nama_karyawan: user.name,
          jabatan: user.role,
        }));
      }
    }
  }, [issuedTo, users]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!company || !typeId) return toast.error("Perusahaan dan Tipe wajib dipilih");
    
    setSaving(true);
    const toastId = toast.loading("Memproses surat...");
    
    try {
      const type = types.find(t => t.id === typeId);
      if (!type) throw new Error("Tipe surat tidak valid");

      const date = new Date();
      const currentYear = date.getFullYear();
      const currentMonth = romanize(date.getMonth() + 1);

      // Get exact next number securely at insertion time
      const { data: maxData } = await supabase
        .from("company_letters")
        .select("running_number")
        .eq("company", company)
        .eq("letter_type_id", typeId)
        .eq("year", currentYear)
        .order("running_number", { ascending: false })
        .limit(1);

      let nextNum = 1;
      if (maxData && maxData.length > 0) nextNum = maxData[0].running_number + 1;

      const paddedNum = nextNum.toString().padStart(3, "0");
      let compCode = "HR-TNT";
      if (company === "HYPE") compCode = "HR-HMI";
      else if (company === "GOAT") compCode = "HR-TSM";
      else if (company === "NOVA") compCode = "HR-NC";
      const actualFullNumber = `${paddedNum}/${type.code}/${compCode}/${currentMonth}/${currentYear}`;

      let generatedFileUrl = null;

      // If template exists, generate docx
      if (templateBlob) {
        // Ensure formData has the exact actual full number, not just preview
        const finalDataToRender = { ...formData, nomor_surat: actualFullNumber };
        
        const zip = new PizZip(templateBlob);
        const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
        
        doc.render(finalDataToRender);
        const out = doc.getZip().generate({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
        
        const fileName = `${type.code}_${paddedNum}_${issuedTo ? users.find(u => u.id === issuedTo)?.name : 'Surat'}_${Date.now()}.docx`.replace(/\s+/g, '_');
        
        // Upload to generated_letters
        const { error: uploadErr } = await supabase.storage
          .from('generated_letters')
          .upload(fileName, out);
        
        if (uploadErr) throw uploadErr;

        const { data: { publicUrl } } = supabase.storage
          .from('generated_letters')
          .getPublicUrl(fileName);
          
        generatedFileUrl = publicUrl;

        // Download to local
        saveAs(out, fileName);
      }

      const insertData = {
        company,
        letter_type_id: typeId,
        running_number: nextNum,
        month: currentMonth,
        year: currentYear,
        full_number: actualFullNumber,
        issued_to: issuedTo || null,
        file_url: generatedFileUrl,
      };

      const { error } = await supabase.from("company_letters").insert(insertData);
      if (error) throw error;

      toast.success(`Surat berhasil dibuat: ${actualFullNumber}`, { id: toastId });
      onUpdate();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan", { id: toastId });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
            <h2 className="text-lg font-black text-slate-800">Buat Nomor Surat Baru</h2>
            <p className="text-xs text-slate-500 font-medium mt-1">Preview Nomor: <span className="font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">{fullNumberPreview || '-'}</span></p>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-200 text-slate-500 rounded-full hover:bg-slate-300 hover:text-slate-700 transition">
            <X size={16} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          <form id="create-letter-form" onSubmit={handleSave} className="p-6 flex flex-col sm:flex-row gap-6">
            
            {/* Left Side: Basic Info */}
            <div className="flex-1 space-y-4">
              <h3 className="text-sm font-black text-slate-800 border-b border-slate-100 pb-2">Informasi Dasar</h3>
              
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
            </div>

            {/* Right Side: Template Variables (If any) */}
            <div className="flex-1 space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <h3 className="text-sm font-black text-slate-800 border-b border-slate-200 pb-2">Isian Template</h3>
              
              {loadingTemplate ? (
                <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin mb-2" />
                  <p className="text-xs font-semibold">Memuat variabel...</p>
                </div>
              ) : variables.length > 0 ? (
                <div className="space-y-3">
                  {variables.map(v => (
                    <div key={v} className="space-y-1">
                      <label className="text-xs font-bold text-slate-600 flex justify-between">
                        {v}
                        {v === 'nomor_surat' && <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold uppercase">Auto</span>}
                      </label>
                      <input
                        type="text"
                        value={formData[v] || ""}
                        onChange={e => setFormData({ ...formData, [v]: e.target.value })}
                        disabled={v === 'nomor_surat'} // Auto-filled
                        className={`w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-primary ${v === 'nomor_surat' ? 'bg-slate-200 text-slate-500 cursor-not-allowed' : 'bg-white'}`}
                        placeholder={`Isi ${v}...`}
                      />
                    </div>
                  ))}
                  <p className="text-[10px] text-slate-400 font-medium leading-relaxed mt-4">
                    Isian ini diambil otomatis dari tanda kurung kurawal pada file template DOCX.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-slate-400 text-center">
                  <p className="text-xs font-semibold mb-1">Tidak ada template DOCX.</p>
                  <p className="text-[10px]">Hanya akan membuat nomor urut surat di database.</p>
                </div>
              )}
            </div>

          </form>
        </div>
        
        <div className="p-6 border-t border-slate-100 bg-white">
          <button form="create-letter-form" disabled={saving || loadingTemplate} type="submit" className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:bg-primary/90 transition-all shadow-sm shadow-primary/20 disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus size={16} />}
            {variables.length > 0 ? "Generate & Download Surat" : "Buat Nomor Surat Saja"}
          </button>
        </div>
      </div>
    </div>
  );
}
