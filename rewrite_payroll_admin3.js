const fs = require('fs');

const path = 'src/app/absensi/admin/payroll/page.tsx';
let content = fs.readFileSync(path, 'utf8');

const targetPreviewDeductions = `
                    {(previewRow.payroll.deductions || 0) > 0 && (
                      <tr className="border-b border-slate-100 text-rose-600">
                        <td className="py-2 font-medium">
                          Potongan
                          {previewRow.payroll.deduction_notes && (
                            <span className="text-[9px] text-slate-400 ml-2">({previewRow.payroll.deduction_notes})</span>
                          )}
                        </td>
                        <td className="py-2 text-right font-mono font-bold">({formatRp(previewRow.payroll.deductions || 0)})</td>
                      </tr>
                    )}
`;

const replacePreviewDeductions = `
                    {previewRow.payroll.deductions_detail && previewRow.payroll.deductions_detail.length > 0 ? (
                      previewRow.payroll.deductions_detail.map((ded, idx) => (
                        <tr key={idx} className="border-b border-slate-100 text-rose-600">
                          <td className="py-2 font-medium">Potongan: {ded.name}</td>
                          <td className="py-2 text-right font-mono font-bold">{ded.amount > 0 ? \`(\${formatRp(ded.amount)})\` : formatRp(0)}</td>
                        </tr>
                      ))
                    ) : (
                      (previewRow.payroll.deductions || 0) > 0 && (
                        <tr className="border-b border-slate-100 text-rose-600">
                          <td className="py-2 font-medium">
                            Potongan
                            {previewRow.payroll.deduction_notes && (
                              <span className="text-[9px] text-slate-400 ml-2">({previewRow.payroll.deduction_notes})</span>
                            )}
                          </td>
                          <td className="py-2 text-right font-mono font-bold">({formatRp(previewRow.payroll.deductions || 0)})</td>
                        </tr>
                      )
                    )}
`;

content = content.replace(targetPreviewDeductions.trim(), replacePreviewDeductions.trim());
fs.writeFileSync(path, content, 'utf8');
console.log('Done rewriting preview modal logic in page.tsx');
