export { UserRole } from '@liven/entities';

export interface JwtPayload {
  sub: number;
  email: string;
  role: string;
}
