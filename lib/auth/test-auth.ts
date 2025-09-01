import auth from './better-auth';

async function testAuth() {
  try {
    console.log('Testing auth instance...');
    
    // Create a mock request
    const request = new Request('http://localhost:3000/api/auth/session', {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Call the auth handler
    const response = await auth.handler(request);
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Auth instance is working correctly');
      console.log('Session data:', data);
    } else {
      console.log('🔴 Auth instance returned an error:');
      console.log('Status:', response.status);
      console.log('Error:', data);
    }
    
  } catch (error) {
    console.error('❌ Error testing auth instance:');
    console.error(error);
  } finally {
    process.exit(0);
  }
}

testAuth();
