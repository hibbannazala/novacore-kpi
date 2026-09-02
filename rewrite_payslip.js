const fs = require('fs');

const path = 'src/components/absensi/PayslipPrintView.tsx';
let content = fs.readFileSync(path, 'utf8');

// Update Props
content = content.replace(
  'notes?: string | null;\n}',
  'notes?: string | null;\n  snapshotName?: string | null;\n  snapshotPosition?: string | null;\n  snapshotCompany?: string | null;\n  deductionsDetail?: Array<{name: string, amount: number}> | null;\n}'
);

// Update destructuring
content = content.replace(
  'deductionNotes,\n  notes\n}, ref)',
  'deductionNotes,\n  notes,\n  snapshotName,\n  snapshotPosition,\n  snapshotCompany,\n  deductionsDetail\n}, ref)'
);

// Update logic to prefer snapshot
content = content.replace(
  'const thp = baseSalary + mobilityAllowance + performanceBonus + overtimePay - deductions;',
  `const thp = baseSalary + mobilityAllowance + performanceBonus + overtimePay - deductions;
  const finalName = snapshotName || employeeName;
  const finalPosition = snapshotPosition || contractPosition;
  const finalCompany = (snapshotCompany as 'TNT'|'Hype'|'Nova') || company;`
);

// Update COMPANY_COLORS[company] to finalCompany
content = content.replace(/COMPANY_COLORS\[company\]/g, 'COMPANY_COLORS[finalCompany]');
content = content.replace(/COMPANY_NAMES\[company\]/g, 'COMPANY_NAMES[finalCompany]');
content = content.replace(/\$\{company\.toLowerCase\(\)\}/g, '${finalCompany.toLowerCase()}');
content = content.replace(/company === "TNT"/g, 'finalCompany === "TNT"');
content = content.replace(/company === "Nova"/g, 'finalCompany === "Nova"');
content = content.replace(/company === "Hype"/g, 'finalCompany === "Hype"');

// Update Info rendering (employeeName -> finalName, contractPosition -> finalPosition)
content = content.replace(/\{employeeName\}/g, '{finalName}');
content = content.replace(/\{contractPosition\}/g, '{finalPosition}');

// Fix Jabatan spacing
content = content.replace(
  '<div className="grid grid-cols-[140px_10px_1fr]">\n              <span className="font-bold text-gray-700">Jabatan</span>',
  '<div className="grid grid-cols-[auto_10px_1fr] md:grid-cols-[80px_10px_1fr] gap-x-2">\n              <span className="font-bold text-gray-700">Jabatan</span>'
);
content = content.replace(
  '<div className="grid grid-cols-[140px_10px_1fr]">\n              <span className="font-bold text-gray-700">Nama Karyawan</span>',
  '<div className="grid grid-cols-[auto_10px_1fr] md:grid-cols-[140px_10px_1fr] gap-x-2">\n              <span className="font-bold text-gray-700">Nama Karyawan</span>'
);
content = content.replace(
  '<div className="grid grid-cols-[140px_10px_1fr] mt-2">\n              <span className="font-bold text-gray-700">Bulan/Tahun</span>',
  '<div className="grid grid-cols-[auto_10px_1fr] md:grid-cols-[140px_10px_1fr] gap-x-2 mt-2">\n              <span className="font-bold text-gray-700">Bulan/Tahun</span>'
);

// Text updates
content = content.replace('<th className="border border-gray-400 p-3 text-left w-2/3 font-black">Uraian</th>', '<th className="border border-gray-400 p-3 text-left w-2/3 font-black">Rincian</th>');
content = content.replace('<td className="border border-gray-400 p-3 font-semibold">Tunj. Mobilitas</td>', '<td className="border border-gray-400 p-3 font-semibold">Allowance</td>');

// Multi-deductions table rows
const deductionsTableHtml = `
            {/* Multi-deduction handling */}
            {deductionsDetail && deductionsDetail.length > 0 ? (
              deductionsDetail.map((ded, idx) => (
                <tr key={idx}>
                  <td className="border border-gray-400 p-3 font-semibold text-rose-700">
                    Potongan: {ded.name}
                  </td>
                  <td className="border border-gray-400 p-3 text-right text-rose-700">
                    {ded.amount > 0 ? \`(\${formatCurrency(ded.amount)})\` : formatCurrency(0)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="border border-gray-400 p-3 font-semibold">
                  Potongan
                  {deductions > 0 && deductionNotes && (
                    <div className="text-sm text-gray-600 italic mt-1 font-normal">*{deductionNotes}</div>
                  )}
                </td>
                <td className="border border-gray-400 p-3 text-right">
                  {deductions > 0 ? \`(\${formatCurrency(deductions)})\` : formatCurrency(0)}
                </td>
              </tr>
            )}
`;

content = content.replace(/<tr>\s*<td className="border border-gray-400 p-3 font-semibold">\s*Potongan[\s\S]*?<\/tr>/, deductionsTableHtml.trim());

fs.writeFileSync(path, content, 'utf8');
console.log('Done rewriting PayslipPrintView.tsx');
