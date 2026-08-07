const fs = require('fs');
const path = require('path');

const files = [
  "src/app/dashboard/head/kpi-setup/page.tsx",
  "src/app/dashboard/head/penugasan/new/page.tsx",
  "src/app/dashboard/head/penugasan/page.tsx",
  "src/app/dashboard/hr/assignments/new/page.tsx",
  "src/app/dashboard/hr/assignments/page.tsx",
  "src/app/dashboard/hr/kpi/page.tsx",
  "src/components/kpi/ExpandableStaffGrid.tsx",
  "src/components/kpi/KpiCard.tsx",
  "src/components/kpi/MemberPerformanceRow.tsx",
  "src/components/kpi/WeightedScoreCard.tsx"
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf-8');

  // Regex to exactly match typeLabel definition block (it's mostly a single line or has the corrupted stuff)
  // Let's just find `const typeLabel: Record<string, string> = { ... };` across multiple lines
  content = content.replace(/const typeLabel: Record<string, string> = \{[^}]*\};/g, 'const typeLabel: Record<string, string> = { result: "Result", activity: "Activity", quality: "Quality", lead_hr: "Lead HR", hr: "HR" };');

  // For typeColor, let's find the exact block
  // Some have borders, some don't.
  // We can just find the block and rewrite it entirely based on the existing result/activity/quality
  const colorBlockMatch = content.match(/const typeColor: Record<string, string> = \{([\s\S]*?)\};/);
  if (colorBlockMatch) {
    let block = colorBlockMatch[1];
    
    // Extract existing values
    const getVal = (key) => {
       const m = block.match(new RegExp(`${key}:\\s*"([^"]+)"`));
       return m ? m[1] : "";
    };
    
    const r = getVal('result');
    const a = getVal('activity');
    const q = getVal('quality');
    
    if (q) {
      let hasBorder = q.includes('border-');
      const skyClasses = hasBorder ? "text-sky-700 bg-sky-50 border-sky-200" : "text-sky-600 bg-sky-50";
      const emeraldClasses = hasBorder ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-emerald-600 bg-emerald-50";
      
      const newBlock = `
  result: "${r}",
  activity: "${a}",
  quality: "${q}",
  lead_hr: "${skyClasses}",
  hr: "${emeraldClasses}",
`;
      content = content.replace(colorBlockMatch[0], `const typeColor: Record<string, string> = {${newBlock}};`);
    }
  }

  fs.writeFileSync(file, content, 'utf-8');
  console.log("Fixed", file);
}
