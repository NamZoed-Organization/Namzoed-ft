const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ixpyigcoimuusmahbsyq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4cHlpZ2NvaW11dXNtYWhic3lxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU4Njk2NTIsImV4cCI6MjA3MTQ0NTY1Mn0.Txu1iiXQpLdTUiEMP4msWYzz54KJFTWeYgiiO3R-HiQ';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function insertTestMessages() {
  try {
    console.log('\n========== INSERTING TEST MESSAGES WITH UUID ==========\n');

    // Get profiles with their IDs (which are UUIDs)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, phone')
      .limit(4);

    if (!profiles || profiles.length < 2) {
      console.log('❌ Need at least 2 profiles');
      return;
    }

    const user1 = profiles[0];
    const user2 = profiles[1];
    const user3 = profiles[2] || user1;
    const user4 = profiles[3] || user2;

    console.log(`User 1: ${user1.name} (ID: ${user1.id})`);
    console.log(`User 2: ${user2.name} (ID: ${user2.id})`);
    console.log(`User 3: ${user3.name} (ID: ${user3.id})`);
    console.log(`User 4: ${user4.name} (ID: ${user4.id})\n`);

    // Insert test messages using UUIDs
    const testMessages = [
      {
        sender_id: user1.id,
        receiver_id: user2.id,
        content: 'Hey! How are you doing?',
        created_at: new Date(Date.now() - 3600000).toISOString()
      },
      {
        sender_id: user2.id,
        receiver_id: user1.id,
        content: 'Hi! I am doing great, thanks for asking!',
        created_at: new Date(Date.now() - 1800000).toISOString()
      },
      {
        sender_id: user1.id,
        receiver_id: user3.id,
        content: 'Hi! Can you help me with something?',
        created_at: new Date(Date.now() - 900000).toISOString()
      },
      {
        sender_id: user3.id,
        receiver_id: user1.id,
        content: 'Sure! What do you need?',
        created_at: new Date(Date.now() - 600000).toISOString()
      },
      {
        sender_id: user2.id,
        receiver_id: user4.id,
        content: 'Hello! Long time no chat!',
        created_at: new Date(Date.now() - 300000).toISOString()
      },
      {
        sender_id: user4.id,
        receiver_id: user2.id,
        content: 'Yes! How have you been?',
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

    console.log(`Total messages now: ${verify?.length}\n`);
    verify?.forEach((msg, i) => {
      const senderName = [user1, user2, user3, user4].find(u => u.id === msg.sender_id)?.name || msg.sender_id.substring(0, 8);
      const receiverName = [user1, user2, user3, user4].find(u => u.id === msg.receiver_id)?.name || msg.receiver_id.substring(0, 8);
      console.log(`${i + 1}. ${senderName} → ${receiverName}`);
      console.log(`   "${msg.content}"`);
      console.log(`   ${new Date(msg.created_at).toLocaleString()}\n`);
    });

  } catch (e) {
    console.error('❌ Error:', e.message);
  }

  process.exit(0);
}

insertTestMessages();
