const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ixpyigcoimuusmahbsyq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4cHlpZ2NvaW11dXNtYWhic3lxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU4Njk2NTIsImV4cCI6MjA3MTQ0NTY1Mn0.Txu1iiXQpLdTUiEMP4msWYzz54KJFTWeYgiiO3R-HiQ';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function getAllData() {
  try {
    console.log('\n========== COMPREHENSIVE DATA CHECK ==========\n');

    // 1. Get all profiles
    console.log('1. PROFILES TABLE:');
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (profileError) {
      console.log('   Error:', profileError.message);
    } else {
      console.log(`   Total: ${profiles?.length}`);
      profiles?.forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.name} | Phone: ${p.phone} | ID: ${p.id.substring(0, 8)}...`);
      });
    }

    // 2. Get all messages
    console.log('\n2. MESSAGES TABLE:');
    const { data: messages, error: msgError, count: msgCount } = await supabase
      .from('messages')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (msgError) {
      console.log('   Error:', msgError.message);
    } else {
      console.log(`   Total: ${messages?.length} (count: ${msgCount})`);
      if (messages && messages.length > 0) {
        messages.slice(0, 5).forEach((m, i) => {
          const sender = profiles?.find(p => p.id === m.sender_id)?.name || m.sender_id.substring(0, 8);
          const receiver = profiles?.find(p => p.id === m.receiver_id)?.name || m.receiver_id.substring(0, 8);
          console.log(`   ${i + 1}. ${sender} → ${receiver}: "${m.content?.substring(0, 40)}..."`);
        });
      }
    }

    // 3. Check if there's a different messaging table
    console.log('\n3. CHECKING OTHER MESSAGE TABLES:');
    const otherTables = ['direct_messages', 'chat_messages', 'chats', 'conversations'];
    
    for (const table of otherTables) {
      const { data, count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (!error) {
        console.log(`   ${table}: ${count} records`);
      }
    }

    // 4. Get the table structure
    console.log('\n4. MESSAGES TABLE STRUCTURE:');
    const { data: sampleMsg } = await supabase
      .from('messages')
      .select('*')
      .limit(1);
    
    if (sampleMsg && sampleMsg.length > 0) {
      console.log('   Columns:', Object.keys(sampleMsg[0]).join(', '));
      console.log('   Sample:', JSON.stringify(sampleMsg[0], null, 2));
    } else {
      console.log('   No sample available');
      // Try to at least see the raw schema
      console.log('   (Table is empty or inaccessible due to RLS)');
    }

  } catch (e) {
    console.error('Error:', e.message);
  }

  process.exit(0);
}

getAllData();
