// Jest setup file
// Load environment variables for testing
require('dotenv').config({ path: '.env.local' });

// Set test environment variables if not already set
if (!process.env.MONGODB_URI) {
  process.env.MONGODB_URI = 'mongodb+srv://agent:6mLBsjMMRoHzgfq8@ai.xlusxlw.mongodb.net/agric-test?retryWrites=true&w=majority';
}

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test-secret-key';
}
