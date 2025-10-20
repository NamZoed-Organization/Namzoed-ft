const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ixpyigcoimuusmahbsyq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4cHlpZ2NvaW11dXNtYWhic3lxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU4Njk2NTIsImV4cCI6MjA3MTQ0NTY1Mn0.Txu1iiXQpLdTUiEMP4msWYzz54KJFTWeYgiiO3R-HiQ';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspectDatabase() {
  try {
    console.log('\n========== CHECKING SUPABASE MESSAGES TABLE ==========\n');

    // 1. Check if messages table exists and get its structure
    console.log('1. Fetching sample messages...');
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .limit(5);

    if (messagesError) {
      console.log('❌ Error accessing messages table:', messagesError.message);
      console.log('\nTrying alternative table names...');
      
      // Try different table names
      const tableNames = ['message', 'chats', 'conversation', 'conversations'];
      for (const tableName of tableNames) {
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .limit(1);
        if (!error && data) {
          console.log(`✅ Found table: ${tableName}`);
          console.log('First record:', JSON.stringify(data[0], null, 2));
          return;
        }
      }
      console.log('❌ No messages/chat tables found');
      return;
    }

    if (!messages || messages.length === 0) {
      console.log('⚠️  Messages table exists but is empty');
      // Still show the columns
      const { data: oneRecord } = await supabase
        .from('messages')
        .select('*')
        .limit(1);
      
      console.log('Table columns:', oneRecord && oneRecord.length > 0 ? Object.keys(oneRecord[0]) : 'Unable to determine');
      return;
    }

    console.log(`✅ Found ${messages.length} messages in table`);
    console.log('\n2. Message structure:');
    console.log(JSON.stringify(messages[0], null, 2));

    // 2. Get all unique users
    console.log('\n3. Unique users in messages:');
    const uniqueUsers = new Set();
    const senderReceiverPairs = [];
    
    messages.forEach(msg => {
      senderReceiverPairs.push({
        sender: msg.sender_id,
        receiver: msg.receiver_id,
        content: msg.content?.substring(0, 50),
        created_at: msg.created_at
      });
      if (msg.sender_id) uniqueUsers.add(msg.sender_id);
      if (msg.receiver_id) uniqueUsers.add(msg.receiver_id);
    });

    console.log(`Total unique users: ${uniqueUsers.size}`);
    console.log('Users:', Array.from(uniqueUsers));
    
    console.log('\n4. Sample conversations:');
    senderReceiverPairs.slice(0, 5).forEach((pair, i) => {
      console.log(`${i + 1}. ${pair.sender} -> ${pair.receiver}: "${pair.content}..."`);
    });

    // 3. Get all messages (not just sample)
    console.log('\n5. Fetching ALL messages...');
    const { data: allMessages } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false });

    console.log(`Total messages: ${allMessages?.length}`);

    if (allMessages && allMessages.length > 0) {
      console.log('\n6. All unique chat partners:');
      const userMap = new Map();
      
      allMessages.forEach(msg => {
        const sender = msg.sender_id;
        const receiver = msg.receiver_id;
        
        if (!userMap.has(sender)) userMap.set(sender, []);
        if (!userMap.has(receiver)) userMap.set(receiver, []);
        
        userMap.get(sender).push({ partner: receiver, timestamp: msg.created_at });
        userMap.get(receiver).push({ partner: sender, timestamp: msg.created_at });
      });

      console.log('\nChat partners for each user:');
      userMap.forEach((partners, userId) => {
        const uniquePartners = [...new Set(partners.map(p => p.partner))];
        console.log(`  ${userId}: ${uniquePartners.length} partners`);
        uniquePartners.slice(0, 3).forEach(p => {
          console.log(`    - ${p}`);
        });
      });
    }

  } catch (e) {
    console.error('❌ Error:', e.message);
  }

  process.exit(0);
}

inspectDatabase();
