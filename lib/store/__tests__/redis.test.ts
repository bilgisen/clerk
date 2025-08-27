import { createSession, getSession, updateSession, deleteSession, getSessionsByUser } from '../redis';
import { v4 as uuidv4 } from 'uuid';

describe('Redis Session Store', () => {
  const userId = 'user_123';
  const contentId = 'content_456';
  let sessionId: string = '';

  beforeAll(() => {
    // Ensure we have a clean state before tests
    process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
  });

  afterEach(async () => {
    // Clean up after each test
    if (sessionId) {
      await deleteSession(sessionId);
    }
  });

  test('should create and retrieve a session', async () => {
    const testSession = {
      id: `test_${uuidv4()}`,
      userId,
      contentId,
      nonce: 'test-nonce',
      status: 'pending-runner' as const,
    };

    // Create session
    const created = await createSession(testSession);
    expect(created).toBeDefined();
    expect(created?.id).toBe(testSession.id);
    expect(created?.userId).toBe(userId);
    expect(created?.status).toBe('pending-runner');
    expect(created?.createdAt).toBeDefined();
    expect(created?.updatedAt).toBeDefined();

    // Retrieve session
    const retrieved = await getSession(testSession.id);
    expect(retrieved).toEqual(created);
  });

  test('should update a session', async () => {
    const testSession = {
      id: `test_${uuidv4()}`,
      userId,
      contentId,
      nonce: 'test-nonce',
      status: 'pending-runner' as const,
    };

    // Create session
    const created = await createSession(testSession);
    expect(created).toBeDefined();

    // Update session
    const updated = await updateSession(testSession.id, {
      status: 'processing',
      message: 'Processing started',
      progress: 25,
    });

    expect(updated).toBeDefined();
    expect(updated?.status).toBe('processing');
    expect(updated?.message).toBe('Processing started');
    expect(updated?.progress).toBe(25);
    expect(updated?.updatedAt).toBeGreaterThan(created?.updatedAt || 0);
  });

  test('should get sessions by user with filters', async () => {
    const userId1 = `user_${uuidv4()}`;
    const userId2 = `user_${uuidv4()}`;
    
    // Create test sessions
    const sessions = [
      { id: `sess_${uuidv4()}`, userId: userId1, contentId: 'content_1', nonce: 'n1', status: 'completed' as const },
      { id: `sess_${uuidv4()}`, userId: userId1, contentId: 'content_2', nonce: 'n2', status: 'failed' as const },
      { id: `sess_${uuidv4()}`, userId: userId1, contentId: 'content_3', nonce: 'n3', status: 'processing' as const },
      { id: `sess_${uuidv4()}`, userId: userId2, contentId: 'content_4', nonce: 'n4', status: 'completed' as const },
    ];

    // Create all sessions
    for (const session of sessions) {
      await createSession(session);
    }

    try {
      // Test get all sessions for user1
      const user1Sessions = await getSessionsByUser(userId1);
      expect(user1Sessions.total).toBe(3);
      expect(user1Sessions.sessions).toHaveLength(3);

      // Test status filter
      const completedSessions = await getSessionsByUser(userId1, { status: ['completed'] });
      expect(completedSessions.total).toBe(1);
      expect(completedSessions.sessions[0].status).toBe('completed');

      // Test pagination
      const paginated = await getSessionsByUser(userId1, { limit: 1, offset: 1 });
      expect(paginated.total).toBe(3);
      expect(paginated.sessions).toHaveLength(1);
    } finally {
      // Clean up
      for (const session of sessions) {
        await deleteSession(session.id);
      }
    }
  });

  test('should delete a session', async () => {
    const testSession = {
      id: `test_${uuidv4()}`,
      userId,
      contentId,
      nonce: 'test-nonce',
      status: 'pending-runner' as const,
    };

    // Create session
    await createSession(testSession);
    
    // Verify it exists
    const found = await getSession(testSession.id);
    expect(found).toBeDefined();

    // Delete session
    const deleted = await deleteSession(testSession.id);
    expect(deleted).toBe(true);

    // Verify it's gone
    const notFound = await getSession(testSession.id);
    expect(notFound).toBeNull();
  });
});
