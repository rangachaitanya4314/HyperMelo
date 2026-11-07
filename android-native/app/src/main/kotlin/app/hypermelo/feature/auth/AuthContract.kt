package app.hypermelo.feature.auth

/**
 * HyperMelo Cross-Platform Account Architecture Contract
 *
 * Current State Audit:
 * --------------------
 * - The web application (src/services/authService.ts) currently uses a local-first
 *   cryptographic identity scheme relying on PBKDF2-HMAC-SHA256 (100,000 iterations)
 *   stored inside the browser's window.localStorage ('hypermelo_auth_users', 'hypermelo_auth_current_user').
 * - There is NO remote identity server or shared session backend endpoint deployed.
 * - Because web localStorage is completely sandboxed inside the browser and cannot be
 *   accessed by Android native processes, any local-only solution would cause user data
 *   isolation and break cross-platform identity.
 *
 * Required Backend REST Service Contract for Cross-Platform Identity:
 * -------------------------------------------------------------------
 * 1. POST /api/v1/auth/register
 *    Request: { "email": "user@example.com", "password": "...", "displayName": "..." }
 *    Response: { "token": "jwt_access_token", "refreshToken": "...", "user": { "id": "...", "email": "...", "displayName": "..." } }
 *
 * 2. POST /api/v1/auth/login
 *    Request: { "email": "user@example.com", "password": "..." }
 *    Response: { "token": "jwt_access_token", "refreshToken": "...", "user": { ... } }
 *
 * 3. GET /api/v1/auth/me
 *    Header: Authorization: Bearer <token>
 *    Response: { "user": { "id": "...", "email": "...", "displayName": "...", "avatarUrl": "..." } }
 *
 * 4. POST /api/v1/auth/refresh
 *    Request: { "refreshToken": "..." }
 *    Response: { "token": "jwt_access_token" }
 *
 * 5. POST /api/v1/auth/logout
 *    Header: Authorization: Bearer <token>
 *    Response: { "status": "ok" }
 */
data class AuthToken(
    val accessToken: String,
    val refreshToken: String,
    val expiresInSeconds: Long
)

