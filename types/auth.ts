export type AuthContextUnion = 
  | { type: 'github-oidc'; userId: string; repository: string; run_id: string; workflow: string; }
  | { type: 'clerk'; userId: string; sessionId: string; }
  | { type: 'unauthorized' };

export interface AuthRequest extends Request {
  authContext: AuthContextUnion;
}
