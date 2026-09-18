export type AuthAudience = 'admin' | 'customer';

export interface AccessTokenPayload {
  sub: string; // user uuid
  email: string | null;
  phone: string | null;
  roles: string[];
  audience: AuthAudience;
  typ: 'access';
  /** Present when an admin is shopping as this customer */
  impersonatedBy?: string;
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string; // refresh token uuid in DB
  audience: AuthAudience;
  typ: 'refresh';
}

export interface AuthTokensResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
}

export interface AuthUserResponse {
  uuid: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  avatar: string | null;
  roles: string[];
}
