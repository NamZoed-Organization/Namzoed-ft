const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ixpyigcoimuusmahbsyq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4cHlpZ2NvaW11dXNtYWhic3lxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU4Njk2NTIsImV4cCI6MjA3MTQ0NTY1Mn0.Txu1iiXQpLdTUiEMP4msWYzz54KJFTWeYgiiO3R-HiQ';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkDatabase() {
  try {
    console.log('\n========== CHECKING SUPABASE DATABASE ==========\n');

    // List of common table names to check
    const tablesToCheck = [
      'messages',
      'chats',
      'conversations',
      'profiles',
      'posts',
      'users',
      'direct_messages',
      'chat_messages'
    ];

    console.log('Checking for tables...\n');
    
    for (const table of tablesToCheck) {
      const { data, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (!error) {
        console.log(`✅ ${table}: EXISTS`);
        // Try to get one record to see structure
        const { data: sample } = await supabase
          .from(table)
          .select('*')
          .limit(1);
        
        if (sample && sample.length > 0) {
          console.log(`   Columns: ${Object.keys(sample[0]).join(', ')}`);
          console.log(`   Sample: ${JSON.stringify(sample[0]).substring(0, 100)}...`);
        }
      }
    }

  } catch (e) {
    console.error('Error:', e.message);
  }

  process.exit(0);
}

checkDatabase();
