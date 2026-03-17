import mongoose from 'mongoose';

const MONGODB_URI_TEST = process.env.MONGODB_URI_TEST || '';

if (!MONGODB_URI_TEST) {
  throw new Error('Please define MONGODB_URI_TEST environment variable');
}

/**
 * Connect to test database
 */
export async function connectTestDB() {
  if (mongoose.connection.readyState >= 1) {
    return;
  }
  await mongoose.connect(MONGODB_URI_TEST);
}

/**
 * Clear all collections in the test database
 */
export async function clearTestDB() {
  if (!mongoose.connection.db) {
    return;
  }
  const collections = await mongoose.connection.db.listCollections().toArray();
  await Promise.all(
    collections.map((collection) =>
      mongoose.connection.db!.collection(collection.name).deleteMany({})
    )
  );
}

/**
 * Disconnect from test database
 */
export async function disconnectTestDB() {
  await mongoose.connection.close();
}

/**
 * Setup function to run before each test
 */
export async function setupTest() {
  await connectTestDB();
  await clearTestDB();
}

/**
 * Teardown function to run after all tests
 */
export async function teardownTest() {
  await disconnectTestDB();
}
