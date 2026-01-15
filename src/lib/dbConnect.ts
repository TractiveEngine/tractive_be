import mongoose from 'mongoose';

// Use test database in test environment, otherwise use production database
const MONGODB_URI = process.env.NODE_ENV === 'test' 
  ? process.env.MONGODB_URI_TEST || ''
  : process.env.MONGODB_URI || '';

if (!MONGODB_URI) throw new Error('Please define the MONGODB_URI environment variable');

type Cached = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalAny = global as unknown as { mongoose?: Cached };
const cached: Cached = globalAny.mongoose || { conn: null, promise: null };

async function dbConnect(): Promise<typeof mongoose> {
  // In test environment, if mongoose is already connected, just return it
  if (process.env.NODE_ENV === 'test' && mongoose.connection.readyState >= 1) {
    return mongoose;
  }
  
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI).then((mongoose) => mongoose);
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

globalAny.mongoose = cached;

export default dbConnect;
