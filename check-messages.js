const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.log('Error: Supabase credentials not found in environment variables');
  console.log('Make sure to set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkMessages() {
  try {
    console.log('Fetching messages...');
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .limit(100);

    if (error) {
      console.error('Error fetching messages:', error);
      return;
    }

    console.log(`\nTotal messages found: ${data?.length || 0}\n`);

    if (!data || data.length === 0) {
      console.log('No messages in database');
      return;
    }

    // Show first few messages
    console.log('Sample messages:');
    data.slice(0, 5).forEach((msg, i) => {
      console.log(`\nMessage ${i + 1}:`);
      console.log(JSON.stringify(msg, null, 2));
    });

    // Get unique senders and receivers
    const uniqueUsers = new Set();
    data.forEach(msg => {
      if (msg.sender_id) uniqueUsers.add(msg.sender_id);
      if (msg.receiver_id) uniqueUsers.add(msg.receiver_id);
    });

    console.log(`\n\nUnique users in messages: ${uniqueUsers.size}`);
    console.log('User IDs:', Array.from(uniqueUsers));

  } catch (e) {
    console.error('Error:', e);
  }

  process.exit(0);
}

checkMessages();
