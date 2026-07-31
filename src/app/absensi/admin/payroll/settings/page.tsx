"use client";

import React, { useState, useEffect } from 'react';
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Search, Save, Filter, Building2, Briefcase, Wallet, Car, StickyNote, User as UserIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type PayrollCompany = 'TNT' | 'Hype' | 'Nova';

interface PayrollStaffSetting {
  id?: string;
  user_id: string;
  contract_position: string | null;
  company: PayrollCompany | null;
  default_base_salary: number | null;
  default_mobility_allowance: number | null;
  notes: string | null;
}

interface User {
  id: string;
  name: string;
  email: string;
  departmentName?: string;
  departments?: { name: string };
}

export default function PayrollSettingsPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [settings, setSettings] = useState<Record<string, PayrollStaffSetting>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [companyFilter, setCompanyFilter] = useState<PayrollCompany | 'Semua'>('Semua');
  const [saving, setSaving] = useState<string | null>(null);
  
  const supabase = createClient();
  const { user: currentUser } = useAuth();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch active users (assuming all returned are active or apply a filter if needed)
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, name, email, department_id, departments(name)');
        
      if (usersError) throw usersError;
      
      // Transform users data
      const formattedUsers = (usersData as any[] || []).map((u: any) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        departmentName: u.departments?.name || 'Unknown'
      }));
      setUsers(formattedUsers);

      // Fetch settings
      const { data: settingsData, error: settingsError } = await supabase
        .from('payroll_staff_settings')
        .select('*');
        
      if (settingsError) throw settingsError;

      const settingsMap: Record<string, PayrollStaffSetting> = {};
      if (settingsData) {
        settingsData.forEach((s: any) => {
          settingsMap[s.user_id] = s as PayrollStaffSetting;
        });
      }
      setSettings(settingsMap);
    } catch (error: any) {
      toast.error('Gagal mengambil data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSettingChange = (userId: string, field: keyof PayrollStaffSetting, value: any) => {
    setSettings(prev => ({
      ...prev,
      [userId]: {
        ...(prev[userId] || { user_id: userId, contract_position: null, company: null, default_base_salary: null, default_mobility_allowance: null, notes: null }),
        [field]: value
      }
    }));
  };

  const saveSetting = async (userId: string) => {
    const setting = settings[userId];
    if (!setting) return;
    
    setSaving(userId);
    try {
      const payload = {
        user_id: userId,
        contract_position: setting.contract_position || '',
        company: setting.company || 'Nova',
        default_base_salary: setting.default_base_salary || 0,
        default_mobility_allowance: setting.default_mobility_allowance || 0,
        notes: setting.notes || '',
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('payroll_staff_settings')
        .upsert(payload as any, { onConflict: 'user_id' });
        
      if (error) throw error;
      toast.success('Pengaturan berhasil disimpan');
    } catch (error: any) {
      toast.error('Gagal menyimpan: ' + error.message);
    } finally {
      setSaving(null);
    }
  };

  const filteredUsers = users.filter(u => {
    const matchName = u.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCompany = companyFilter === 'Semua' || settings[u.id]?.company === companyFilter;
    return matchName && matchCompany;
  });

  const getCompanyColor = (company: string | null | undefined) => {
    switch(company) {
      case 'TNT': return '#00897B';
      case 'Hype': return '#E53935';
      case 'Nova': return '#1E88E5';
      default: return 'var(--ab-text-dim)';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2" style={{ borderColor: 'var(--ab-primary)' }}></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto ab-animate-fadeIn pb-24">
      <div className="mb-8">
        <h1 className="text-3xl font-black mb-2" style={{ color: 'var(--ab-text-main)' }}>PENGATURAN PAYROLL STAFF</h1>
        <p style={{ color: 'var(--ab-text-dim)' }}>Konfigurasi kontrak dan komponen gaji default karyawan.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={18} style={{ color: 'var(--ab-text-dim)' }} />
          </div>
          <input
            type="text"
            className="ab-input pl-10 w-full"
            placeholder="Cari nama karyawan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="relative w-full md:w-64">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Filter size={18} style={{ color: 'var(--ab-text-dim)' }} />
          </div>
          <select
            className="ab-input pl-10 w-full appearance-none"
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value as any)}
          >
            <option value="Semua">Semua Perusahaan</option>
            <option value="TNT">TNT</option>
            <option value="Hype">Hype</option>
            <option value="Nova">Nova</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredUsers.map(user => {
          const setting = settings[user.id] || { user_id: user.id, contract_position: '', company: null, default_base_salary: 0, default_mobility_allowance: 0, notes: '' };
          const companyColor = getCompanyColor(setting.company);
          const isSaving = saving === user.id;

          return (
            <div key={user.id} className="ab-card-tactile p-6 ab-animate-scaleIn flex flex-col h-full relative overflow-hidden">
              {setting.company && (
                <div 
                  className="absolute top-0 right-0 w-24 h-24 transform translate-x-12 -translate-y-12 rotate-45 opacity-20 transition-colors duration-300"
                  style={{ backgroundColor: companyColor }}
                />
              )}
              
              <div className="flex items-center gap-4 mb-6 z-10 relative">
                <div className="w-12 h-12 rounded-full flex items-center justify-center ab-glass" style={{ backgroundColor: 'var(--ab-bg-main)' }}>
                  <UserIcon size={24} style={{ color: 'var(--ab-primary)' }} />
                </div>
                <div>
                  <h3 className="font-black text-lg" style={{ color: 'var(--ab-text-main)' }}>{user.name}</h3>
                  <div className="text-xs uppercase tracking-widest font-bold" style={{ color: 'var(--ab-text-dim)' }}>
                    {user.departmentName}
                  </div>
                </div>
              </div>

              <div className="space-y-4 flex-1 z-10 relative">
                <div>
                  <label className="text-xs uppercase tracking-widest font-black mb-1 flex items-center gap-1" style={{ color: 'var(--ab-text-dim)' }}>
                    <Building2 size={12} /> Perusahaan
                  </label>
                  <select
                    className="ab-input w-full"
                    value={setting.company || ''}
                    onChange={(e) => handleSettingChange(user.id, 'company', e.target.value || null)}
                  >
                    <option value="">Pilih Perusahaan...</option>
                    <option value="TNT">TNT</option>
                    <option value="Hype">Hype</option>
                    <option value="Nova">Nova</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs uppercase tracking-widest font-black mb-1 flex items-center gap-1" style={{ color: 'var(--ab-text-dim)' }}>
                    <Briefcase size={12} /> Jabatan Kontrak
                  </label>
                  <input
                    type="text"
                    className="ab-input w-full"
                    placeholder="Contoh: Digital Marketing"
                    value={setting.contract_position || ''}
                    onChange={(e) => handleSettingChange(user.id, 'contract_position', e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-xs uppercase tracking-widest font-black mb-1 flex items-center gap-1" style={{ color: 'var(--ab-text-dim)' }}>
                    <Wallet size={12} /> Gaji Pokok Default
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-sm font-bold" style={{ color: 'var(--ab-text-dim)' }}>Rp</span>
                    </div>
                    <input
                      type="number"
                      className="ab-input w-full pl-10"
                      placeholder="0"
                      value={setting.default_base_salary === null || setting.default_base_salary === undefined ? '' : setting.default_base_salary}
                      onChange={(e) => handleSettingChange(user.id, 'default_base_salary', e.target.value ? parseInt(e.target.value) : 0)}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs uppercase tracking-widest font-black mb-1 flex items-center gap-1" style={{ color: 'var(--ab-text-dim)' }}>
                    <Car size={12} /> Tunj. Transport Default
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-sm font-bold" style={{ color: 'var(--ab-text-dim)' }}>Rp</span>
                    </div>
                    <input
                      type="number"
                      className="ab-input w-full pl-10"
                      placeholder="0"
                      value={setting.default_mobility_allowance === null || setting.default_mobility_allowance === undefined ? '' : setting.default_mobility_allowance}
                      onChange={(e) => handleSettingChange(user.id, 'default_mobility_allowance', e.target.value ? parseInt(e.target.value) : 0)}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs uppercase tracking-widest font-black mb-1 flex items-center gap-1" style={{ color: 'var(--ab-text-dim)' }}>
                    <StickyNote size={12} /> Catatan Khusus
                  </label>
                  <textarea
                    className="ab-input w-full min-h-[60px] resize-none ab-scrollbar"
                    placeholder="Catatan terkait payroll..."
                    value={setting.notes || ''}
                    onChange={(e) => handleSettingChange(user.id, 'notes', e.target.value)}
                  />
                </div>
              </div>

              <div className="mt-6 pt-4 border-t z-10 relative" style={{ borderColor: 'var(--ab-border)' }}>
                <button
                  className="ab-nm-button w-full flex justify-center items-center gap-2 py-3"
                  onClick={() => saveSetting(user.id)}
                  disabled={isSaving}
                  style={setting.company ? { color: companyColor, borderColor: companyColor } : {}}
                >
                  {isSaving ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2" style={{ borderColor: 'currentColor' }}></div>
                  ) : (
                    <>
                      <Save size={18} />
                      <span className="font-bold">SIMPAN PENGATURAN</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      
      {filteredUsers.length === 0 && (
        <div className="text-center py-12 ab-glass rounded-[30px] mt-6">
          <UserIcon size={48} className="mx-auto mb-4 opacity-20" style={{ color: 'var(--ab-text-main)' }} />
          <h3 className="text-lg font-black mb-2" style={{ color: 'var(--ab-text-main)' }}>Tidak ada karyawan</h3>
          <p style={{ color: 'var(--ab-text-dim)' }}>Coba sesuaikan filter pencarian.</p>
        </div>
      )}
    </div>
  );
}
