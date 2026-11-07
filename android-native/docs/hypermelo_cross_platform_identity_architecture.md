# HyperMelo — Cross-Platform Identity & Account Architecture Technical Design

**Document Version:** 1.0.0  
**Status:** Approved Architecture Blueprint  
**Authors:** Senior Full-Stack & Android Architecture Engineers  
**Target Applications:** HyperMelo Web (React/TypeScript) & HyperMelo Native Android (Kotlin/Jetpack Compose)

---

## 1. Executive Summary & Problem Definition

### 1.1 Current Web State (Phase 0 Audit Findings)
The existing HyperMelo web client (`src/services/authService.ts`) utilizes a purely browser-local identity model:
- **Client-Side PBKDF2-HMAC-SHA256**: Generates 256-bit hashes using 100,000 iterations and a 16-byte random salt.
- **Storage Boundary**: Stored in `window.localStorage` under keys `hypermelo_auth_users` and `hypermelo_auth_current_user`.
- **Isolation Defect**: Because browser local storage is strictly isolated by browser origin, credentials and user accounts created on the web are inaccessible to Android native processes.
- **Remote Endpoint Reality**: There is currently no remote authentication endpoint (e.g. `/api/v1/auth/*`) running on the server.

### 1.2 Architectural Goal
To achieve cross-platform user parity, HyperMelo must transition from a local-only database to a unified, secure identity provider (IdP) supporting:
1. One shared account across Web, Android, and future native desktop clients.
2. Cryptographically sound token issuance and rotation (RFC 6749 OAuth 2.0 / RFC 7519 JWT).
3. Cross-platform sync for playlists, favourites, listening history, and sound engine presets.
4. Android Hardware-backed keystore token persistence (`androidx.security.crypto.EncryptedSharedPreferences`).

---

## 2. Shared Identity Provider Requirements

The identity service must be deployed as a stateless microservice or integrated into HyperMelo's backend gateway.

### 2.1 Password Hashing & Security Baseline
- **Algorithm**: Argon2id (RFC 9106) with minimum parameters:
  - Memory: 64 MB (`m=65536`)
  - Iterations: 3 (`t=3`)
  - Parallelism: 4 (`p=4`)
  - Salt: 16 bytes cryptographically secure random bytes (`CSPRNG`)
- **Transport Security**: Mandatory TLS 1.3 for all authentication endpoints with HTTP Strict Transport Security (HSTS).

### 2.2 Token Standards & Claims
- **Access Token**: Short-lived JSON Web Token (JWT) signed with Ed25519 (EdDSA) or RS256:
  - Validity: 15 minutes (`900` seconds).
  - Claims: `iss` (hypermelo.app), `sub` (user_uuid), `aud` (hypermelo-api), `exp`, `iat`, `scope` (`streaming:read`, `library:sync`, `user:profile`).
- **Refresh Token**: Opaque, high-entropy 256-bit cryptographic token:
  - Validity: 30 days.
  - Stored in server database with SHA-256 hash, client device metadata, IP address, and revocation flag.

---

## 3. REST API Contract Specification

```
POST   /api/v1/auth/register    -> Create account & issue initial tokens
POST   /api/v1/auth/login       -> Authenticate credentials & issue tokens
POST   /api/v1/auth/refresh     -> Rotate refresh token & issue new access token
GET    /api/v1/auth/me          -> Fetch authenticated user profile
POST   /api/v1/auth/logout      -> Revoke refresh token & invalidate session
POST   /api/v1/auth/google      -> OpenID Connect (OIDC) token exchange
```

### 3.1 Endpoint Schemas

#### `POST /api/v1/auth/register`
**Request:**
```json
{
  "email": "listener@hypermelo.app",
  "password": "StrongPassword!2026",
  "displayName": "AetheriaFan"
}
```
**Response (201 Created):**
```json
{
  "user": {
    "id": "usr_9f83a21b",
    "email": "listener@hypermelo.app",
    "displayName": "AetheriaFan",
    "avatarUrl": "https://cdn.hypermelo.app/avatars/default.png",
    "createdAt": "2026-11-01T10:00:00Z"
  },
  "tokens": {
    "accessToken": "eyJhbGciOiJFZERTQ...",
    "refreshToken": "rft_82a7f01c9b2e8d3a1f4...",
    "expiresIn": 900
  }
}
```

#### `POST /api/v1/auth/login`
**Request:**
```json
{
  "email": "listener@hypermelo.app",
  "password": "StrongPassword!2026",
  "deviceId": "android-emulator-5554",
  "deviceName": "Google Pixel 8 (Android 15)"
}
```

#### `POST /api/v1/auth/refresh`
**Request:**
```json
{
  "refreshToken": "rft_82a7f01c9b2e8d3a1f4..."
}
```
**Response (200 OK):**
```json
{
  "accessToken": "eyJhbGciOiJFZERTQ_NEW...",
  "refreshToken": "rft_new_token_rotated...",
  "expiresIn": 900
}
```

---

## 4. Android Native Token Storage & Lifecycle

On Android, tokens must never be written in plaintext to `SharedPreferences` or external storage.

### 4.1 Implementation: `EncryptedSharedPreferences`
```kotlin
package app.hypermelo.core.auth.security

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

class SecureTokenStorage(context: Context) {
    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val securePrefs = EncryptedSharedPreferences.create(
        context,
        "hypermelo_secure_vault",
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    fun saveTokens(accessToken: String, refreshToken: String) {
        securePrefs.edit()
            .putString("jwt_access_token", accessToken)
            .putString("opaque_refresh_token", refreshToken)
            .apply()
    }

    fun getAccessToken(): String? = securePrefs.getString("jwt_access_token", null)
    fun getRefreshToken(): String? = securePrefs.getString("opaque_refresh_token", null)
    fun clear() = securePrefs.edit().clear().apply()
}
```

### 4.2 OkHttp Authenticator with Automatic Token Refresh
```kotlin
class HyperMeloAuthenticator(
    private val tokenStorage: SecureTokenStorage,
    private val authApi: AuthApiService
) : Authenticator {
    override fun authenticate(route: Route?, response: Response): Request? {
        if (responseCount(response) >= 3) return null // Prevent refresh loop

        synchronized(this) {
            val currentRefreshToken = tokenStorage.getRefreshToken() ?: return null
            val newTokens = authApi.refreshTokenBlocking(currentRefreshToken)
            if (newTokens != null) {
                tokenStorage.saveTokens(newTokens.accessToken, newTokens.refreshToken)
                return response.request.newBuilder()
                    .header("Authorization", "Bearer ${newTokens.accessToken}")
                    .build()
            }
        }
        return null
    }
}
```

---

## 5. Web Client Session Strategy

### 5.1 Cookie-First Architecture
For web clients:
- The refresh token is issued as an `HttpOnly`, `Secure`, `SameSite=Strict` cookie path-bound to `/api/v1/auth/refresh`. This completely mitigates Cross-Site Scripting (XSS) token theft.
- The short-lived access token (15 mins) is held in memory within a React Context (`AuthContext.tsx`).
- On page reload, a background call to `/api/v1/auth/refresh` silently re-hydrates the in-memory access token.

---

## 6. Library Data Synchronization (Playlists, Liked, History)

### 6.1 CRDT / Vector Clock Sync Protocol
To prevent conflicts when a user likes songs or modifies playlists simultaneously on Web and Android:
1. **Entity Versioning**: Each entity (`Playlist`, `Favourite`, `HistoryRecord`) carries a `uuid`, `updatedAt` (UTC timestamp), and `version` integer.
2. **Delta Sync API**:
   ```
   GET  /api/v1/sync/delta?since_version=42
   POST /api/v1/sync/push
   ```
3. **Local-First Conflict Resolution**:
   - For `Liked` status: Last-Write-Wins (LWW) based on NTP-synchronized UTC timestamp.
   - For `Playlists`: Union-merge on track additions; tombstone deletion flags for removed items.

---

## 7. Migration Path for Existing Web Users

When the remote backend identity service is deployed:
1. **Automatic Migration Prompt**: The web client detects existing accounts in `localStorage`.
2. **Account Porting**: On first login, the client submits the legacy salt and hashed credentials to `POST /api/v1/auth/migrate`.
3. **Re-Hashing**: The server validates the PBKDF2 hash, upgrades the password to Argon2id, creates the remote user row, and clears local storage credentials.
4. **Unified Access**: The user can immediately sign in to Android Native with identical credentials.

