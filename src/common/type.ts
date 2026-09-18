export { RoleSlug, UserRole } from 'src/entities';
export { Roles, AuthAudienceRequired } from 'src/modules/auth/shared/roles.decorator';
export { JwtAuthGuard } from 'src/modules/auth/shared/jwt-auth.guard';

export interface JwtPayload {
  sub: string;
  email: string | null;
  phone: string | null;
  roles: string[];
  audience: 'admin' | 'customer';
}
