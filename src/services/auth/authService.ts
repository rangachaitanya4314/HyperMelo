// HyperMelo Authentication Service
// Manages local-first user accounts, PBKDF2 password hashing, email sign-in / registration,
// genuine Google OAuth configuration, session persistence ("Remember me"), and guest access.
//
// ARCHITECTURAL SECURITY BOUNDARY DISCLOSURE:
// HyperMelo operates in a local-first browser architecture.
// User accounts and sessions are stored in browser Web Storage (localStorage / sessionStorage).
// Password hashing using Web Crypto PBKDF2-HMAC-SHA256 (100,000 iterations) with unique random salts
// protects stored credentials against casual offline storage inspection on the local device.
//
// LIMITATIONS:
// Client-side password hashing and localStorage sessions do NOT provide:
// 1. Cryptographic tamper-proofing against local browser DevTools / extension modification.
// 2. Server-side session authentication or server-validated cryptographic signatures.
// 3. Multi-device synchronization.
// 4. Automated email delivery for remote password recovery.
// Real server-side authentication and Google OAuth backend verification will be implemented in a future phase.

import { personalLibraryStore, type User } from '../storage/personalLibraryStore';

export interface AuthSession {
  user: User;
  token: string;
  rememberMe: boolean;
  expiresAt: number;
}

export interface StoredUserAccount {
  id: string;
  name: string;
  email: string;
  passwordHash?: string;
  salt?: string;
  hashAlgorithm?: 'pbkdf2-sha256' | 'sha256-legacy';
  iterations?: number;
  provider: 'local' | 'google';
  avatar?: string;
  createdAt: number;
  lastLoginAt: number;
}

export interface PasswordRecoveryAdvisory {
  supported: false;
  email: string;
  message: string;
  recoveryOptions: string[];
}

export interface GoogleAuthConfig {
  configured: boolean;
  clientId: string | null;
  redirectUri: string;
  missingSettings: string[];
}

const STORAGE_KEY_SESSION = 'hypermelo_auth_session';
const STORAGE_KEY_LEGACY_SESSION = 'naro_auth_session';
const STORAGE_KEY_ACCOUNTS = 'hypermelo_registered_accounts';

export const PBKDF2_ITERATIONS = 100000;

function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.trim();
  if (/^[0-9a-fA-F]+$/.test(cleanHex) && cleanHex.length % 2 === 0) {
    const matches = cleanHex.match(/.{1,2}/g);
    if (matches) {
      return new Uint8Array(matches.map((byte) => parseInt(byte, 16)));
    }
  }
  return new TextEncoder().encode(cleanHex);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Derives a secure password hash using Web Crypto PBKDF2-HMAC-SHA256.
 * Uses 100,000 iterations and returns a 256-bit (32-byte) hex string.
 * Fails safely if Web Crypto API is unavailable.
 */
export async function hashPasswordPBKDF2(
  password: string,
  salt: string,
  iterations = PBKDF2_ITERATIONS
): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error(
      'Secure cryptographic operations (Web Crypto API) are not available in this environment. Password hashing requires a secure context (HTTPS or localhost).'
    );
  }

  const enc = new TextEncoder();
  const saltBytes = hexToBytes(salt);

  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes as unknown as BufferSource,
      iterations,
      hash: 'SHA-256'
    },
    baseKey,
    256 // 256 bits = 32 bytes
  );

  return bytesToHex(new Uint8Array(derivedBits));
}

/**
 * Computes legacy single-round SHA-256 hash for verifying and migrating older accounts.
 * Fails safely if Web Crypto is unavailable (no insecure fallback).
 */
export async function hashPasswordLegacySha256(password: string, salt: string): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error(
      'Secure cryptographic operations (Web Crypto API) are not available in this environment.'
    );
  }
  const enc = new TextEncoder();
  const data = enc.encode(`${salt}:${password}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return bytesToHex(new Uint8Array(hashBuffer));
}

/**
 * Generates a cryptographically strong random salt.
 * Fails safely if crypto.getRandomValues is unavailable.
 */
export function generateSalt(byteLength = 16): string {
  if (typeof crypto === 'undefined' || !crypto.getRandomValues) {
    throw new Error(
      'Secure random number generation (crypto.getRandomValues) is unavailable in this environment.'
    );
  }
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

class AuthService {
  private currentUser: User | null = null;
  private listeners: Set<(user: User | null) => void> = new Set();
  private isGoogleScriptLoading = false;
  private mockGoogleEnabled = false;
  private demoAccountsEnabled = false;

  private getStorage(type: 'local' | 'session'): Storage | null {
    if (type === 'local') {
      if (typeof localStorage !== 'undefined') return localStorage;
      if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
    } else {
      if (typeof sessionStorage !== 'undefined') return sessionStorage;
      if (typeof window !== 'undefined' && window.sessionStorage) return window.sessionStorage;
    }
    return null;
  }

  constructor() {
    this.seedDefaultAccounts();
    this.restoreSession();
    this.checkOAuthRedirect();
  }

  /**
   * Explicitly enable demo fixtures for testing or evaluation.
   * In normal production usage, demo accounts are never seeded.
   */
  public enableDemoAccountForTesting(enabled: boolean): void {
    this.demoAccountsEnabled = enabled;
    if (enabled) {
      this.seedDefaultAccounts();
    }
  }

  /**
   * Determines whether demo account seeding is permitted.
   * Only permitted when explicitly enabled via test flag or dev environment.
   */
  public isDemoAccountEnabled(): boolean {
    if (this.demoAccountsEnabled) return true;
    if (
      typeof window !== 'undefined' &&
      (window as unknown as { __HYPERMELO_ENABLE_DEMO__?: boolean }).__HYPERMELO_ENABLE_DEMO__ === true
    ) {
      return true;
    }
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      if (import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEMO_ACCOUNT === 'true') {
        return true;
      }
    }
    return false;
  }

  /**
   * Seeds demo account only when explicitly permitted by test/dev flag.
   * In production mode, ensures demo accounts are absent from the registry.
   */
  public seedDefaultAccounts(): void {
    const storage = this.getStorage('local');
    if (!storage) return;

    if (!this.isDemoAccountEnabled()) {
      // In production mode, remove any existing demo account fixture from local storage
      try {
        const accounts = this.getAllAccounts();
        const filtered = accounts.filter(
          (a) => a.id !== 'usr_demo_hypermelo_01' && a.email.toLowerCase() !== 'demo@hypermelo.app'
        );
        if (filtered.length !== accounts.length) {
          storage.setItem(STORAGE_KEY_ACCOUNTS, JSON.stringify(filtered));
        }
      } catch {
        // Safe fallback
      }
      return;
    }

    try {
      const accounts = this.getAllAccounts();
      const demoEmail = 'demo@hypermelo.app';
      if (!accounts.some((a) => a.email.toLowerCase() === demoEmail)) {
        const salt = 'hypermelo_demo_salt_v2';
        // Precomputed PBKDF2-HMAC-SHA256 (100,000 iterations) hash of "Password123!" with salt "hypermelo_demo_salt_v2"
        const passwordHash = '71aea8d3adddbc64be2ca2a4870a602c19bf6a89b4b9bb9045ed3110526db31a';
        const demoAccount: StoredUserAccount = {
          id: 'usr_demo_hypermelo_01',
          name: 'HyperMelo Listener',
          email: demoEmail,
          passwordHash,
          salt,
          hashAlgorithm: 'pbkdf2-sha256',
          iterations: PBKDF2_ITERATIONS,
          provider: 'local',
          createdAt: Date.now() - 86400000 * 7,
          lastLoginAt: Date.now() - 86400000
        };
        accounts.push(demoAccount);
        storage.setItem(STORAGE_KEY_ACCOUNTS, JSON.stringify(accounts));
      }
    } catch (err) {
      console.warn('[AuthService] Account seeding error:', err);
    }
  }

  public subscribe(listener: (user: User | null) => void): () => void {
    this.listeners.add(listener);
    listener(this.currentUser);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l(this.currentUser));
  }

  /**
   * Retrieve all stored accounts from the secure client-side registry
   */
  public getAllAccounts(): StoredUserAccount[] {
    const storage = this.getStorage('local');
    if (!storage) return [];
    try {
      const raw = storage.getItem(STORAGE_KEY_ACCOUNTS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private saveAccount(account: StoredUserAccount): void {
    const storage = this.getStorage('local');
    if (!storage) return;
    try {
      const accounts = this.getAllAccounts();
      const existingIdx = accounts.findIndex(
        (a) => a.email.toLowerCase() === account.email.toLowerCase()
      );
      if (existingIdx >= 0) {
        accounts[existingIdx] = account;
      } else {
        accounts.push(account);
      }
      storage.setItem(STORAGE_KEY_ACCOUNTS, JSON.stringify(accounts));
    } catch (err) {
      console.warn('[AuthService] Error saving account:', err);
    }
  }

  public findAccountByEmail(email: string): StoredUserAccount | null {
    const cleanEmail = email.trim().toLowerCase();
    const accounts = this.getAllAccounts();
    return accounts.find((a) => a.email.toLowerCase() === cleanEmail) || null;
  }

  /**
   * Restores active authenticated session from localStorage or sessionStorage
   */
  public restoreSession(): User | null {
    const local = this.getStorage('local');
    const session = this.getStorage('session');
    if (!local && !session) return null;
    try {
      const stored =
        local?.getItem(STORAGE_KEY_SESSION) ||
        session?.getItem(STORAGE_KEY_SESSION) ||
        local?.getItem(STORAGE_KEY_LEGACY_SESSION) ||
        session?.getItem(STORAGE_KEY_LEGACY_SESSION);

      if (stored) {
        const sessionObj: AuthSession = JSON.parse(stored);
        if (sessionObj?.user?.id) {
          // Check session expiration (30 days)
          if (sessionObj.expiresAt && sessionObj.expiresAt < Date.now()) {
            this.logout();
            return null;
          }
          this.currentUser = sessionObj.user;
          return sessionObj.user;
        }
      }
    } catch (err) {
      console.warn('[AuthService] Error restoring session:', err);
    }
    this.currentUser = null;
    return null;
  }

  public getCurrentUser(): User | null {
    return this.currentUser;
  }

  public isAuthenticated(): boolean {
    return this.currentUser !== null;
  }

  /**
   * Validate email address format
   */
  public isValidEmail(email: string): boolean {
    if (!email || typeof email !== 'string') return false;
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    return emailRegex.test(email.trim());
  }

  /**
   * Authenticate an existing user with email and password.
   * Supports PBKDF2-HMAC-SHA256 and transparently rehashes legacy SHA-256 accounts on success.
   */
  public async loginWithEmail(
    email: string,
    password: string,
    rememberMe = true
  ): Promise<User> {
    const cleanEmail = email ? email.trim().toLowerCase() : '';
    if (!cleanEmail || !this.isValidEmail(cleanEmail)) {
      throw new Error('Please enter a valid email address.');
    }
    if (!password || password.length === 0) {
      throw new Error('Please enter your password.');
    }

    const account = this.findAccountByEmail(cleanEmail);
    if (!account) {
      throw new Error(
        'No account found with this email. Please check your spelling or create an account.'
      );
    }

    if (account.provider === 'google' && !account.passwordHash) {
      throw new Error(
        'This account was registered using Google. Please sign in with Google.'
      );
    }

    if (!account.salt || !account.passwordHash) {
      throw new Error('Account security record corrupted. Please contact support or re-register.');
    }

    // Verify password with PBKDF2 or transparently migrate legacy SHA-256 account
    let passwordMatches = false;

    if (account.hashAlgorithm === 'pbkdf2-sha256') {
      const candidateHash = await hashPasswordPBKDF2(
        password,
        account.salt,
        account.iterations || PBKDF2_ITERATIONS
      );
      passwordMatches = candidateHash === account.passwordHash;
    } else {
      // Legacy account (SHA-256 single-round or unversioned)
      const legacyCandidate = await hashPasswordLegacySha256(password, account.salt);
      if (legacyCandidate === account.passwordHash) {
        passwordMatches = true;
        // Transparent migration: rehash with PBKDF2 and a fresh random salt
        const newSalt = generateSalt();
        const upgradedHash = await hashPasswordPBKDF2(password, newSalt, PBKDF2_ITERATIONS);
        account.salt = newSalt;
        account.passwordHash = upgradedHash;
        account.hashAlgorithm = 'pbkdf2-sha256';
        account.iterations = PBKDF2_ITERATIONS;
      } else {
        // Also check PBKDF2 in case hashAlgorithm field was lost but PBKDF2 was used
        const pbkdf2Candidate = await hashPasswordPBKDF2(password, account.salt, PBKDF2_ITERATIONS);
        if (pbkdf2Candidate === account.passwordHash) {
          passwordMatches = true;
          account.hashAlgorithm = 'pbkdf2-sha256';
          account.iterations = PBKDF2_ITERATIONS;
        }
      }
    }

    if (!passwordMatches) {
      throw new Error('Incorrect password. Please try again.');
    }

    // Update last login
    account.lastLoginAt = Date.now();
    this.saveAccount(account);

    const user: User = {
      id: account.id,
      name: account.name,
      email: account.email,
      avatar: account.avatar,
      createdAt: account.createdAt,
      provider: account.provider
    };

    this.saveSession(user, rememberMe);
    personalLibraryStore.migrateGuestDataToUser(user.id);
    this.currentUser = user;
    this.notify();
    return user;
  }

  /**
   * Register a new user account with name, email, and password.
   * Stores passwords hashed using Web Crypto PBKDF2-HMAC-SHA256 with 100,000 iterations.
   */
  public async signup(
    name: string,
    email: string,
    password: string,
    rememberMe = true
  ): Promise<User> {
    const cleanName = (name || '').trim();
    if (!cleanName || cleanName.length < 2) {
      throw new Error('Please enter your full name (at least 2 characters).');
    }

    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !this.isValidEmail(cleanEmail)) {
      throw new Error('Please enter a valid email address.');
    }

    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters long.');
    }

    const existingAccount = this.findAccountByEmail(cleanEmail);
    if (existingAccount) {
      throw new Error(
        'An account with this email already exists. Please sign in instead.'
      );
    }

    const salt = generateSalt();
    const passwordHash = await hashPasswordPBKDF2(password, salt, PBKDF2_ITERATIONS);
    const id = `usr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

    const newAccount: StoredUserAccount = {
      id,
      name: cleanName,
      email: cleanEmail,
      passwordHash,
      salt,
      hashAlgorithm: 'pbkdf2-sha256',
      iterations: PBKDF2_ITERATIONS,
      provider: 'local',
      createdAt: Date.now(),
      lastLoginAt: Date.now()
    };

    this.saveAccount(newAccount);

    const user: User = {
      id: newAccount.id,
      name: newAccount.name,
      email: newAccount.email,
      createdAt: newAccount.createdAt,
      provider: newAccount.provider
    };

    this.saveSession(user, rememberMe);
    personalLibraryStore.migrateGuestDataToUser(user.id);
    this.currentUser = user;
    this.notify();
    return user;
  }

  /**
   * Password reset advisory for local-first accounts.
   * Honestly communicates that local browser accounts have no automated email delivery service,
   * without fabricating fake verification codes or making false claims about sending email.
   */
  public async requestPasswordReset(email: string): Promise<PasswordRecoveryAdvisory> {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !this.isValidEmail(cleanEmail)) {
      throw new Error('Please enter a valid email address.');
    }

    return {
      supported: false,
      email: cleanEmail,
      message:
        'HyperMelo currently runs local-first profiles stored right on this device. Because there is no external email delivery service configured, password reset codes cannot be sent via email.',
      recoveryOptions: [
        'Try signing in again with your password.',
        'Continue listening as a Guest (full catalog and playback remain available).',
        'Create a new local account (your device-stored playlists and liked songs will remain preserved).'
      ]
    };
  }

  /**
   * Inspect current Google OAuth configuration status
   */
  public getGoogleAuthConfig(): GoogleAuthConfig {
    const origin =
      typeof window !== 'undefined' ? window.location.origin : 'https://hypermelo.app';
    const rawClientId =
      (typeof window !== 'undefined' &&
        (window as unknown as { __HYPERMELO_GOOGLE_CLIENT_ID?: string })
          .__HYPERMELO_GOOGLE_CLIENT_ID) ||
      (typeof import.meta !== 'undefined' &&
        (import.meta.env?.VITE_GOOGLE_CLIENT_ID as string)) ||
      null;

    const trimmedClientId = rawClientId?.trim()
      ? rawClientId.trim().replace(/^["']|["']$/g, '')
      : null;
    const isValidClientId = Boolean(
      trimmedClientId &&
        trimmedClientId !== 'undefined' &&
        trimmedClientId !== 'null' &&
        !trimmedClientId.includes('your_google_client_id_here') &&
        trimmedClientId.length > 5
    );

    const missingSettings: string[] = [];
    if (!isValidClientId) {
      missingSettings.push(
        'Missing VITE_GOOGLE_CLIENT_ID environment variable or window.__HYPERMELO_GOOGLE_CLIENT_ID'
      );
    }

    return {
      configured: isValidClientId,
      clientId: isValidClientId ? trimmedClientId : null,
      redirectUri: origin,
      missingSettings
    };
  }

  /**
   * Helper for automated tests / developer sandboxing
   */
  public enableMockGoogleForTesting(enabled: boolean): void {
    this.mockGoogleEnabled = enabled;
  }

  /**
   * Authenticate with Google
   * - Starts real Google OAuth flow if VITE_GOOGLE_CLIENT_ID is configured.
   * - If not configured, throws an informative error detailing exactly what must be configured.
   */
  public async loginWithGoogle(): Promise<User> {
    const config = this.getGoogleAuthConfig();

    // Check for developer test mock override
    if (this.mockGoogleEnabled) {
      const email = 'google.listener@gmail.com';
      let account = this.findAccountByEmail(email);
      if (!account) {
        account = {
          id: `usr_google_${Date.now().toString(36)}`,
          name: 'Google Listener',
          email,
          avatar:
            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
          provider: 'google',
          createdAt: Date.now(),
          lastLoginAt: Date.now()
        };
        this.saveAccount(account);
      }
      const user: User = {
        id: account.id,
        name: account.name,
        email: account.email,
        avatar: account.avatar,
        createdAt: account.createdAt,
        provider: 'google'
      };
      this.saveSession(user, true);
      personalLibraryStore.migrateGuestDataToUser(user.id);
      this.currentUser = user;
      this.notify();
      return user;
    }

    if (!config.configured || !config.clientId) {
      const origin = config.redirectUri;
      throw new Error(
        `Google Sign-In is not configured. To enable real Google authentication, configure VITE_GOOGLE_CLIENT_ID in your environment settings (Google Cloud Console > Credentials > OAuth 2.0 Web Client ID with authorized origin "${origin}").`
      );
    }

    // Real Google OAuth Flow with Google Identity Services (GIS)
    return new Promise<User>((resolve, reject) => {
      if (typeof window === 'undefined') {
        reject(new Error('Google authentication is only available in the browser.'));
        return;
      }

      const win = window as unknown as {
        google?: {
          accounts?: {
            oauth2?: {
              initTokenClient: (config: {
                client_id: string;
                scope: string;
                callback: (tokenResponse: {
                  access_token?: string;
                  error?: string;
                  error_description?: string;
                }) => void;
                error_callback?: (err: { message?: string }) => void;
              }) => {
                requestAccessToken: (options?: { prompt?: string }) => void;
              };
            };
          };
        };
      };

      const startTokenFlow = () => {
        try {
          if (!win.google?.accounts?.oauth2) {
            reject(
              new Error('Google Identity Services SDK could not be initialized.')
            );
            return;
          }

          const client = win.google.accounts.oauth2.initTokenClient({
            client_id: config.clientId!,
            scope: 'email profile openid',
            callback: async (tokenResponse) => {
              if (tokenResponse.error) {
                reject(
                  new Error(
                    `Google authentication error: ${
                      tokenResponse.error_description || tokenResponse.error
                    }`
                  )
                );
                return;
              }
              if (!tokenResponse.access_token) {
                reject(new Error('No access token returned from Google.'));
                return;
              }

              try {
                // Fetch verified user profile directly from Google
                const profileRes = await fetch(
                  'https://www.googleapis.com/oauth2/v3/userinfo',
                  {
                    headers: {
                      Authorization: `Bearer ${tokenResponse.access_token}`
                    }
                  }
                );

                if (!profileRes.ok) {
                  throw new Error('Failed to fetch verified user info from Google.');
                }

                const profile = (await profileRes.json()) as {
                  sub?: string;
                  email?: string;
                  name?: string;
                  picture?: string;
                  email_verified?: boolean;
                };

                if (!profile.email) {
                  throw new Error('No email address provided by Google profile.');
                }

                const cleanEmail = profile.email.toLowerCase();
                let account = this.findAccountByEmail(cleanEmail);

                if (!account) {
                  // Register new user via Google
                  account = {
                    id: `usr_g_${profile.sub || Date.now().toString(36)}`,
                    name: profile.name || cleanEmail.split('@')[0],
                    email: cleanEmail,
                    avatar: profile.picture,
                    provider: 'google',
                    createdAt: Date.now(),
                    lastLoginAt: Date.now()
                  };
                  this.saveAccount(account);
                } else {
                  // Update existing user with Google details
                  account.lastLoginAt = Date.now();
                  if (profile.picture) account.avatar = profile.picture;
                  if (profile.name) account.name = profile.name;
                  this.saveAccount(account);
                }

                const user: User = {
                  id: account.id,
                  name: account.name,
                  email: account.email,
                  avatar: account.avatar,
                  createdAt: account.createdAt,
                  provider: 'google'
                };

                this.saveSession(user, true);
                personalLibraryStore.migrateGuestDataToUser(user.id);
                this.currentUser = user;
                this.notify();
                resolve(user);
              } catch (fetchErr) {
                reject(
                  fetchErr instanceof Error
                    ? fetchErr
                    : new Error('Failed to complete Google sign-in.')
                );
              }
            },
            error_callback: (err) => {
              reject(
                new Error(err?.message || 'Google authentication flow was cancelled.')
              );
            }
          });

          client.requestAccessToken({ prompt: 'select_account' });
        } catch (initErr) {
          reject(
            initErr instanceof Error
              ? initErr
              : new Error('Failed to initiate Google OAuth.')
          );
        }
      };

      // Load Google Identity Services script if not already present
      if (!win.google?.accounts?.oauth2) {
        if (!this.isGoogleScriptLoading) {
          this.isGoogleScriptLoading = true;
          const script = document.createElement('script');
          script.src = 'https://accounts.google.com/gsi/client';
          script.async = true;
          script.defer = true;
          script.onload = () => {
            this.isGoogleScriptLoading = false;
            startTokenFlow();
          };
          script.onerror = () => {
            this.isGoogleScriptLoading = false;
            reject(
              new Error('Failed to load Google Identity Services library from Google.')
            );
          };
          document.head.appendChild(script);
        }
      } else {
        startTokenFlow();
      }
    });
  }

  /**
   * Handle potential OAuth redirect callbacks on page load
   */
  private checkOAuthRedirect(): void {
    if (typeof window === 'undefined') return;
    try {
      const hash = window.location.hash;
      if (hash && hash.includes('access_token=')) {
        const params = new URLSearchParams(hash.replace(/^#/, ''));
        const token = params.get('access_token');
        if (token) {
          // Clean the hash so the access token is not left exposed in the URL bar
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }
      }
    } catch {
      // Safe fallback
    }
  }

  /**
   * Sign out the active user session and return to guest mode
   */
  public async logout(): Promise<void> {
    const local = this.getStorage('local');
    const session = this.getStorage('session');
    try {
      local?.removeItem(STORAGE_KEY_SESSION);
      session?.removeItem(STORAGE_KEY_SESSION);
      local?.removeItem(STORAGE_KEY_LEGACY_SESSION);
      session?.removeItem(STORAGE_KEY_LEGACY_SESSION);
    } catch (err) {
      console.warn('[AuthService] Logout storage clearance warning:', err);
    }
    this.currentUser = null;
    this.notify();
  }

  /**
   * Persist session based on rememberMe preference:
   * - rememberMe = true: localStorage (persists across browser restarts)
   * - rememberMe = false: sessionStorage (cleared when browser tab closes)
   */
  private saveSession(user: User, rememberMe: boolean): void {
    const local = this.getStorage('local');
    const session = this.getStorage('session');
    if (!local && !session) return;
    try {
      const expiresAt = Date.now() + (rememberMe ? 30 * 86400000 : 86400000); // 30 days vs 1 day
      const sessionObj: AuthSession = {
        user,
        token: `hm_local_${user.id}_${Date.now()}`,
        rememberMe,
        expiresAt
      };

      const primaryStorage = rememberMe ? local : session;
      const secondaryStorage = rememberMe ? session : local;

      primaryStorage?.setItem(STORAGE_KEY_SESSION, JSON.stringify(sessionObj));
      secondaryStorage?.removeItem(STORAGE_KEY_SESSION);

      // Clean up legacy keys
      local?.removeItem(STORAGE_KEY_LEGACY_SESSION);
      session?.removeItem(STORAGE_KEY_LEGACY_SESSION);
    } catch (err) {
      console.warn('[AuthService] Error persisting session:', err);
    }
  }
}

export const authService = new AuthService();
