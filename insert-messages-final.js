const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ixpyigcoimuusmahbsyq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4cHlpZ2NvaW11dXNtYWhic3lxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU4Njk2NTIsImV4cCI6MjA3MTQ0NTY1Mn0.Txu1iiXQpLdTUiEMP4msWYzz54KJFTWeYgiiO3R-HiQ';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function insertMessages() {
  try {
    console.log('\n========== INSERTING TEST MESSAGES ==========\n');

    // Get all profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, phone');

    if (!profiles || profiles.length < 2) {
      console.log('Not enough profiles');
      return;
    }

    console.log('Available profiles:');
    profiles.forEach((p, i) => {
      console.log(`${i + 1}. ${p.name} (${p.phone})`);
    });

    // Create test messages between different users
    const messages = [];
    
    // Messages between user 1 and user 2
    messages.push({
      sender_id: profiles[0].id,
      receiver_id: profiles[1].id,
      content: 'Hi! How are you doing today?',
      created_at: new Date(Date.now() - 86400000).toISOString() // 1 day ago
    });
    messages.push({
      sender_id: profiles[1].id,
      receiver_id: profiles[0].id,
      content: 'Great! Just finished work. How about you?',
      created_at: new Date(Date.now() - 82800000).toISOString() // 23 hours ago
    });
    messages.push({
      sender_id: profiles[0].id,
      receiver_id: profiles[1].id,
      content: 'Pretty good! Want to grab coffee tomorrow?',
      created_at: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
    });

    // Messages between user 1 and user 3
    messages.push({
      sender_id: profiles[0].id,
      receiver_id: profiles[2].id,
      content: 'Hey, do you have the documents ready?',
      created_at: new Date(Date.now() - 7200000).toISOString() // 2 hours ago
    });
    messages.push({
      sender_id: profiles[2].id,
      receiver_id: profiles[0].id,
      content: 'Yes, I will send them shortly',
      created_at: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
    });

    // Messages between user 2 and user 3
    messages.push({
      sender_id: profiles[1].id,
      receiver_id: profiles[3].id,
      content: 'Hi! Long time no chat!',
      created_at: new Date(Date.now() - 1800000).toISOString() // 30 min ago
    });
    messages.push({
      sender_id: profiles[3].id,
      receiver_id: profiles[1].id,
      content: 'Hey! Yes, been a while. How have you been?',
      created_at: new Date().toISOString() // Now
    });

    console.log(`\nInserting ${messages.length} test messages...\n`);

    // Try to insert with RLS disabled by trying from a client perspective
    const { data, error } = await supabase
      .from('messages')
      .insert(messages);

    if (error) {
      console.log('❌ Insert failed:', error.message);
      console.log('This is likely due to RLS policy.');
      console.log('\nYou need to:');
      console.log('1. Go to Supabase Dashboard');
      console.log('2. Navigate to SQL Editor');
      console.log('3. Run the following SQL to disable RLS or fix the policy:\n');
      console.log('-- Disable RLS temporarily');
      console.log('ALTER TABLE messages DISABLE ROW LEVEL SECURITY;\n');
      console.log('Then try inserting again.');
      return;
    }

    console.log(`✅ Successfully inserted ${data?.length || messages.length} messages`);

    // Verify
    const { data: verify } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false });

    console.log(`\nVerifying... Found ${verify?.length} messages in database`);
    verify?.slice(0, 5).forEach((m, i) => {
      const sender = profiles.find(p => p.id === m.sender_id);
      const receiver = profiles.find(p => p.id === m.receiver_id);
      console.log(`${i + 1}. ${sender?.name} → ${receiver?.name}: "${m.content}"`);
    });

  } catch (e) {
    console.error('Error:', e.message);
  }

  process.exit(0);
}

insertMessages();
