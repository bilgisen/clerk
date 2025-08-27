import { generateCombinedToken, verifyCombinedToken } from '../combined-token';
import { createSession } from '@/lib/store/redis';
import { v4 as uuidv4 } from 'uuid';

// Mock environment variables
process.env.COMBINED_JWT_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIAh9UqP6pW3s5JqQ3JzJ+J3eX4jKX8X5J6v8X9J7X8X
-----END PRIVATE KEY-----`;

process.env.COMBINED_JWT_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAh9UqP6pW3s5JqQ3JzJ+J3eX4jKX8X5J6v8X9J7X8X8=
-----END PUBLIC KEY-----`;

describe('Combined Token', () => {
  const mockSession = {
    id: 'test-session-123',
    userId: 'user-123',
    contentId: 'content-456',
    nonce: 'test-nonce',
    status: 'pending-runner' as const,
    gh: {
      repository: 'test/repo',
      run_id: '123456789',
      workflow: 'test-workflow',
      sha: 'abc123',
    },
  };

  test('should generate and verify a valid token', async () => {
    // Generate token
    const token = await generateCombinedToken(
      mockSession,
      process.env.COMBINED_JWT_PRIVATE_KEY!,
      'test-audience'
    );

    expect(token).toBeDefined();
    expect(typeof token).toBe('string');

    // Verify token
    const payload = await verifyCombinedToken(
      token,
      process.env.COMBINED_JWT_PUBLIC_KEY!,
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
      mockSession,
      process.env.COMBINED_JWT_PRIVATE_KEY!,
      'test-audience',
      1 // 1 second expiration
    );

    // Wait for token to expire
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Should throw expired error
    await expect(
      verifyCombinedToken(
        token,
        process.env.COMBINED_JWT_PUBLIC_KEY!,
        'test-audience'
      )
    ).rejects.toThrow('Token has expired');
  });

  test('should reject tokens with invalid audience', async () => {
    const token = await generateCombinedToken(
      mockSession,
      process.env.COMBINED_JWT_PRIVATE_KEY!,
      'correct-audience'
    );

    await expect(
      verifyCombinedToken(
        token,
        process.env.COMBINED_JWT_PUBLIC_KEY!,
        'wrong-audience'
      )
    ).rejects.toThrow('Invalid token');
  });
});
