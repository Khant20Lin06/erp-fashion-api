/**
 * Identity extracted directly from a validated JWT. Deliberately minimal —
 * the token carries only a user id (see Phase 05's JWT claim policy), so
 * this type must not grow additional fields the token does not actually
 * provide. Endpoints needing full profile data must fetch it fresh via
 * AuthService rather than trusting stale token claims.
 */
export interface AuthenticatedUser {
  id: string;
}
