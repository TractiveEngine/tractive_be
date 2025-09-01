import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || '';

if (!MONGODB_URI) throw new Error('Please define the MONGODB_URI environment variable');

type Cached = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalAny = global as unknown as { mongoose?: Cached };
const cached: Cached = globalAny.mongoose || { conn: null, promise: null };

async function dbConnect(): Promise<typeof mongoose> {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI).then((mongoose) => mongoose);
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

globalAny.mongoose = cached;

export default dbConnect;
