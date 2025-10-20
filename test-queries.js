const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ixpyigcoimuusmahbsyq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4cHlpZ2NvaW11dXNtYWhic3lxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU4Njk2NTIsImV4cCI6MjA3MTQ0NTY1Mn0.Txu1iiXQpLdTUiEMP4msWYzz54KJFTWeYgiiO3R-HiQ';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testQueries() {
  try {
    console.log('\n========== TESTING MESSAGE QUERIES ==========\n');

    // Get all profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*');

    console.log('Profiles:');
    profiles?.forEach(p => {
      console.log(`  - ${p.name} (${p.phone}): ${p.id}`);
    });

    // Test each user
    console.log('\n========== MESSAGES BY USER ==========\n');
    
    for (const user of profiles || []) {
      console.log(`\nUser: ${user.name} (${user.phone})`);
      console.log(`UUID: ${user.id}\n`);
      
      // Query as sender OR receiver
      const { data: messages } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      console.log(`  Found ${messages?.length} messages`);
      
      // Get unique partners
      const partners = new Set();
      messages?.forEach(msg => {
        const partner = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
        partners.add(partner);
      });

      console.log(`  Unique chat partners: ${partners.size}`);
      partners.forEach(partnerId => {
        const partner = profiles?.find(p => p.id === partnerId);
        console.log(`    - ${partner?.name} (${partner?.phone})`);
      });

      if (messages && messages.length > 0) {
        console.log(`  Last 2 messages:`);
        messages.slice(0, 2).forEach(msg => {
          const sender = profiles?.find(p => p.id === msg.sender_id);
          const receiver = profiles?.find(p => p.id === msg.receiver_id);
          console.log(`    ${sender?.name} → ${receiver?.name}: "${msg.content?.substring(0, 40)}..."`);
        });
      }
    }

  } catch (e) {
    console.error('Error:', e.message);
  }

  process.exit(0);
}

testQueries();
