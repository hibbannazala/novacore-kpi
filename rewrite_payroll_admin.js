const fs = require('fs');

const path = 'src/app/absensi/admin/payroll/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add Plus icon to imports
content = content.replace('X, Filter, ChevronDown, User as UserIcon', 'X, Filter, ChevronDown, User as UserIcon, Plus');

// 2. Add DeductionType to imports
content = content.replace('import type { Payroll, PayrollStaffSetting } from "@/types";', 'import type { Payroll, PayrollStaffSetting, DeductionType } from "@/types";');

// 3. Add state for deduction types in the component
content = content.replace(
  'const [expandedRow, setExpandedRow] = useState<string | null>(null);',
  'const [expandedRow, setExpandedRow] = useState<string | null>(null);\n  const [deductionTypes, setDeductionTypes] = useState<DeductionType[]>([]);\n  const [newDeductionName, setNewDeductionName] = useState("");'
);

// 4. Fetch deduction types
content = content.replace(
  'supabase.from("payrolls").select("*").eq("month", month).eq("year", year),',
  'supabase.from("payrolls").select("*").eq("month", month).eq("year", year),\n      supabase.from("payroll_deduction_types").select("*").order("name"),'
);

content = content.replace(
  'const payrolls = (payrollsRes.data ?? []) as Payroll[];',
  'const payrolls = (payrollsRes.data ?? []) as Payroll[];\n    const typesRes = arguments[0]; // hacky, better use the array\n    '
);

// Actually, let's fix the Promise.all array destructuring
content = content.replace(
  'const [usersRes, settingsRes, payrollsRes] = await Promise.all([',
  'const [usersRes, settingsRes, payrollsRes, deductionTypesRes] = await Promise.all(['
);

content = content.replace(
  'const payrolls = (payrollsRes.data ?? []) as Payroll[];',
  'const payrolls = (payrollsRes.data ?? []) as Payroll[];\n    setDeductionTypes((deductionTypesRes.data ?? []) as DeductionType[]);'
);

// 5. Update the built payroll to include deductions_detail
content = content.replace(
  'deductions: existing?.deductions ?? 0,',
  'deductions: existing?.deductions ?? 0,\n          deductions_detail: existing?.deductions_detail ?? [],'
);

// 6. Update payload for saveRow and publishRow
content = content.replace(
  'deductions: row.payroll.deductions || 0,',
  'deductions: row.payroll.deductions || 0,\n        deductions_detail: row.payroll.deductions_detail || [],'
);
content = content.replace(
  'deduction_notes: row.payroll.deduction_notes || "",',
  '' // We will just remove deduction_notes or keep it empty. Wait, let's keep it for legacy compatibility, but just let it be.
);

content = content.replace(
  'status: "published",',
  'status: "published",\n        snapshot_name: row.name,\n        snapshot_position: row.setting?.contract_position || null,\n        snapshot_company: row.setting?.company || null,'
);

fs.writeFileSync(path, content, 'utf8');
console.log('Done rewriting simple parts of page.tsx');
