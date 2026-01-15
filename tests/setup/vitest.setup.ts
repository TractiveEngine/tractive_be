// Load environment variables for testing
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Set test environment variables
process.env.MONGODB_URI_TEST = process.env.MONGODB_URI_TEST || 'mongodb+srv://agent:6mLBsjMMRoHzgfq8@ai.xlusxlw.mongodb.net/agric-test?retryWrites=true&w=majority';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-change-in-production';
process.env.NODE_ENV = 'test';
