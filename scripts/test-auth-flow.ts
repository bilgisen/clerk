import { NextResponse } from 'next/server';

// Test the sign-up flow
async function testSignUp() {
  console.log('Testing sign-up flow...');
  
  const response = await fetch('http://localhost:3000/api/auth/signup', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: `test-${Date.now()}@example.com`,
      password: 'password123',
      name: 'Test User'
    }),
  });

  const data = await response.json();
  console.log('Sign-up response:', {
    status: response.status,
    data,
    cookies: response.headers.getSetCookie()
  });

  return { response, data };
}

// Test the sign-in flow
async function testSignIn(email: string, password: string) {
  console.log('Testing sign-in flow...');
  
  const response = await fetch('http://localhost:3000/api/auth/signin', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
    }),
  });

  const data = await response.json();
  console.log('Sign-in response:', {
    status: response.status,
    data,
    cookies: response.headers.getSetCookie()
  });

  return { response, data };
}

// Run the tests
async function runTests() {
  try {
    // Test sign-up
    const { data: signUpData } = await testSignUp();
    
    if (signUpData.user) {
      // Test sign-in with the newly created user
      await testSignIn(signUpData.user.email, 'password123');
    }
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

runTests();
