const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ixpyigcoimuusmahbsyq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4cHlpZ2NvaW11dXNtYWhic3lxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU4Njk2NTIsImV4cCI6MjA3MTQ0NTY1Mn0.Txu1iiXQpLdTUiEMP4msWYzz54KJFTWeYgiiO3R-HiQ';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function insertTestMessages() {
  try {
    console.log('\n========== INSERTING TEST MESSAGES ==========\n');

    // Get profiles first
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, phone')
      .limit(2);

    if (!profiles || profiles.length < 2) {
      console.log('❌ Need at least 2 profiles to create test messages');
      return;
    }

    const user1 = profiles[0];
    const user2 = profiles[1];

    console.log(`User 1: ${user1.name} (${user1.phone})`);
    console.log(`User 2: ${user2.name} (${user2.phone})\n`);

    // Insert test messages
    const testMessages = [
      {
        sender_id: user1.phone,
        receiver_id: user2.phone,
        content: 'Hello! How are you?',
        created_at: new Date().toISOString()
      },
      {
        sender_id: user2.phone,
        receiver_id: user1.phone,
        content: 'Hi! I am doing great, thanks for asking!',
        created_at: new Date().toISOString()
      },
      {
        sender_id: user1.phone,
        receiver_id: user2.phone,
        content: 'That is wonderful to hear!',
        created_at: new Date().toISOString()
      }
    ];

    console.log('Inserting test messages...');
    const { data, error } = await supabase
      .from('messages')
      .insert(testMessages)
      .select();

    if (error) {
      console.log('❌ Error inserting:', error.message);
      return;
    }

    console.log(`✅ Successfully inserted ${data?.length || 0} messages`);
    
    // Now verify by reading back
    console.log('\n========== VERIFYING INSERTED MESSAGES ==========\n');
    const { data: verify } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false });

    console.log(`Total messages now: ${verify?.length}`);
    verify?.forEach((msg, i) => {
      console.log(`\n${i + 1}. ${msg.sender_id} → ${msg.receiver_id}`);
      console.log(`   "${msg.content}"`);
      console.log(`   ${msg.created_at}`);
    });

  } catch (e) {
    console.error('❌ Error:', e.message);
  }

  process.exit(0);
}

insertTestMessages();
