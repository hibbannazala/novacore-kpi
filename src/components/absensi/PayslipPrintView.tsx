"use client";

import React, { forwardRef } from 'react';
import { Printer } from 'lucide-react';

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
  notes
}, ref) => {
  const formatCurrency = (amount: number) => {
    return 'Rp ' + amount.toLocaleString('id-ID');
  };

  const thp = baseSalary + mobilityAllowance + performanceBonus + overtimePay - deductions;
  // Handle 1-12 based month index (most common for 'month' prop), fallback to string if out of bounds
  const monthIndex = month >= 1 && month <= 12 ? month - 1 : month;
  const monthName = MONTHS[monthIndex] || month;

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
        <div className="flex flex-col items-center text-center mb-8 border-b-2 pb-4" style={{ borderColor: COMPANY_COLORS[company] }}>
          <img 
            src={`/logos/${company.toLowerCase()}.png`} 
            alt={COMPANY_NAMES[company]} 
            className="h-16 mb-2 object-contain" 
          />
          <div className="text-sm font-medium text-gray-600 mb-4 space-y-0.5">
            {company === "TNT" && (
              <>
                <p className="font-bold text-gray-800">PT TNT Kreatif Digital, MCN & TAP Agency</p>
                <p>Official TikTok Shop Partner & MCN</p>
                <p>Email: hr.tntmedia@gmail.com</p>
              </>
            )}
            {company === "Nova" && (
              <>
                <p className="font-bold text-gray-800">PT Synera Kreatif Grup</p>
                <p>Official TikTok Shop Partner & MCN</p>
              </>
            )}
            {company === "Hype" && (
              <>
                <p className="font-bold text-gray-800">HYPE Media Indonesia</p>
                <p>Official TikTok GO Agency Partner</p>
                <p>Email: hypeprojectt@gmail.com</p>
              </>
            )}
          </div>
          <h1 className="text-2xl font-black uppercase tracking-widest mb-2" style={{ color: COMPANY_COLORS[company] }}>
            SLIP GAJI
          </h1>
        </div>

        {/* Employee Info */}
        <div className="grid grid-cols-2 gap-4 mb-10 text-base">
          <div>
            <div className="grid grid-cols-[140px_10px_1fr]">
              <span className="font-bold text-gray-700">Nama Karyawan</span>
              <span>:</span>
              <span className="font-semibold">{employeeName}</span>
            </div>
            <div className="grid grid-cols-[140px_10px_1fr] mt-2">
              <span className="font-bold text-gray-700">Bulan/Tahun</span>
              <span>:</span>
              <span className="font-semibold">{monthName} {year}</span>
            </div>
          </div>
          <div>
            <div className="grid grid-cols-[140px_10px_1fr]">
              <span className="font-bold text-gray-700">Jabatan</span>
              <span>:</span>
              <span className="font-semibold">{contractPosition}</span>
            </div>
          </div>
        </div>

        {/* Details Table */}
        <table className="w-full mb-10 text-base border-collapse border border-gray-400">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-400 p-3 text-left w-2/3 font-black">Uraian</th>
              <th className="border border-gray-400 p-3 text-right w-1/3 font-black">Nominal</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-400 p-3 font-semibold">Gaji Pokok</td>
              <td className="border border-gray-400 p-3 text-right">{formatCurrency(baseSalary)}</td>
            </tr>
            <tr>
              <td className="border border-gray-400 p-3 font-semibold">Tunj. Mobilitas</td>
              <td className="border border-gray-400 p-3 text-right">{formatCurrency(mobilityAllowance)}</td>
            </tr>
            <tr>
              <td className="border border-gray-400 p-3 font-semibold">Bonus Performa</td>
              <td className="border border-gray-400 p-3 text-right">{formatCurrency(performanceBonus)}</td>
            </tr>
            <tr>
              <td className="border border-gray-400 p-3 font-semibold">Upah Lembur</td>
              <td className="border border-gray-400 p-3 text-right">{formatCurrency(overtimePay)}</td>
            </tr>
            <tr>
              <td className="border border-gray-400 p-3 font-semibold">
                Potongan
                {deductions > 0 && deductionNotes && (
                  <div className="text-sm text-gray-600 italic mt-1 font-normal">*{deductionNotes}</div>
                )}
              </td>
              <td className="border border-gray-400 p-3 text-right">
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
            <p className="font-bold underline">{employeeName}</p>
            <p className="text-sm mt-1">{contractPosition}</p>
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
