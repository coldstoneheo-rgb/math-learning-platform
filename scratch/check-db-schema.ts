import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('Testing connection & exec_sql RPC...');

  const query = `
    SELECT 
      conname AS constraint_name,
      pg_get_constraintdef(c.oid) AS constraint_definition
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'users';
  `;

  const { data, error } = await supabase.rpc('exec_sql', { sql_query: query });

  if (error) {
    console.error('Error executing exec_sql:', error);
  } else {
    console.log('Constraints on users table:');
    console.log(JSON.stringify(data, null, 2));
  }
}

main();
