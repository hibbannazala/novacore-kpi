import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  'https://mszzvdvajhvctyyxndqq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zenp2ZHZhamh2Y3R5eXhuZHFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzQ4NjYxMCwiZXhwIjoyMDk5MDYyNjEwfQ.9gdHNl9Z05PYqq8HvSdJrShWgb43jPlO29w5IuY7IMA'
);
async function check() {
  const { data: d1, error: e1 } = await supabase.from('letter_types').select('*').limit(1);
  const { data: d2, error: e2 } = await supabase.from('company_letters').select('*').limit(1);
  const { data: d3, error: e3 } = await supabase.from('payrolls').select('*').limit(1);
  console.log('letter_types:', e1 ? e1.message : 'OK');
  console.log('company_letters:', e2 ? e2.message : 'OK');
  console.log('payrolls:', e3 ? e3.message : 'OK');
}
check();
