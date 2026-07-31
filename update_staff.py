import re

with open('src/app/absensi/admin/staff/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Imports
content = content.replace('import type { AbsensiStatus } from \"@/types\";', 'import type { AbsensiStatus, KpiRole } from \"@/types\";')
content = content.replace('from \"lucide-react\";', 'from \"lucide-react\";\nimport { Settings2, X } from \"lucide-react\";')

# 2. Interface
content = content.replace('  email: string;', '  email: string;\n  kpiRole: KpiRole;')

# 3. Query
content = content.replace('select(\"id, name, email, absensi_role, absensi_status', 'select(\"id, name, email, absensi_role, kpi_role, absensi_status')

# 4. allUsers map
content = content.replace('absensiRole: (r.absensi_role as \"staff\" | \"admin\") ?? \"staff\",', 'absensiRole: (r.absensi_role as \"staff\" | \"admin\") ?? \"staff\",\n        kpiRole: (r.kpi_role as KpiRole) ?? \"tim\",')

# 5. updatePayload
payload = '''      const updatePayload: {
        absensi_role?: "staff" | "admin";
        kpi_role?: string;
        leave_quota?: number;
        sick_quota?: number;
        is_hidden?: boolean;
        department_id?: string | null;
      } = {};
      if (edits.absensiRole    !== undefined) updatePayload.absensi_role    = edits.absensiRole;
      if (edits.kpiRole        !== undefined) updatePayload.kpi_role        = edits.kpiRole;'''
content = re.sub(r'const updatePayload: \{[\s\S]*?edits.absensiRole;', payload, content)

# 6. UI Roles
roles_ui = '''                <div className="flex gap-3">
                  <div className="flex-1 space-y-1">
                    <label className="text-[8px] font-black uppercase text-[var(--ab-text-dim)] tracking-widest ml-1">Divisi</label>
                    <select
                      value={getUserVal(u, "departmentId") ?? ""}
                      onChange={(e) => patchEdit(u.id, { departmentId: e.target.value || null })}
                      className="ab-input text-[10px] font-bold py-2 px-3"
                    >
                      <option value="">Pilih Divisi</option>
                      {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  <div className="w-24 space-y-1">
                    <label className="text-[8px] font-black uppercase text-[var(--ab-text-dim)] tracking-widest ml-1">KPI</label>
                    <select
                      value={getUserVal(u, "kpiRole")}
                      onChange={(e) => patchEdit(u.id, { kpiRole: e.target.value as KpiRole })}
                      className="ab-input text-[10px] font-bold py-2 px-3 text-center"
                    >
                      <option value="tim">Tim</option>
                      <option value="head">Head</option>
                      <option value="hr">HR</option>
                      <option value="executive">Executive</option>
                      <option value="developer">Dev</option>
                    </select>
                  </div>
                  <div className="w-24 space-y-1">
                    <label className="text-[8px] font-black uppercase text-[var(--ab-text-dim)] tracking-widest ml-1">Absensi</label>
                    <select
                      value={getUserVal(u, "absensiRole")}
                      onChange={(e) => patchEdit(u.id, { absensiRole: e.target.value as "staff" | "admin" })}
                      className="ab-input text-[10px] font-bold py-2 px-3 text-center"
                    >
                      <option value="staff">Staff</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>'''
content = re.sub(r'<div className="flex gap-3">[\s\S]*?<option value="admin">Admin</option>\s*</select>\s*</div>\s*</div>', roles_ui, content)

# 7. Button Add KPI settings
btn_ui = '''              <div className="flex flex-wrap gap-2 mt-4">
                <button
                  onClick={() => saveUser(u)}
                  disabled={!Object.keys(getEdit(u.id)).length}
                  className="flex-1 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all disabled:opacity-40 text-white"
                  style={{ background: "var(--ab-text-main)" }}
                >
                  Simpan Data
                </button>
                <button
                  className="flex-1 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all text-white flex items-center justify-center gap-2 shadow-lg"
                  style={{ background: "var(--ab-primary)", boxShadow: "0 4px 12px -3px var(--ab-primary-glow)" }}
                  onClick={() => handleSlipAbsen(u)}
                >
                  <RotateCcw size={10} /> Slip
                </button>
                <button
                  className="flex-1 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all text-[var(--ab-text-main)] flex items-center justify-center gap-2 border border-[var(--ab-border)] bg-[var(--ab-bg-main)]"
                  onClick={() => openKpiModal(u)}
                >
                  <Settings2 size={10} /> Bobot KPI
                </button>
              </div>'''
content = re.sub(r'<div className="flex flex-wrap gap-2">\s*<button[\s\S]*?</button>\s*</div>', btn_ui, content)

with open('src/app/absensi/admin/staff/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
