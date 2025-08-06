// data/mongoose.ts
// Mongoose = Delivery Person in this project

// Message interface
interface IMessage {
  sender: 'client' | 'mongoose';
  content: string;
  timestamp: Date;
}

// Mongoose (Delivery Person) interface  
interface IMongoose {
  name: string;
  clientChats: {
    [phoneNumber: string]: IMessage[];
  };
}

// Message schema structure
const MessageSchema = {
  sender: String, // 'client' | 'mongoose'
  content: String,
  timestamp: Date
};

// Static data for delivery persons (mongooses) and their client chats
const mongooses = {
  Yamnang: {
    name: 'Yamnang',
    clientChats: {
      '+97517123456': [
        {
          sender: 'client',
          content: 'Hello! Is my order ready for pickup?',
          timestamp: new Date('2025-01-15T09:30:00Z')
        },
        {
          sender: 'mongoose',
          content: 'Kuzu zangpo la! Yes, I have your order. I am heading to your location now.',
          timestamp: new Date('2025-01-15T09:32:00Z')
        },
        {
          sender: 'client',
          content: 'Great! How long will it take approximately?',
          timestamp: new Date('2025-01-15T09:35:00Z')
        },
        {
          sender: 'mongoose',
          content: 'About 15 minutes. I am just crossing the main market area.',
          timestamp: new Date('2025-01-15T09:37:00Z')
        },
        {
          sender: 'client',
          content: 'Perfect! I will be waiting at the main gate.',
          timestamp: new Date('2025-01-15T09:40:00Z')
        },
        {
          sender: 'mongoose',
          content: 'Understood. I can see your location on the map now.',
          timestamp: new Date('2025-01-15T09:42:00Z')
        },
        {
          sender: 'client',
          content: 'I can see you approaching! Thank you for the quick delivery.',
          timestamp: new Date('2025-01-15T09:55:00Z')
        },
        {
          sender: 'mongoose',
          content: 'You are welcome! Please check your order and confirm receipt.',
          timestamp: new Date('2025-01-15T09:57:00Z')
        },
        {
          sender: 'client',
          content: 'Everything looks perfect. Thank you so much!',
          timestamp: new Date('2025-01-15T10:00:00Z')
        },
        {
          sender: 'mongoose',
          content: 'Tashi delek! Have a wonderful day!',
          timestamp: new Date('2025-01-15T10:01:00Z')
        }
      ],
      '+97517234567': [
        {
          sender: 'client',
          content: 'Hi, I need to change my delivery address urgently.',
          timestamp: new Date('2025-01-16T14:20:00Z')
        },
        {
          sender: 'mongoose',
          content: 'No problem! What is the new address?',
          timestamp: new Date('2025-01-16T14:22:00Z')
        },
        {
          sender: 'client',
          content: 'Kawajangsa, near the school. I will send you the location pin.',
          timestamp: new Date('2025-01-16T14:24:00Z')
        },
        {
          sender: 'mongoose',
          content: 'Location received! I will redirect there immediately.',
          timestamp: new Date('2025-01-16T14:26:00Z')
        }
      ]
    }
  },

  YamnangDorji: {
    name: 'Yamnang Dorji',
    clientChats: {
      '+97517345678': [
        {
          sender: 'client',
          content: 'Is it possible to deliver to the mountain village today?',
          timestamp: new Date('2025-01-16T07:15:00Z')
        },
        {
          sender: 'mongoose',
          content: 'Yes la! I am familiar with mountain routes. Which village exactly?',
          timestamp: new Date('2025-01-16T07:18:00Z')
        },
        {
          sender: 'client',
          content: 'Lingkhar village, near the monastery.',
          timestamp: new Date('2025-01-16T07:20:00Z')
        },
        {
          sender: 'mongoose',
          content: 'Perfect! I know that place well. The road is good today.',
          timestamp: new Date('2025-01-16T07:22:00Z')
        },
        {
          sender: 'client',
          content: 'Excellent! How much extra for mountain delivery?',
          timestamp: new Date('2025-01-16T07:25:00Z')
        },
        {
          sender: 'mongoose',
          content: 'Just 50 ngultrum extra for the mountain route. Very reasonable!',
          timestamp: new Date('2025-01-16T07:27:00Z')
        },
        {
          sender: 'client',
          content: 'That sounds fair. Please proceed with the delivery.',
          timestamp: new Date('2025-01-16T07:30:00Z')
        }
      ],
      '+97517456789': [
        {
          sender: 'mongoose',
          content: 'Your handicraft order is ready! When would be convenient for delivery?',
          timestamp: new Date('2025-01-17T11:00:00Z')
        },
        {
          sender: 'client',
          content: 'Anytime after 2 PM today would be great!',
          timestamp: new Date('2025-01-17T11:05:00Z')
        },
        {
          sender: 'mongoose',
          content: 'Perfect! I will come around 2:30 PM with your beautiful handicrafts.',
          timestamp: new Date('2025-01-17T11:07:00Z')
        }
      ]
    }
  }
};

// Export the static data and types
export { IMessage, IMongoose, mongooses };
export default mongooses;