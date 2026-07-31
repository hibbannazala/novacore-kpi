import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  console.log('Fetching all kpi_assignments...');
  const { data: assignments, error: err1 } = await supabase.from('kpi_assignments').select('id, actual_total');
  if (err1) throw err1;

  console.log(`Found ${assignments.length} assignments. Recalculating...`);
  let fixedCount = 0;

  for (const a of assignments) {
    const { data: reports, error: err2 } = await supabase.from('daily_reports').select('value').eq('assignment_id', a.id);
    if (err2) throw err2;

    const total = reports.reduce((s, r) => s + (r.value || 0), 0);
    
    if (total !== a.actual_total) {
      console.log(`Mismatch on ${a.id}: db=${a.actual_total}, reports_sum=${total}`);
      const { error: err3 } = await supabase.from('kpi_assignments').update({ actual_total: total }).eq('id', a.id);
      if (err3) throw err3;
      fixedCount++;
    }
  }

  console.log(`Done! Fixed ${fixedCount} assignments.`);
}

run().catch(console.error);
