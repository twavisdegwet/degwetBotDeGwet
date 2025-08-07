// Test setup file for Jest
import dotenv from 'dotenv';

// Load environment variables for testing
dotenv.config({ path: '.env.local' });

// Set test timeout
jest.setTimeout(10000);
