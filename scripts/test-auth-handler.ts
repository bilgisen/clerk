import { auth } from '@/lib/auth/better-auth';

async function testAuthHandler() {
  try {
    console.log('Testing auth handler...');
    
    // Create a simple request to the auth endpoint
    const request = new Request('http://localhost:3000/api/auth/session', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Call the auth handler
    console.log('Calling auth.handler...');
    const response = await auth.handler(request);
    
    // Log the response status and headers
    console.log('Response status:', response.status);
    console.log('Response headers:');
    response.headers.forEach((value, key) => {
      console.log(`  ${key}: ${value}`);
    });
    
    // Try to parse and log the response body
    try {
      const data = await response.json();
      console.log('Response data:', JSON.stringify(data, null, 2));
    } catch (e) {
      console.log('No JSON response body');
      const text = await response.text();
      console.log('Response text:', text);
    }
    
  } catch (error) {
    console.error('Error in testAuthHandler:');
    if (error instanceof Error) {
      console.error('Message:', error.message);
      console.error('Stack:', error.stack);
    } else {
      console.error('Unknown error:', error);
    }
  }
}

// Run the test
testAuthHandler();
