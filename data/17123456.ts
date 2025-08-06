// data/17123456.ts

// Message interface
interface IMessage {
  sender: string; // phone number
  content: string;
  timestamp: Date;
}

// 1. Messages between this user and other users (identified by phone numbers)
const messages = {
  '+97517234567': [
    {
      sender: '+97517123456',
      content: 'Hey! Did you see the new traditional jewelry collection?',
      timestamp: new Date('2025-01-15T10:30:00Z')
    },
    {
      sender: '+97517234567',
      content: 'Yes! The silver work is amazing. Perfect for the upcoming festival.',
      timestamp: new Date('2025-01-15T10:32:00Z')
    },
    {
      sender: '+97517123456',
      content: 'I was thinking the same! Want to go check it out together?',
      timestamp: new Date('2025-01-15T10:35:00Z')
    },
    {
      sender: '+97517234567',
      content: 'Absolutely! How about tomorrow afternoon?',
      timestamp: new Date('2025-01-15T10:37:00Z')
    }
  ],
  '+97517345678': [
    {
      sender: '+97517345678',
      content: 'Kuzu zangpo! Are you selling any handmade items this week?',
      timestamp: new Date('2025-01-16T09:15:00Z')
    },
    {
      sender: '+97517123456',
      content: 'Kuzu zangpo la! Yes, I have some new bamboo crafts ready.',
      timestamp: new Date('2025-01-16T09:18:00Z')
    },
    {
      sender: '+97517345678',
      content: 'Great! Can you send me some pictures?',
      timestamp: new Date('2025-01-16T09:20:00Z')
    },
    {
      sender: '+97517123456',
      content: 'Sure! I will send them in a few minutes.',
      timestamp: new Date('2025-01-16T09:22:00Z')
    }
  ],
  '+97517456789': [
    {
      sender: '+97517123456',
      content: 'How is the organic farming going this season?',
      timestamp: new Date('2025-01-17T08:00:00Z')
    },
    {
      sender: '+97517456789',
      content: 'Very well! The red rice crop is looking promising.',
      timestamp: new Date('2025-01-17T08:05:00Z')
    },
    {
      sender: '+97517123456',
      content: 'That is wonderful news! Will you have some for sale soon?',
      timestamp: new Date('2025-01-17T08:08:00Z')
    }
  ]
};

// 2. Following and Followers (using phone numbers)
const following = [
  '+97517234567',  // mutual connection
  '+97517345678',  // mutual connection
  '+97517456789',  // mutual connection
  '+97517567890',  // only following (not followed back)
  '+97517678901',  // only following (not followed back)
  '+97517789012',  // mutual connection
  '+97517890123'   // only following (not followed back)
];

const followers = [
  '+97517234567',  // mutual connection
  '+97517345678',  // mutual connection
  '+97517456789',  // mutual connection
  '+97517789012',  // mutual connection
  '+97517901234',  // only follower (not following back)
  '+97517012345',  // only follower (not following back)
  '+97517098765',  // only follower (not following back)
  '+97517987654'   // only follower (not following back)
];

// 3. Requests (messages from users this person is NOT following)
const requests = [
  {
    sender: '+97517901234',
    content: 'Hello! I love your traditional crafts. Can we connect?',
    timestamp: new Date('2025-01-18T14:20:00Z')
  },
  {
    sender: '+97517012345',
    content: 'Hi there! I saw your beautiful handmade items. Would you be interested in collaborating?',
    timestamp: new Date('2025-01-18T16:45:00Z')
  },
  {
    sender: '+97517098765',
    content: 'Kuzu zangpo! I am starting a small business and would love to learn from your experience.',
    timestamp: new Date('2025-01-19T09:30:00Z')
  },
  {
    sender: '+97517987654',
    content: 'Your organic products look amazing! Can you tell me more about your farming methods?',
    timestamp: new Date('2025-01-19T11:15:00Z')
  },
  {
    sender: '+97517876543',
    content: 'Hello! I am interested in buying some of your bamboo crafts for my home.',
    timestamp: new Date('2025-01-19T13:00:00Z')
  }
];

// User profile data
const userProfile = {
  phoneNumber: '+97517123456',
  followingCount: following.length,
  followersCount: followers.length,
  requestsCount: requests.length
};

// Export all data
export { followers, following, messages, requests, userProfile };
export default { messages, following, followers, requests, userProfile };