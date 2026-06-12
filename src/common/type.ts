export enum UserRole {
    ADMIN = 'admin',
    USER = 'user',
    VENDOR = 'vendor',
  }
  export interface JwtPayload {
    sub: number;
    email: string;
    role: string;
  }