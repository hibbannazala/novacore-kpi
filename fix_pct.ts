import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  console.log('Fetching all kpi_assignments...');
  const { data: assignments, error: err1 } = await supabase.from('kpi_assignments').select('id, actual_total, monthly_target, achievement_percentage');
  if (err1) throw err1;

  console.log(`Found ${assignments.length} assignments. Recalculating...`);
  let fixedCount = 0;

  for (const a of assignments) {
    const { data: reports, error: err2 } = await supabase.from('daily_reports').select('value').eq('assignment_id', a.id);
    if (err2) throw err2;

    const total = reports.reduce((s, r) => s + (r.value || 0), 0);
    const expectedPct = a.monthly_target > 0 ? (total / a.monthly_target) * 100 : 0;
    
    // Check if either actual_total or achievement_percentage is mismatched
    if (total !== a.actual_total || Math.abs(expectedPct - (a.achievement_percentage || 0)) > 0.01) {
      console.log(`Mismatch on ${a.id}: db_total=${a.actual_total} (should be ${total}), db_pct=${a.achievement_percentage} (should be ${expectedPct})`);
      const { error: err3 } = await supabase.from('kpi_assignments').update({ 
        actual_total: total,
        achievement_percentage: expectedPct
      }).eq('id', a.id);
      if (err3) throw err3;
      fixedCount++;
    }
  }

  console.log(`Done! Fixed ${fixedCount} assignments.`);
}

run().catch(console.error);
