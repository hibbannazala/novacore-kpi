"use client";

import React, { forwardRef } from 'react';
import { Printer } from 'lucide-react';
import type { PayrollOvertimeDetailItem } from '@/types';

interface PayslipPrintViewProps {
  employeeName: string;
  contractPosition: string;
  company: 'TNT' | 'Hype' | 'Nova';
  month: number;
  year: number;
  baseSalary: number;
  mobilityAllowance: number;
  performanceBonus: number;
  overtimePay: number;
  deductions: number;
  deductionNotes?: string;
  notes?: string | null;
  snapshotName?: string | null;
  snapshotPosition?: string | null;
  snapshotCompany?: string | null;
  deductionsDetail?: Array<{name: string, amount: number, note?: string}> | null;
  additionsDetail?: Array<{name: string, amount: number, note?: string}> | null;
  overtimeNotes?: string | null;
  overtimeDetail?: PayrollOvertimeDetailItem[] | null;
}

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const COMPANY_NAMES = {
  TNT: 'PT. TNT Kreatif',
  Hype: 'PT. Hype Creative',
  Nova: 'PT. Nova Digital',
};

const COMPANY_COLORS = {
  TNT: '#00897B',
  Hype: '#E53935',
  Nova: '#1E88E5',
};

export const PayslipPrintView = forwardRef<HTMLDivElement, PayslipPrintViewProps>(({
  employeeName,
  contractPosition,
  company,
  month,
  year,
  baseSalary,
  mobilityAllowance,
  performanceBonus,
  overtimePay,
  deductions,
  deductionNotes,
  notes,
  snapshotName,
  snapshotPosition,
  snapshotCompany,
  deductionsDetail,
  additionsDetail,
  overtimeNotes,
  overtimeDetail,
}, ref) => {
  const formatCurrency = (amount: number) => {
    return 'Rp ' + amount.toLocaleString('id-ID');
  };

  const additionsTotal = (additionsDetail || []).reduce((sum, item) => sum + item.amount, 0);
  const thp = baseSalary + mobilityAllowance + performanceBonus + overtimePay + additionsTotal - deductions;
  const finalName = snapshotName || employeeName;
  const finalPosition = snapshotPosition || contractPosition;
  const finalCompany = (snapshotCompany as 'TNT'|'Hype'|'Nova') || company;
  // Handle 1-12 based month index (most common for 'month' prop), fallback to string if out of bounds
  const monthIndex = month >= 1 && month <= 12 ? month - 1 : month;
  const monthName = MONTHS[monthIndex] || month;

  // Overtime sessions processing
  const sortedSessions = (overtimeDetail || []).slice().sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const hasMultipleSessions = sortedSessions.length > 1;
  const totalOvertimeMins = sortedSessions.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
  const totalOtHours = Math.floor(totalOvertimeMins / 60);
  const totalOtRemainingMins = totalOvertimeMins % 60;
  const totalOtHoursStr = `${totalOtHours} Jam ${totalOtRemainingMins > 0 ? `${totalOtRemainingMins} Menit` : ""}`.trim();

  const formatSessionDate = (dateStr: string) => {
    try {
      const parts = dateStr.split("-");
      if (parts.length === 3) {
        const d = parseInt(parts[2], 10);
        const m = parseInt(parts[1], 10);
        const y = parts[0];
        const mName = MONTHS[m - 1] || parts[1];
        return `${d} ${mName} ${y}`;
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="w-full flex flex-col items-center ab-animate-fadeIn">
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #print-section, #print-section * {
            visibility: visible;
          }
          #print-section {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            border: none !important;
            box-shadow: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
      
      <div 
        id="print-section" 
        ref={ref}
        className="bg-white text-black p-10 mx-auto shadow-sm rounded-none border border-gray-200 shrink-0"
        style={{ fontFamily: 'Arial, sans-serif', width: '210mm', minHeight: '297mm' }}
      >
        {/* Header */}
        <div className="flex flex-col items-center text-center mb-8 border-b-2 pb-4" style={{ borderColor: COMPANY_COLORS[finalCompany] }}>
          <img 
            src={`/logos/${finalCompany.toLowerCase()}.png`} 
            alt={COMPANY_NAMES[finalCompany]} 
            className="h-16 mb-2 object-contain" 
          />
          <div className="text-sm font-medium text-gray-600 mb-4 space-y-0.5">
            {finalCompany === "TNT" && (
              <>
                <p className="font-bold text-gray-800">PT TNT Kreatif Digital, MCN & TAP Agency</p>
                <p>Official TikTok Shop Partner & MCN</p>
                <p>Email: hr.tntmedia@gmail.com</p>
              </>
            )}
            {finalCompany === "Nova" && (
              <>
                <p className="font-bold text-gray-800">PT Synera Kreatif Grup</p>
                <p>Official TikTok Shop Partner & MCN</p>
              </>
            )}
            {finalCompany === "Hype" && (
              <>
                <p className="font-bold text-gray-800">HYPE Media Indonesia</p>
                <p>Official TikTok GO Agency Partner</p>
                <p>Email: hypeprojectt@gmail.com</p>
              </>
            )}
          </div>
          <h1 className="text-2xl font-black uppercase tracking-widest mb-2" style={{ color: COMPANY_COLORS[finalCompany] }}>
            SLIP GAJI
          </h1>
        </div>

        {/* Employee Info */}
        <div className="grid grid-cols-2 gap-4 mb-10 text-base">
          <div>
            <div className="grid grid-cols-[auto_10px_1fr] md:grid-cols-[140px_10px_1fr] gap-x-2">
              <span className="font-bold text-gray-700">Nama Karyawan</span>
              <span>:</span>
              <span className="font-semibold">{finalName}</span>
            </div>
            <div className="grid grid-cols-[auto_10px_1fr] md:grid-cols-[140px_10px_1fr] gap-x-2 mt-2">
              <span className="font-bold text-gray-700">Bulan/Tahun</span>
              <span>:</span>
              <span className="font-semibold">{monthName} {year}</span>
            </div>
          </div>
          <div>
            <div className="grid grid-cols-[auto_10px_1fr] md:grid-cols-[80px_10px_1fr] gap-x-2">
              <span className="font-bold text-gray-700">Jabatan</span>
              <span>:</span>
              <span className="font-semibold">{finalPosition}</span>
            </div>
          </div>
        </div>

        {/* Details Table */}
        <table className="w-full mb-10 text-base border-collapse border border-gray-400">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-400 p-3 text-left w-2/3 font-black">Rincian</th>
              <th className="border border-gray-400 p-3 text-right w-1/3 font-black">Nominal</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-400 p-3 font-semibold">Gaji Pokok</td>
              <td className="border border-gray-400 p-3 text-right">{formatCurrency(baseSalary)}</td>
            </tr>
            <tr>
              <td className="border border-gray-400 p-3 font-semibold">Allowance</td>
              <td className="border border-gray-400 p-3 text-right">{formatCurrency(mobilityAllowance)}</td>
            </tr>
            <tr>
              <td className="border border-gray-400 p-3 font-semibold">Bonus Performa</td>
              <td className="border border-gray-400 p-3 text-right">{formatCurrency(performanceBonus)}</td>
            </tr>
            <tr>
              <td colSpan={2} className="border border-gray-400 p-3">
                <span className="font-semibold block mb-2">Upah Lembur</span>
                {sortedSessions.length > 0 ? (
                  <div className="space-y-2">
                    <table className="w-full text-xs border-collapse border border-gray-300">
                      <thead>
                        <tr className="bg-gray-100 text-gray-800">
                          <th className="border border-gray-300 px-2 py-1.5 text-left font-bold">Tanggal Lembur</th>
                          <th className="border border-gray-300 px-2 py-1.5 text-center font-bold">Total Jam Lembur</th>
                          <th className="border border-gray-300 px-2 py-1.5 text-right font-bold">Nominal Total Lembur</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedSessions.map((ot, idx) => {
                          const mins = ot.durationMinutes || 0;
                          const h = Math.floor(mins / 60);
                          const m = mins % 60;
                          const durationStr = ot.hoursFormatted || `${h} Jam ${m > 0 ? `${m} Menit` : ""}`.trim();

                          return (
                            <tr key={idx}>
                              <td className="border border-gray-300 px-2 py-1.5">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span>{formatSessionDate(ot.date)}</span>
                                  {ot.dayType === "weekend" && (
                                    <span className="text-[9px] text-purple-700 bg-purple-50 px-1 rounded border border-purple-200 font-medium">
                                      Weekend
                                    </span>
                                  )}
                                  {ot.dayType === "holiday" && (
                                    <span className="text-[9px] text-rose-700 bg-rose-50 px-1 rounded border border-rose-200 font-medium">
                                      Libur
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="border border-gray-300 px-2 py-1.5 text-center font-mono">{durationStr}</td>
                              <td className="border border-gray-300 px-2 py-1.5 text-right font-mono font-medium">{formatCurrency(ot.pay || 0)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-gray-100 font-bold">
                          <td colSpan={2} className="border border-gray-300 px-2 py-1.5 text-right font-bold text-gray-800">
                            Total Upah Lembur
                          </td>
                          <td className="border border-gray-300 px-2 py-1.5 text-right font-mono font-bold text-gray-900">
                            {formatCurrency(overtimePay)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                    {overtimeNotes && (
                      <div className="text-[11px] text-gray-500 italic mt-1 whitespace-pre-wrap leading-tight">
                        Catatan: {overtimeNotes}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex justify-between items-center">
                    <div>
                      {overtimeNotes && (
                        <div className="text-xs text-gray-600 italic whitespace-pre-wrap leading-tight">
                          Catatan: {overtimeNotes}
                        </div>
                      )}
                    </div>
                    <span className="font-semibold text-right">{formatCurrency(overtimePay)}</span>
                  </div>
                )}
              </td>
            </tr>
            {/* Multi-addition handling */}
            {additionsDetail && additionsDetail.length > 0 && (
              <tr>
                <td className="border border-gray-400 p-3">
                  <span className="font-semibold block mb-1">Upah Tambahan Lainnya</span>
                  <div className="ml-2 mb-1 space-y-0.5">
                    {additionsDetail.map((add, idx) => (
                      <div key={idx} className="mb-2 last:mb-0">
                        <div className="text-sm">- {add.name} {add.amount > 0 ? `(${formatCurrency(add.amount)})` : ''}</div>
                        {add.note && <div className="text-[11px] text-gray-500 italic whitespace-pre-wrap ml-3 leading-tight">{add.note}</div>}
                      </div>
                    ))}
                  </div>
                </td>
                <td className="border border-gray-400 p-3 text-right">
                  {formatCurrency(additionsTotal)}
                </td>
              </tr>
            )}
            {/* Multi-deduction handling */}
            <tr>
              <td className="border border-gray-400 p-3 text-rose-700">
                <span className="font-semibold block mb-1">Potongan</span>
                {deductionsDetail && deductionsDetail.length > 0 && (
                  <div className="ml-2 mb-1 space-y-0.5">
                    {deductionsDetail.map((ded, idx) => (
                      <div key={idx} className="mb-2 last:mb-0">
                        <div className="text-sm">- {ded.name} {ded.amount > 0 ? `(${formatCurrency(ded.amount)})` : ''}</div>
                        {ded.note && <div className="text-[11px] text-gray-500 italic whitespace-pre-wrap ml-3 leading-tight">{ded.note}</div>}
                      </div>
                    ))}
                  </div>
                )}
                {deductions > 0 && deductionNotes && (
                  <div className="text-sm text-gray-600 italic mt-1 whitespace-pre-wrap leading-tight">{deductionNotes}</div>
                )}
              </td>
              <td className="border border-gray-400 p-3 text-right text-rose-700">
                {deductions > 0 ? `(${formatCurrency(deductions)})` : formatCurrency(0)}
              </td>
            </tr>
          </tbody>
          <tfoot>
            {notes && (
              <tr>
                <td colSpan={2} className="border border-gray-400 p-3 italic text-gray-700 bg-gray-50 whitespace-pre-wrap text-sm">
                  <span className="font-semibold block mb-1 not-italic text-black">Catatan:</span>
                  {notes}
                </td>
              </tr>
            )}
            <tr className="bg-gray-100">
              <td className="border border-gray-400 p-3 text-right font-black uppercase tracking-widest text-sm">Total Diterima</td>
              <td className="border border-gray-400 p-3 text-right font-black">{formatCurrency(thp)}</td>
            </tr>
          </tfoot>
        </table>

        {/* Signature */}
        <div className="flex justify-end mt-16 text-base text-center">
          <div className="w-56">
            <p className="mb-20 font-semibold">Penerima,</p>
            <p className="font-bold underline">{finalName}</p>
            <p className="text-sm mt-1">{finalPosition}</p>
          </div>
        </div>
      </div>

      <button
        onClick={() => window.print()}
        className="no-print mt-8 mb-8 flex items-center justify-center gap-3 px-8 py-4 bg-[var(--ab-primary)] hover:bg-[var(--ab-primary-glow)] text-white rounded-2xl transition-all shadow-lg ab-nm-button"
      >
        <Printer size={22} />
        <span className="font-black uppercase tracking-widest text-sm">Cetak / Download PDF</span>
      </button>
    </div>
  );
});

PayslipPrintView.displayName = 'PayslipPrintView';
