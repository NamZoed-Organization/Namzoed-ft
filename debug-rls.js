const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ixpyigcoimuusmahbsyq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4cHlpZ2NvaW11dXNtYWhic3lxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU4Njk2NTIsImV4cCI6MjA3MTQ0NTY1Mn0.Txu1iiXQpLdTUiEMP4msWYzz54KJFTWeYgiiO3R-HiQ';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function debugRLS() {
  try {
    console.log('\n========== DEBUGGING RLS & MESSAGES TABLE ==========\n');

    // Try without any filters
    console.log('1. Trying basic select without filters...');
    const { data: data1, error: error1, count: count1 } = await supabase
      .from('messages')
      .select('*', { count: 'exact' });
    
    console.log(`   Error: ${error1 ? error1.message : 'None'}`);
    console.log(`   Records: ${data1?.length || 0}`);
    console.log(`   Count: ${count1}`);

    // Try with head=true
    console.log('\n2. Trying with head=true...');
    const { data: data2, error: error2, count: count2 } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true });
    
    console.log(`   Error: ${error2 ? error2.message : 'None'}`);
    console.log(`   Count: ${count2}`);

    // Try with limit
    console.log('\n3. Trying with limit(100)...');
    const { data: data3, error: error3 } = await supabase
      .from('messages')
      .select('*')
      .limit(100);
    
    console.log(`   Error: ${error3 ? error3.message : 'None'}`);
    console.log(`   Records: ${data3?.length || 0}`);
    
    if (data3 && data3.length > 0) {
      console.log('   First record:');
      console.log(JSON.stringify(data3[0], null, 2));
    }

    // Check profiles table to compare
    console.log('\n4. Checking profiles table for comparison...');
    const { data: profiles, error: profileError, count: profileCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact' })
      .limit(1);
    
    console.log(`   Profiles count: ${profileCount}`);
    console.log(`   Profiles error: ${profileError ? profileError.message : 'None'}`);

  } catch (e) {
    console.error('❌ Exception:', e.message);
  }

  process.exit(0);
}

debugRLS();
