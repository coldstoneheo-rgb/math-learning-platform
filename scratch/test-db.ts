import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase.from('students').select('id, meta_profile').limit(5);
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  for (const student of data) {
    console.log(`Student ${student.id}:`);
    const mp = student.meta_profile;
    if (mp) {
      if (mp.errorSignature) {
        console.log(`  signaturePatterns isArray: ${Array.isArray(mp.errorSignature.signaturePatterns)}`);
        if (!mp.errorSignature.signaturePatterns) {
          console.log('  ! ERROR: signaturePatterns is undefined or null');
        }
      } else {
        console.log('  ! ERROR: errorSignature is missing');
      }
    } else {
      console.log('  No meta profile');
    }
  }
}

main();
