const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ixpyigcoimuusmahbsyq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4cHlpZ2NvaW11dXNtYWhic3lxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU4Njk2NTIsImV4cCI6MjA3MTQ0NTY1Mn0.Txu1iiXQpLdTUiEMP4msWYzz54KJFTWeYgiiO3R-HiQ';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function getMessages() {
  try {
    console.log('\n========== FETCHING MESSAGES FROM DATABASE ==========\n');

    // Get ALL messages without any filter
    const { data, error, status } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.log('❌ Error fetching messages:', error);
      console.log('Status:', status);
      return;
    }

    console.log(`✅ Successfully fetched ${data?.length || 0} messages\n`);

    if (!data || data.length === 0) {
      console.log('⚠️ No messages found');
      return;
    }

    // Show table structure
    console.log('Table structure:');
    console.log('Columns:', Object.keys(data[0]));
    
    // Show all messages
    console.log('\n========== ALL MESSAGES ==========\n');
    data.forEach((msg, i) => {
      console.log(`Message ${i + 1}:`);
      console.log(JSON.stringify(msg, null, 2));
      console.log('---');
    });

    // Extract unique users
    console.log('\n========== UNIQUE USERS ==========\n');
    const uniqueUsers = new Set();
    data.forEach(msg => {
      if (msg.sender_id) uniqueUsers.add(msg.sender_id);
      if (msg.receiver_id) uniqueUsers.add(msg.receiver_id);
    });

    console.log(`Total unique users: ${uniqueUsers.size}`);
    console.log('Users:', Array.from(uniqueUsers));

    // Get unique conversations
    console.log('\n========== UNIQUE CONVERSATIONS ==========\n');
    const conversations = new Map();
    data.forEach(msg => {
      const key = [msg.sender_id, msg.receiver_id].sort().join('|');
      if (!conversations.has(key)) {
        conversations.set(key, {
          user1: msg.sender_id,
          user2: msg.receiver_id,
          lastMessage: msg,
          messageCount: 0
        });
      }
      conversations.get(key).messageCount++;
    });

    console.log(`Total conversations: ${conversations.size}\n`);
    conversations.forEach((conv, key) => {
      console.log(`Conversation: ${conv.user1} <-> ${conv.user2}`);
      console.log(`  Messages: ${conv.messageCount}`);
      console.log(`  Last: "${conv.lastMessage.content?.substring(0, 50)}..."`);
      console.log(`  Time: ${conv.lastMessage.created_at}\n`);
    });

  } catch (e) {
    console.error('❌ Error:', e.message);
    console.error(e);
  }

  process.exit(0);
}

getMessages();
