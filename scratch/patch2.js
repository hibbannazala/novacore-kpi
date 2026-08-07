const fs = require('fs');
const path = require('path');

function findFiles(dir, filter, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      findFiles(filePath, filter, fileList);
    } else if (filePath.endsWith(filter)) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const files = findFiles('src', '.tsx');
let updatedCount = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf-8');
  let changed = false;

  if (content.includes('const typeColor: Record<string, string> = {')) {
    // Only proceed if lead_hr is not already inside typeColor block
    const blockMatch = content.match(/const typeColor: Record<string, string> = {([^}]*)}/);
    if (blockMatch && !blockMatch[1].includes('lead_hr:')) {
      const match = content.match(/quality:\s*"(.*?)",/);
      if (match) {
        const qualityClasses = match[1];
        let hasBorder = qualityClasses.includes('border-');
        
        const skyClasses = hasBorder ? "text-sky-700 bg-sky-50 border-sky-200" : "text-sky-600 bg-sky-50";
        const emeraldClasses = hasBorder ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-emerald-600 bg-emerald-50";
        
        content = content.replace(/quality:\s*".*?",/, `quality: "${qualityClasses}",\n  lead_hr: "${skyClasses}",\n  hr: "${emeraldClasses}",`);
        changed = true;
      }
    }
  }

  if (changed) {
    fs.writeFileSync(file, content, 'utf-8');
    updatedCount++;
    console.log(`Updated typeColor in ${file}`);
  }
}

console.log(`Updated ${updatedCount} files.`);
