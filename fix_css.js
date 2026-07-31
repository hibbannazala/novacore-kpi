const fs = require('fs');
let cleanContent = fs.readFileSync('D:/NOVA-CORE-SYSTEM/Task-Management-NovaCore/src/app/absensi/absensi.css', 'utf8');
const lines = cleanContent.split('\n');
const fixedLines = lines.slice(0, 194);
const css = `
@media print {
  body * {
    visibility: hidden !important;
  }
  .print-only, .print-only * {
    visibility: visible !important;
  }
  .print-only {
    position: absolute !important;
    left: 0 !important;
    top: 0 !important;
    width: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
  }
}`;
fs.writeFileSync('D:/NOVA-CORE-SYSTEM/Task-Management-NovaCore/src/app/absensi/absensi.css', fixedLines.join('\n') + '\n' + css, 'utf8');
console.log('Fixed CSS');
