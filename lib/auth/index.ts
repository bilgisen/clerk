// lib/auth/index.ts

// Re-export all auth client functionality
import authClient, { 
  signIn, 
  signOut, 
  useSession, 
  getSession, 
  refreshSession, 
  updateProfile, 
  getToken, 
  getUser 
} from './auth-client';

// Import the better-auth instance
import { auth } from './better-auth';

// Import utility functions directly
import { hashPassword, verifyPassword } from './utils/password';
import { generateToken, verifyToken } from './utils/token';

// Export types
export type { 
  User, 
  ExtendedUser,
  // Add other types as needed
} from './auth-types';

// Re-export auth utilities (These lines are correct for re-exporting)
export { hashPassword, verifyPassword } from './utils/password';
export { generateToken, verifyToken } from './utils/token';

// Default export with all auth functionality
const authExports = {
  // Client methods
  authClient,
  signIn,
  signOut,
  useSession,
  getSession,
  refreshSession,
  updateProfile,
  getToken,
  getUser,
  
  // Auth instance - explicitly assign the imported 'auth'
  auth: auth, 
  
  // Utilities - Use the directly imported functions
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
};

export default authExports;
