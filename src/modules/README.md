/**
 * Liven API module layout
 *
 * src/modules/
 *   auth/          Authentication (admin + customer) — access/refresh tokens in JSON body
 *   admin/         Admin panel domain APIs (to be filled)
 *   customer/      Shopper panel domain APIs (to be filled)
 *   public/        No-token public storefront APIs (to be filled)
 *
 * Auth routes (prefix /api/v1):
 *   POST /admin/auth/login
 *   POST /admin/auth/refresh
 *   POST /admin/auth/logout
 *   POST /customer/auth/register
 *   POST /customer/auth/login
 *   POST /customer/auth/otp/request
 *   POST /customer/auth/otp/verify
 *   POST /customer/auth/refresh
 *   POST /customer/auth/logout
 *
 * Guards: use JwtAuthGuard + @Roles() + @AuthAudienceRequired('admin'|'customer')
 * Client: Authorization: Bearer <accessToken>
 */
