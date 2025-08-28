// Import with require to avoid hoisting issues
const { generateCombinedToken, verifyCombinedToken, getKeys } = require('../combined-token');
const { v4: uuidv4 } = require('uuid');
const { SignJWT, jwtVerify, importPKCS8, importSPKI, generateKeyPair, exportPKCS8, exportSPKI } = require('jose');
const { promisify } = require('util');
const crypto = require('crypto');

// Set environment variables before any imports that might use them
process.env.COMBINED_JWT_AUDIENCE = 'test-audience';

// Generate test keys and set up mocks
let testPrivateKey: string;
let testPublicKey: string;

beforeAll(async () => {
  // Generate a new key pair for testing
  const { publicKey, privateKey } = await generateKeyPair('EdDSA', {
    crv: 'Ed25519',
  });
  
  // Export keys to PKCS8/SPKI format
  testPrivateKey = await exportPKCS8(privateKey);
  testPublicKey = await exportSPKI(publicKey);
  
  // Set environment variables with base64-encoded keys
  process.env.COMBINED_JWT_PRIVATE_KEY_B64 = Buffer.from(testPrivateKey).toString('base64');
  process.env.COMBINED_JWT_PUBLIC_KEY_B64 = Buffer.from(testPublicKey).toString('base64');
});

// Clear environment variables after tests
afterAll(() => {
  delete process.env.COMBINED_JWT_PRIVATE_KEY_B64;
  delete process.env.COMBINED_JWT_PUBLIC_KEY_B64;
  delete process.env.COMBINED_JWT_AUDIENCE;
});

// Mock the getKeys function to use our test keys
jest.mock('../combined-token', () => {
  const originalModule = jest.requireActual('../combined-token');
  
  return {
    ...originalModule,
    getKeys: jest.fn().mockImplementation(async () => {
      const privateKey = await importPKCS8(testPrivateKey, 'EdDSA');
      const publicKey = await importSPKI(testPublicKey, 'EdDSA');
      
      return { 
        privateKey, 
        publicKey 
      };
    })
  };
});

// Mock Redis client
jest.mock('@/lib/store/redis', () => {
  const sessions = new Map();
  
  return {
    createSession: jest.fn(async (session) => {
      const now = new Date().toISOString();
      const sessionWithTimestamps = {
        ...session,
        createdAt: now,
        updatedAt: now,
      };
      sessions.set(session.id, sessionWithTimestamps);
      return sessionWithTimestamps;
    }),
    
    getSession: jest.fn(async (id) => {
      return sessions.get(id) || null;
    }),
    
    updateSession: jest.fn(async (id, updates) => {
      const existing = sessions.get(id);
      if (!existing) return null;
      
      const updated = { 
        ...existing, 
        ...updates,
        updatedAt: new Date().toISOString()
      };
      sessions.set(id, updated);
      return updated;
    }),
  };
});

// Mock GitHub OIDC verification
jest.mock('@/lib/auth/github-oidc', () => ({
  verifyGithubOidc: jest.fn().mockResolvedValue({
    repository: 'test/repo',
    run_id: '123456789',
    run_number: '1',
    workflow: 'test-workflow',
    sha: 'abc123',
    actor: 'test-actor',
    event_name: 'push',
    ref: 'refs/heads/main',
    head_ref: 'test-head-ref',
    base_ref: 'test-base-ref',
  }),
}));

describe('Combined Token', () => {
  const mockSession = {
    id: 'test-session-123',
    userId: 'user-123',
    contentId: 'content-456',
    nonce: 'test-nonce',
    status: 'pending-runner' as const,
    metadata: {},
    gh: {
      repository: 'test/repo',
      run_id: '123456789',
      workflow: 'test-workflow',
      sha: 'abc123',
    },
  };

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  test('should generate and verify a valid token', async () => {
    // Generate token
    const token = await generateCombinedToken(
      {
        sessionId: mockSession.id,
        userId: mockSession.userId,
        contentId: mockSession.contentId,
        nonce: mockSession.nonce,
        tokenType: 'ci' as const,
        permissions: {
          can_publish: true,
          can_generate: true,
          can_manage: false
        },
        gh: mockSession.gh,
        metadata: {},
        status: 'active',
        progress: 0,
        phase: 'testing',
        message: 'Test token generation'
      },
      'test-audience'
    );

    expect(token).toBeDefined();
    expect(typeof token).toBe('string');

    // Verify token
    const payload = await verifyCombinedToken(
      token,
      'test-audience'
    );

    expect(payload).toBeDefined();
    expect(payload.sub).toBe(mockSession.id);
    expect(payload.aud).toBe('test-audience');
    expect(payload.session_id).toBe(mockSession.id);
    expect(payload.user_id).toBe(mockSession.userId);
    expect(payload.content_id).toBe(mockSession.contentId);
    expect(payload.nonce).toBe(mockSession.nonce);
  });

  test('should reject expired tokens', async () => {
    // Generate token with 1 second expiration
    const token = await generateCombinedToken(
      {
        ...mockSession,
        sessionId: mockSession.id,
        tokenType: 'ci' as const,
        permissions: {
          can_publish: true,
          can_generate: true,
          can_manage: false
        }
      },
      'test-audience',
      1 // 1 second expiration
    );

    // Wait for token to expire
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Should throw expired error
    await expect(
      verifyCombinedToken(token, 'test-audience')
    ).rejects.toThrow('Token has expired');
  });

  test('should reject tokens with invalid audience', async () => {
    const token = await generateCombinedToken(
      {
        ...mockSession,
        sessionId: mockSession.id,
        tokenType: 'ci' as const,
        permissions: {
          can_publish: true,
          can_generate: true,
          can_manage: false
        }
      },
      'correct-audience'
    );

    await expect(
      verifyCombinedToken(token, 'wrong-audience')
    ).rejects.toThrow('Invalid token');
  });
});
