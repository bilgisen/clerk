import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.split(' ')[1] || '';
  
  return NextResponse.json({
    receivedToken: token,
    receivedLength: token.length,
    receivedCharCodes: Array.from(token, c => c.charCodeAt(0)),
    expectedToken: process.env.GT_PAYLOAD_SECRET,
    expectedLength: process.env.GT_PAYLOAD_SECRET?.length,
    expectedCharCodes: process.env.GT_PAYLOAD_SECRET ? Array.from(process.env.GT_PAYLOAD_SECRET, c => c.charCodeAt(0)) : [],
    isMatch: token === process.env.GT_PAYLOAD_SECRET,
    environment: {
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV,
      vercelUrl: process.env.VERCEL_URL,
      nextPublicVerificationToken: process.env.NEXT_PUBLIC_VERIFICATION_TOKEN,
    }
  });
}
