import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  'https://mszzvdvajhvctyyxndqq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zenp2ZHZhamh2Y3R5eXhuZHFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzQ4NjYxMCwiZXhwIjoyMDk5MDYyNjEwfQ.9gdHNl9Z05PYqq8HvSdJrShWgb43jPlO29w5IuY7IMA'
);
async function test() {
  const { data, error } = await supabase.rpc('exec_sql', { sql_string: 'select 1' });
  console.log('rpc error:', error);
}
test();
