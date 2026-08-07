const fs = require('fs');
let content = fs.readFileSync('src/lib/supabase/database.types.ts', 'utf8');

content = content.replaceAll(
  'type: "result" | "activity" | "quality";',
  'type: "result" | "activity" | "quality" | "lead_hr" | "hr";'
);

content = content.replaceAll(
  'type?: "result" | "activity" | "quality";',
  'type?: "result" | "activity" | "quality" | "lead_hr" | "hr";'
);

fs.writeFileSync('src/lib/supabase/database.types.ts', content);
