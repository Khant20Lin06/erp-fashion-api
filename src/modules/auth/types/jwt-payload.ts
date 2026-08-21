export interface JwtPayload {
  sub: string;
  jti: string;
  iatMs?: number;
  iat: number;
  exp: number;
}
