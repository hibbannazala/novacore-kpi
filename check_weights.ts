import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  const { data: users, error: err1 } = await supabase.from('users').select('id, name').ilike('name', '%Andi Bambang%');
  if(users && users.length > 0) {
     console.log('User:', users[0]);
     const { data: settings } = await supabase.from('kpi_settings').select('*').eq('user_id', users[0].id);
     console.log('Settings:', settings);
  }
}
run().catch(console.error);
