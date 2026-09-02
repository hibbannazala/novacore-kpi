const fs = require('fs');

const path = 'src/app/absensi/admin/payroll/page.tsx';
let content = fs.readFileSync(path, 'utf8');

const targetDropdown = `
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
`;

const replaceDropdown = `
                          {!isPublished && (
                            <div className="flex flex-col gap-2 mt-2">
                              {addingDeductionFor === row.id ? (
                                <div className="flex gap-2 items-center">
                                  <input 
                                    autoFocus
                                    type="text" 
                                    className="ab-input text-xs py-1.5 flex-1 bg-white"
                                    placeholder="Ketik nama potongan..."
                                    value={newCustomDeduction}
                                    onChange={e => setNewCustomDeduction(e.target.value)}
                                    onKeyDown={async (e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        if (!newCustomDeduction.trim()) return;
                                        const finalName = newCustomDeduction.trim();
                                        // Save to DB
                                        const { data } = await supabase.from('payroll_deduction_types').insert({ name: finalName }).select().single();
                                        if (data) setDeductionTypes(prev => [...prev, data]);
                                        
                                        const newList = [...(row.payroll.deductions_detail || []), { name: finalName, amount: 0 }];
                                        setRows(prev => prev.map(r => r.id === row.id ? { ...r, payroll: { ...r.payroll, deductions_detail: newList, _dirty: true } } : r));
                                        setAddingDeductionFor(null);
                                        setNewCustomDeduction("");
                                      } else if (e.key === 'Escape') {
                                        setAddingDeductionFor(null);
                                        setNewCustomDeduction("");
                                      }
                                    }}
                                  />
                                  <button 
                                    className="px-3 py-1.5 bg-rose-500 text-white text-xs rounded-md font-bold hover:bg-rose-600"
                                    onClick={async () => {
                                      if (!newCustomDeduction.trim()) return;
                                      const finalName = newCustomDeduction.trim();
                                      const { data } = await supabase.from('payroll_deduction_types').insert({ name: finalName }).select().single();
                                      if (data) setDeductionTypes(prev => [...prev, data]);
                                      const newList = [...(row.payroll.deductions_detail || []), { name: finalName, amount: 0 }];
                                      setRows(prev => prev.map(r => r.id === row.id ? { ...r, payroll: { ...r.payroll, deductions_detail: newList, _dirty: true } } : r));
                                      setAddingDeductionFor(null);
                                      setNewCustomDeduction("");
                                    }}
                                  >OK</button>
                                  <button 
                                    className="px-2 py-1.5 bg-gray-100 text-gray-500 text-xs rounded-md hover:bg-gray-200"
                                    onClick={() => {
                                      setAddingDeductionFor(null);
                                      setNewCustomDeduction("");
                                    }}
                                  >Batal</button>
                                </div>
                              ) : (
                                <select
                                  className="ab-input text-xs py-1.5 flex-1 bg-white"
                                  value=""
                                  onChange={async (e) => {
                                    const val = e.target.value;
                                    if (!val) return;
                                    
                                    if (val === 'NEW') {
                                      setAddingDeductionFor(row.id);
                                      setNewCustomDeduction("");
                                      return;
                                    }
    
                                    const newList = [...(row.payroll.deductions_detail || []), { name: val, amount: 0 }];
                                    setRows(prev => prev.map(r => r.id === row.id ? { ...r, payroll: { ...r.payroll, deductions_detail: newList, _dirty: true } } : r));
                                  }}
                                >
                                  <option value="">-- Tambah Potongan --</option>
                                  {deductionTypes.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                                  <option value="NEW" className="font-bold text-rose-600">+ Tambah Potongan Baru</option>
                                </select>
                              )}
                            </div>
                          )}
`;

content = content.replace(targetDropdown.trim(), replaceDropdown.trim());

// We also need to add state for addingDeductionFor and newCustomDeduction
const stateString = `    const [newDeductionName, setNewDeductionName] = useState("");`;
const stateReplacement = `    const [newDeductionName, setNewDeductionName] = useState("");
    const [addingDeductionFor, setAddingDeductionFor] = useState<string | null>(null);
    const [newCustomDeduction, setNewCustomDeduction] = useState("");`;

content = content.replace(stateString, stateReplacement);

fs.writeFileSync(path, content, 'utf8');
console.log('Done rewriting prompt into inline UI in page.tsx');
