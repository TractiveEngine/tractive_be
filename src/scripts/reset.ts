import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI || '';

if (!MONGODB_URI) {
  throw new Error('Please define MONGODB_URI in .env.local');
}

async function reset() {
  console.log('🔄 Starting database reset...');

  try {
    // Connect to database
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Drop all collections
    console.log('🗑️  Dropping all collections...');
    const collections = mongoose.connection.collections;
    
    let droppedCount = 0;
    for (const key in collections) {
      await collections[key].deleteMany({});
      droppedCount++;
      console.log(`   ✓ Cleared collection: ${key}`);
    }

    console.log(`\n✅ Reset complete! Cleared ${droppedCount} collections.`);

  } catch (error) {
    console.error('❌ Error resetting database:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('👋 Disconnected from MongoDB');
  }
}

// Run the reset function
reset();
