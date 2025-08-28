// Set up test environment variables
process.env.NODE_ENV = 'test';
process.env.REDIS_URL = 'redis://localhost:6379/0';
process.env.COMBINED_JWT_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIAh9UqP6pW3s5JqQ3JzJ+J3eX4jKX8X5J6v8X9J7X8X
-----END PRIVATE KEY-----`;
process.env.COMBINED_JWT_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAh9UqP6pW3s5JqQ3JzJ+J3eX4jKX8X5J6v8X9J7X8X8=
-----END PUBLIC KEY-----`;
