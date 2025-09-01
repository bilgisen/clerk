import * as betterAuthPkg from 'better-auth';
import * as betterAuthDrizzlePkg from 'better-auth/adapters/drizzle';

console.log('Better Auth Exports:');
console.log(Object.keys(betterAuthPkg));

console.log('\nDrizzle Adapter Exports:');
console.log(Object.keys(betterAuthDrizzlePkg));

// Try to import specific exports
console.log('\nTrying to import specific exports...');
try {
  // @ts-ignore - We're testing if these exist at runtime
  const { betterAuth } = betterAuthPkg;
  console.log('✅ betterAuth export exists:', typeof betterAuth === 'function');
} catch (error) {
  console.error('❌ betterAuth export error:', error);
}

try {
  // @ts-ignore - We're testing if these exist at runtime
  const { drizzleAdapter } = betterAuthDrizzlePkg;
  console.log('✅ drizzleAdapter export exists:', typeof drizzleAdapter === 'function');
} catch (error) {
  console.error('❌ drizzleAdapter export error:', error);
}
