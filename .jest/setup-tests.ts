// Mock environment variables for tests
process.env.COMBINED_JWT_PRIVATE_KEY = 'MC4CAQAwBQYDK2VwBCIEIAh9UqP6pW3s5JqQ3JzJ+J3eX4jKX8X5J6v8X9J7X8X';
process.env.COMBINED_JWT_PUBLIC_KEY = 'MCowBQYDK2VwAyEAh9UqP6pW3s5JqQ3JzJ+J3eX4jKX8X5J6v8X9J7X8X8=';
process.env.COMBINED_JWT_AUDIENCE = 'test-audience';

// Mock Redis client
jest.mock('@/lib/store/redis', () => {
  const sessions = new Map();
  
  return {
    createSession: jest.fn(async (session) => {
      const now = Date.now();
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
        updatedAt: Date.now()
      };
      sessions.set(id, updated);
      return updated;
    }),
    
    deleteSession: jest.fn(async (id) => {
      return sessions.delete(id);
    }),
    
    getSessionsByUser: jest.fn(async (userId, filters = {}) => {
      const userSessions = Array.from(sessions.values())
        .filter(session => session.userId === userId)
        .filter(session => {
          if (filters.status && !filters.status.includes(session.status)) return false;
          if (filters.contentId && session.contentId !== filters.contentId) return false;
          return true;
        });
      
      return {
        total: userSessions.length,
        sessions: userSessions,
      };
    }),
  };
});

// Session-based authentication mocks are handled in individual test files
