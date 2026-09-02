const fs = require('fs');

const path = 'src/app/absensi/admin/payroll/page.tsx';
let content = fs.readFileSync(path, 'utf8');

const targetUI = `
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-rose-400 tracking-widest">Potongan</label>
                        <input
                          type="number"
                          disabled={isPublished}
                          value={row.payroll.deductions || ""}
                          onChange={(e) => updateField(row.id, "deductions", Number(e.target.value))}
                          className="ab-input text-sm font-mono w-full py-2.5 disabled:opacity-40 border-rose-500/30"
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-rose-400 tracking-widest">Ket. Potongan</label>
                        <input
                          type="text"
                          disabled={isPublished}
                          value={row.payroll.deduction_notes || ""}
                          onChange={(e) => updateField(row.id, "deduction_notes", e.target.value)}
                          className="ab-input text-sm w-full py-2.5 disabled:opacity-40"
                          placeholder="BPJS, dll"
                        />
                      </div>
`;

const replacementUI = `
                      {/* Multi-Deduction UI */}
                      <div className="col-span-2 md:col-span-3 space-y-3 bg-rose-50/50 p-4 rounded-xl border border-rose-100">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-black uppercase text-rose-500 tracking-widest flex items-center gap-1.5">
                            Potongan
                            <span className="text-[9px] bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded-md">Total: {formatRp(row.payroll.deductions || 0)}</span>
                          </label>
                        </div>
                        
                        <div className="space-y-2">
                          {(row.payroll.deductions_detail || []).map((ded, idx) => (
                            <div key={idx} className="flex gap-2 items-center">
                              <input
                                type="text"
                                disabled={isPublished}
                                value={ded.name}
                                onChange={(e) => {
                                  const newList = [...(row.payroll.deductions_detail || [])];
                                  newList[idx].name = e.target.value;
                                  const total = newList.reduce((sum, item) => sum + (item.amount || 0), 0);
                                  setRows(prev => prev.map(r => r.id === row.id ? { ...r, payroll: { ...r.payroll, deductions_detail: newList, deductions: total, _dirty: true } } : r));
                                }}
                                className="ab-input text-xs w-1/2 py-2 disabled:opacity-40"
                                placeholder="Nama Potongan"
                              />
                              <input
                                type="number"
                                disabled={isPublished}
                                value={ded.amount || ""}
                                onChange={(e) => {
                                  const newList = [...(row.payroll.deductions_detail || [])];
                                  newList[idx].amount = Number(e.target.value);
                                  const total = newList.reduce((sum, item) => sum + (item.amount || 0), 0);
                                  setRows(prev => prev.map(r => r.id === row.id ? { ...r, payroll: { ...r.payroll, deductions_detail: newList, deductions: total, _dirty: true } } : r));
                                }}
                                className="ab-input text-xs font-mono w-1/2 py-2 disabled:opacity-40"
                                placeholder="0"
                              />
                              {!isPublished && (
                                <button
                                  onClick={() => {
                                    const newList = [...(row.payroll.deductions_detail || [])];
                                    newList.splice(idx, 1);
                                    const total = newList.reduce((sum, item) => sum + (item.amount || 0), 0);
                                    setRows(prev => prev.map(r => r.id === row.id ? { ...r, payroll: { ...r.payroll, deductions_detail: newList, deductions: total, _dirty: true } } : r));
                                  }}
                                  className="text-rose-400 hover:text-rose-600 p-1 bg-white border border-rose-100 hover:border-rose-300 rounded"
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>

                        {!isPublished && (
                          <div className="flex gap-2 items-center mt-2">
                            <select
                              className="ab-input text-xs py-1.5 flex-1 bg-white"
                              value=""
                              onChange={async (e) => {
                                const val = e.target.value;
                                if (!val) return;
                                
                                let finalName = val;
                                if (val === 'NEW') {
                                  const customName = prompt("Masukkan nama potongan baru:");
                                  if (!customName) return;
                                  finalName = customName;
                                  // Save new type to db
                                  const { data } = await supabase.from('payroll_deduction_types').insert({ name: customName }).select().single();
                                  if (data) {
                                    setDeductionTypes(prev => [...prev, data]);
                                  }
                                }

                                const newList = [...(row.payroll.deductions_detail || []), { name: finalName, amount: 0 }];
                                setRows(prev => prev.map(r => r.id === row.id ? { ...r, payroll: { ...r.payroll, deductions_detail: newList, _dirty: true } } : r));
                              }}
                            >
                              <option value="">-- Tambah Potongan --</option>
                              {deductionTypes.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                              <option value="NEW" className="font-bold text-rose-600">+ Tambah Potongan Baru</option>
                            </select>
                          </div>
                        )}
                      </div>
`;

content = content.replace(targetUI.trim(), replacementUI.trim());
fs.writeFileSync(path, content, 'utf8');
console.log('Done rewriting part 2 of page.tsx');
