import axios from 'axios';
import https from 'https';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Create an axios instance that doesn't reject unauthorized certificates
const api = axios.create({
  httpsAgent: new https.Agent({  
    rejectUnauthorized: false
  }),
  baseURL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  withCredentials: true, // Important for cookies
});

// Helper function to test an endpoint
async function testEndpoint(url: string, method: 'GET' | 'POST' = 'GET', data?: any) {
  try {
    console.log(`\nTesting ${method} ${url}`);
    const response = await api({
      method,
      url,
      data,
      maxRedirects: 0,
      validateStatus: (status) => status < 400 || status === 401 || status === 302
    });
    
    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log('Headers:', response.headers);
    if (response.data) {
      console.log('Response:', response.data);
    }
    return response;
  } catch (error: any) {
    if (error.response) {
      console.error(`Error: ${error.response.status} ${error.response.statusText}`);
      console.error('Response:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
    return null;
  }
}

async function testAuthEndpoints() {
  console.log('Starting auth endpoint tests...');
  
  // 1. Test session endpoint
  console.log('\n--- Testing Session Endpoint ---');
  await testEndpoint('/api/auth/session', 'GET');
  
  // 2. Test Google sign-in URL
  console.log('\n--- Testing Google Sign-in ---');
  const signInRes = await testEndpoint('/api/auth/signin/google', 'GET');
  
  // 3. Test token endpoint
  console.log('\n--- Testing Token Endpoint ---');
  await testEndpoint('/api/auth/token', 'GET');
  
  console.log('\n--- Auth Endpoint Tests Complete ---');
}

// Run the tests
testAuthEndpoints().catch(console.error);
testAuthEndpoints().catch(console.error);
