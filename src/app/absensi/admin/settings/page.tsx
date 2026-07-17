"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import ConfirmDialog from "@/components/absensi/ConfirmDialog";
import { Clock, MapPin, CalendarDays, Settings, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface WorkSettings {
  workStart: string; workEnd: string; maxLate: string;
  maxTimeSick: string; maxTimeLeave: string; maxTimeWfa: string;
  officeLat: number; officeLng: number; officeRadius: number;
}

interface Holiday { id: string; date: string; description: string }
interface Department { id: string; name: string }

interface ConfirmCfg { title: string; message: string; type?: "danger" | "warning" | "info"; onConfirm: () => void }

const DEFAULT_SETTINGS: WorkSettings = {
  workStart: "08:00", workEnd: "18:00", maxLate: "08:15",
  maxTimeSick: "12:00", maxTimeLeave: "23:59", maxTimeWfa: "12:00",
  officeLat: -6.241586, officeLng: 106.628055, officeRadius: 100,
};

export default function AdminSettingsPage() {
  const [settings, setSettings]     = useState<WorkSettings>(DEFAULT_SETTINGS);
  const [holidays, setHolidays]     = useState<Holiday[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [newHol, setNewHol]         = useState({ date: "", description: "" });
  const [newDept, setNewDept]       = useState("");
  const [isLoading, setIsLoading]   = useState(true);
  const [confirmCfg, setConfirmCfg] = useState<ConfirmCfg | null>(null);

  useEffect(() => {
    const supabase = createClient();

    const fetchAll = async () => {
      const [sRes, hRes, dRes] = await Promise.all([
        supabase.from("absensi_settings").select("*").eq("id", 1).single(),
        supabase.from("holidays").select("id, date, description").order("date", { ascending: true }),
        supabase.from("departments").select("id, name").order("name"),
      ]);

      if (sRes.data) {
        const r = sRes.data as Record<string, unknown>;
        setSettings({
          workStart:    (r.work_start as string)  ?? DEFAULT_SETTINGS.workStart,
          workEnd:      (r.work_end as string)    ?? DEFAULT_SETTINGS.workEnd,
          maxLate:      (r.max_late as string)    ?? DEFAULT_SETTINGS.maxLate,
          maxTimeSick:  (r.max_time_sick as string) ?? DEFAULT_SETTINGS.maxTimeSick,
          maxTimeLeave: (r.max_time_leave as string) ?? DEFAULT_SETTINGS.maxTimeLeave,
          maxTimeWfa:   (r.max_time_wfa as string)  ?? DEFAULT_SETTINGS.maxTimeWfa,
          officeLat:    (r.office_lat as number)  ?? DEFAULT_SETTINGS.officeLat,
          officeLng:    (r.office_lng as number)  ?? DEFAULT_SETTINGS.officeLng,
          officeRadius: (r.office_radius as number) ?? DEFAULT_SETTINGS.officeRadius,
        });
      }
      setHolidays((hRes.data ?? []).map((h) => ({ id: h.id as string, date: h.date as string, description: h.description as string })));
      setDepartments((dRes.data ?? []).map((d) => ({ id: d.id as string, name: d.name as string })));
      setIsLoading(false);
    };

    fetchAll();
  }, []);

  const saveSettings = async () => {
    const supabase = createClient();
    const tid = toast.loading("Menyimpan pengaturan...");
    try {
      const { error } = await supabase.from("absensi_settings").update({
        work_start:    settings.workStart,
        work_end:      settings.workEnd,
        max_late:      settings.maxLate,
        max_time_sick: settings.maxTimeSick,
        max_time_leave: settings.maxTimeLeave,
        max_time_wfa:  settings.maxTimeWfa,
      }).eq("id", 1);
      if (error) throw error;
      toast.success("Pengaturan kerja berhasil disimpan.", { id: tid });
    } catch (err: unknown) {
      toast.error("Gagal: " + (err instanceof Error ? err.message : "Unknown"), { id: tid });
    }
  };

  const saveOffice = async () => {
    if (isNaN(settings.officeLat) || settings.officeLat < -90 || settings.officeLat > 90)
      return toast.error("Latitude harus antara -90 dan 90.");
    if (isNaN(settings.officeLng) || settings.officeLng < -180 || settings.officeLng > 180)
      return toast.error("Longitude harus antara -180 dan 180.");
    if (settings.officeRadius < 50)
      return toast.error("Radius minimal 50 meter.");

    const supabase = createClient();
    const tid = toast.loading("Memperbarui lokasi...");
    try {
      const { error } = await supabase.from("absensi_settings").update({
        office_lat: settings.officeLat,
        office_lng: settings.officeLng,
        office_radius: settings.officeRadius,
      }).eq("id", 1);
      if (error) throw error;
      toast.success("Konfigurasi lokasi berhasil diperbarui.", { id: tid });
    } catch (err: unknown) {
      toast.error("Gagal: " + (err instanceof Error ? err.message : "Unknown"), { id: tid });
    }
  };

  const addHoliday = async () => {
    if (!newHol.date || !newHol.description.trim()) return toast.error("Isi tanggal dan keterangan.");
    if (holidays.some((h) => h.date === newHol.date)) return toast.error("Tanggal libur ini sudah ada!");

    const supabase = createClient();
    const tid = toast.loading("Menambah hari libur...");
    try {
      const { data, error } = await supabase.from("holidays").insert({ date: newHol.date, description: newHol.description.trim() }).select().single();
      if (error) throw error;
      setHolidays((prev) => [...prev, { id: (data as Record<string, unknown>).id as string, date: newHol.date, description: newHol.description.trim() }].sort((a, b) => a.date.localeCompare(b.date)));
      setNewHol({ date: "", description: "" });
      toast.success("Hari libur ditambahkan.", { id: tid });
    } catch (err: unknown) {
      toast.error("Gagal: " + (err instanceof Error ? err.message : "Unknown"), { id: tid });
    }
  };

  const deleteHoliday = (id: string, date: string) => {
    setConfirmCfg({
      title: "Hapus Hari Libur",
      message: `Yakin hapus tanggal libur ${date}?`,
      type: "danger",
      onConfirm: async () => {
        const supabase = createClient();
        const tid = toast.loading("Menghapus...");
        try {
          const { error } = await supabase.from("holidays").delete().eq("id", id);
          if (error) throw error;
          setHolidays((prev) => prev.filter((h) => h.id !== id));
          toast.success("Berhasil dihapus.", { id: tid });
        } catch (err: unknown) {
          toast.error("Gagal: " + (err instanceof Error ? err.message : "Unknown"), { id: tid });
        } finally { setConfirmCfg(null); }
      },
    });
  };

  const addDepartment = async () => {
    if (!newDept.trim()) return;
    const supabase = createClient();
    const tid = toast.loading("Menambah departemen...");
    try {
      const { data, error } = await supabase.from("departments").insert({ name: newDept.trim() }).select().single();
      if (error) throw error;
      setDepartments((prev) => [...prev, { id: (data as Record<string, unknown>).id as string, name: newDept.trim() }]);
      setNewDept("");
      toast.success("Departemen ditambahkan.", { id: tid });
    } catch (err: unknown) {
      toast.error("Gagal: " + (err instanceof Error ? err.message : "Unknown"), { id: tid });
    }
  };

  const deleteDepartment = (id: string, name: string) => {
    setConfirmCfg({
      title: "Hapus Departemen",
      message: `Yakin hapus departemen "${name}"? Staf yang terdaftar di departemen ini akan kehilangan department-nya.`,
      type: "danger",
      onConfirm: async () => {
        const supabase = createClient();
        const tid = toast.loading("Menghapus...");
        try {
          const { error } = await supabase.from("departments").delete().eq("id", id);
          if (error) throw error;
          setDepartments((prev) => prev.filter((d) => d.id !== id));
          toast.success("Berhasil dihapus.", { id: tid });
        } catch (err: unknown) {
          toast.error("Gagal: " + (err instanceof Error ? err.message : "Unknown"), { id: tid });
        } finally { setConfirmCfg(null); }
      },
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-8 pb-24 animate-pulse">
        <div className="h-8 w-64 bg-[var(--ab-bg-surface)] rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-64 bg-[var(--ab-bg-surface)] rounded-[30px]" />)}
        </div>
      </div>
    );
  }

  const inputCls = "w-full ab-input text-sm font-bold";
  const sectionCls = "ab-card-tactile space-y-6";
  const labelCls = "block text-[10px] font-black text-[var(--ab-text-dim)] uppercase tracking-widest mb-1.5";

  return (
    <div className="space-y-8 pb-24">
      <h1 className="text-2xl font-black text-[var(--ab-text-main)] uppercase tracking-tight">Pengaturan Global Sistem</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Jam Kerja */}
        <div className={sectionCls}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "#d1fae520", color: "#059669", border: "1px solid #a7f3d0" }}>
              <Clock size={16} />
            </div>
            <h3 className="font-black text-[var(--ab-text-main)] uppercase tracking-wider text-sm">Jam Operasional</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Mulai Kerja</label>
              <input type="time" value={settings.workStart} onChange={(e) => setSettings({ ...settings, workStart: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Akhir Kerja</label>
              <input type="time" value={settings.workEnd} onChange={(e) => setSettings({ ...settings, workEnd: e.target.value })} className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Batas Toleransi Telat</label>
              <input type="time" value={settings.maxLate} onChange={(e) => setSettings({ ...settings, maxLate: e.target.value })} className={`${inputCls} text-red-500`} />
            </div>
          </div>
          <button onClick={saveSettings} className="ab-nm-button ab-btn-primary w-full py-3 text-xs font-black uppercase tracking-widest">
            Simpan Pengaturan
          </button>
        </div>

        {/* Batas Waktu Pengajuan */}
        <div className={sectionCls}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "#ede9fe20", color: "#7c3aed", border: "1px solid #c4b5fd" }}>
              <Settings size={16} />
            </div>
            <h3 className="font-black text-[var(--ab-text-main)] uppercase tracking-wider text-sm">Batas Jam Pengajuan</h3>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Cuti", key: "maxTimeLeave" as const },
              { label: "Sakit", key: "maxTimeSick" as const },
              { label: "WFA",   key: "maxTimeWfa"   as const },
            ].map(({ label, key }) => (
              <div key={key}>
                <label className={`${labelCls} text-center`}>{label}</label>
                <input type="time" value={settings[key]} onChange={(e) => setSettings({ ...settings, [key]: e.target.value })} className={`${inputCls} text-center`} />
              </div>
            ))}
          </div>
          <p className="text-[10px] text-[var(--ab-text-dim)] italic text-center">
            Staf tidak bisa mengajukan di hari H jika melewati jam di atas.
          </p>
          <button onClick={saveSettings} className="ab-nm-button w-full py-3 text-xs font-black uppercase tracking-widest border border-[var(--ab-border)] text-[var(--ab-text-main)]">
            Update Aturan Waktu
          </button>
        </div>

        {/* GPS */}
        <div className={sectionCls}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "#fee2e220", color: "#dc2626", border: "1px solid #fca5a5" }}>
              <MapPin size={16} />
            </div>
            <h3 className="font-black text-[var(--ab-text-main)] uppercase tracking-wider text-sm">Lokasi & Radius</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Latitude</label>
              <input type="number" step="any" value={settings.officeLat} onChange={(e) => setSettings({ ...settings, officeLat: parseFloat(e.target.value) })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Longitude</label>
              <input type="number" step="any" value={settings.officeLng} onChange={(e) => setSettings({ ...settings, officeLng: parseFloat(e.target.value) })} className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Radius Presensi (Meter)</label>
              <input type="number" value={settings.officeRadius} onChange={(e) => setSettings({ ...settings, officeRadius: parseInt(e.target.value) })} className={`${inputCls} text-[var(--ab-primary)] font-black`} />
            </div>
          </div>
          <button onClick={saveOffice} className="ab-nm-button w-full py-3 text-xs font-black uppercase tracking-widest bg-[var(--ab-text-main)] text-[var(--ab-bg-main)]">
            Update Konfigurasi GPS
          </button>
        </div>

        {/* Hari Libur */}
        <div className={sectionCls}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "#ffedd520", color: "#ea580c", border: "1px solid #fed7aa" }}>
              <CalendarDays size={16} />
            </div>
            <h3 className="font-black text-[var(--ab-text-main)] uppercase tracking-wider text-sm">Hari Libur Nasional</h3>
          </div>
          <div className="flex gap-2">
            <input type="date" value={newHol.date} onChange={(e) => setNewHol({ ...newHol, date: e.target.value })} className="ab-input text-xs" />
            <input
              type="text"
              placeholder="Keterangan..."
              value={newHol.description}
              onChange={(e) => setNewHol({ ...newHol, description: e.target.value })}
              onKeyDown={(e) => { if (e.key === "Enter") addHoliday(); }}
              className="ab-input flex-1 text-xs"
            />
            <button onClick={addHoliday} className="ab-nm-button w-10 h-10 rounded-xl flex items-center justify-center text-orange-500 border border-orange-200 dark:border-orange-800 hover:bg-orange-500 hover:text-white transition shrink-0">
              <Plus size={14} />
            </button>
          </div>
          <div className="overflow-y-auto max-h-[160px] space-y-2 ab-scrollbar pr-1">
            {holidays.length === 0 ? (
              <p className="text-center py-4 text-[10px] text-[var(--ab-text-dim)] uppercase font-black">Belum ada hari libur</p>
            ) : (
              holidays.map((h) => (
                <div key={h.id} className="flex justify-between items-center bg-[var(--ab-bg-main)] p-2.5 rounded-xl border border-[var(--ab-border)]">
                  <div className="text-[10px]">
                    <span className="font-black text-orange-600 mr-2">{h.date}</span>
                    <span className="text-[var(--ab-text-dim)]">{h.description}</span>
                  </div>
                  <button onClick={() => deleteHoliday(h.id, h.date)} className="text-red-400 hover:text-red-600 transition p-1">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Departemen */}
        <div className={`${sectionCls} lg:col-span-2`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "#ccfbf120", color: "#0d9488", border: "1px solid #99f6e4" }}>
              <Settings size={16} />
            </div>
            <h3 className="font-black text-[var(--ab-text-main)] uppercase tracking-wider text-sm">Manajemen Departemen</h3>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newDept}
              onChange={(e) => setNewDept(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addDepartment(); }}
              placeholder="Nama departemen baru..."
              className="ab-input flex-1 font-bold"
            />
            <button onClick={addDepartment} className="ab-nm-button ab-btn-primary px-6 py-3 text-xs font-black uppercase tracking-widest flex items-center gap-2">
              <Plus size={14} /> Tambah
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {departments.length === 0 ? (
              <p className="text-[10px] text-[var(--ab-text-dim)] uppercase font-black italic">Belum ada departemen</p>
            ) : (
              departments.map((d) => (
                <div key={d.id} className="bg-[var(--ab-bg-main)] border border-[var(--ab-border)] pl-4 pr-3 py-2 rounded-xl flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-[var(--ab-text-main)]">
                  {d.name}
                  <button onClick={() => deleteDepartment(d.id, d.name)} className="text-red-400 hover:text-red-600 transition">
                    <Trash2 size={10} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {confirmCfg && (
        <ConfirmDialog
          isOpen
          title={confirmCfg.title}
          message={confirmCfg.message}
          type={confirmCfg.type}
          onConfirm={confirmCfg.onConfirm}
          onCancel={() => setConfirmCfg(null)}
        />
      )}
    </div>
  );
}
