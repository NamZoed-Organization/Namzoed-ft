const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ixpyigcoimuusmahbsyq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4cHlpZ2NvaW11dXNtYWhic3lxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU4Njk2NTIsImV4cCI6MjA3MTQ0NTY1Mn0.Txu1iiXQpLdTUiEMP4msWYzz54KJFTWeYgiiO3R-HiQ';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkData() {
  try {
    console.log('\n========== CHECKING MESSAGE/CHAT TABLES ==========\n');

    // Check each messaging table
    const messagingTables = ['messages', 'direct_messages', 'chats', 'conversations', 'chat_messages'];
    
    for (const table of messagingTables) {
      const { data, error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact' })
        .limit(0);
      
      if (!error) {
        console.log(`\n${table}:`);
        console.log(`  ✅ Table exists - Record count: ${count}`);
        
        if (count > 0) {
          const { data: sample } = await supabase
            .from(table)
            .select('*')
            .limit(3);
          
          console.log(`  Columns: ${Object.keys(sample[0]).join(', ')}`);
          console.log(`  Sample records:`);
          sample.forEach((rec, i) => {
            console.log(`    ${i + 1}. ${JSON.stringify(rec).substring(0, 150)}...`);
          });
        }
      } else {
        console.log(`\n${table}:`);
        console.log(`  ❌ Error or doesn't exist`);
      }
    }

  } catch (e) {
    console.error('Error:', e.message);
  }

  process.exit(0);
}

checkData();
