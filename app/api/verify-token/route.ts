import { NextResponse } from 'next/server';

const SECRET_TOKEN = process.env.GT_PAYLOAD_SECRET || '';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.split(' ')[1] || '';
  
  // Log the raw values
  console.log('Raw token from header:', token);
  console.log('Raw secret from env:', SECRET_TOKEN);
  
  // Log lengths
  console.log('Token length:', token.length);
  console.log('Secret length:', SECRET_TOKEN.length);
  
  // Log character codes
  console.log('Token char codes:', [...token].map(c => c.charCodeAt(0)));
  console.log('Secret char codes:', [...SECRET_TOKEN].map(c => c.charCodeAt(0)));
  
  // Compare character by character
  let mismatchIndex = -1;
  const minLength = Math.min(token.length, SECRET_TOKEN.length);
  for (let i = 0; i < minLength; i++) {
    if (token[i] !== SECRET_TOKEN[i]) {
      mismatchIndex = i;
      break;
    }
  }
  
  return NextResponse.json({
    receivedToken: token,
    expectedToken: SECRET_TOKEN,
    lengthsMatch: token.length === SECRET_TOKEN.length,
    tokenLength: token.length,
    secretLength: SECRET_TOKEN.length,
    tokenCharCodes: [...token].map(c => c.charCodeAt(0)),
    secretCharCodes: [...SECRET_TOKEN].map(c => c.charCodeAt(0)),
    firstMismatchAt: mismatchIndex >= 0 ? {
      position: mismatchIndex,
      tokenChar: token[mismatchIndex],
      tokenCharCode: token.charCodeAt(mismatchIndex),
      secretChar: SECRET_TOKEN[mismatchIndex],
      secretCharCode: SECRET_TOKEN.charCodeAt(mismatchIndex)
    } : null,
    isMatch: token === SECRET_TOKEN,
    environment: {
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV,
      nextPublicVerificationToken: process.env.NEXT_PUBLIC_VERIFICATION_TOKEN,
    }
  });
}
