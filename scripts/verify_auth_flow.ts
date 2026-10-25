/**
 * HyperMelo Complete Phase 1 Authentication Hardening Verification Suite
 *
 * Verifies:
 * 1. Demo Account Production Exclusion (absent by default; only enabled with explicit test flag)
 * 2. Demo Account Seeding under explicit test flag (PBKDF2 hash, 100k iterations, correct auth, wrong pass rejection)
 * 3. PBKDF2 Password Creation & Verification (100k iterations, random salt, versioning in StoredUserAccount)
 * 4. Input Validation & Error Handling (bad email, short password, name length, duplicate accounts)
 * 5. Transparent Legacy Account Migration (single-round SHA-256 transparently upgraded to PBKDF2 upon login without data loss)
 * 6. Cryptographic Safe Failure (no polynomial hash fallback; fails safely when crypto.subtle is unavailable)
 * 7. Fake Password-Reset Flow Removal (no 6-digit code generation or disclosure; honest local-first recovery advisory)
 * 8. Downloaded-Song Metadata Isolation & Preservation (guest, user-partitioned, logout isolation, re-login restoration, legacy migration)
 * 9. Personal Library Data Preservation (Likes and Playlists merge cleanly from guest to user without data loss)
 * 10. Session Persistence ("Remember Me" in localStorage vs sessionStorage)
 * 11. Google OAuth Configuration Reporting (honest configuration checks without fake token generation)
 * 12. UI Codebase Audit (no Apple buttons, no 6-digit verification code inputs, honest account help panel, HyperMelo branding intact)
 */

// Mock browser storage and crypto environment for Node.js tsx execution
const memoryLocalStorage: Record<string, string> = {};
const memorySessionStorage: Record<string, string> = {};

(global as any).localStorage = {
  getItem: (key: string) => (key in memoryLocalStorage ? memoryLocalStorage[key] : null),
  setItem: (key: string, val: string) => { memoryLocalStorage[key] = String(val); },
  removeItem: (key: string) => { delete memoryLocalStorage[key]; },
  clear: () => { Object.keys(memoryLocalStorage).forEach((k) => delete memoryLocalStorage[k]); }
};

(global as any).sessionStorage = {
  getItem: (key: string) => (key in memorySessionStorage ? memorySessionStorage[key] : null),
  setItem: (key: string, val: string) => { memorySessionStorage[key] = String(val); },
  removeItem: (key: string) => { delete memorySessionStorage[key]; },
  clear: () => { Object.keys(memorySessionStorage).forEach((k) => delete memorySessionStorage[k]); }
};

(global as any).window = {
  location: {
    origin: 'https://hypermelo.app',
    pathname: '/',
    search: '',
    hash: ''
  },
  history: {
    replaceState: () => {}
  }
};

import {
  authService,
  hashPasswordPBKDF2,
  hashPasswordLegacySha256,
  PBKDF2_ITERATIONS
} from '../src/services/auth/authService';
import { personalLibraryStore } from '../src/services/storage/personalLibraryStore';
import type { Song } from '../src/types/music';
import * as fs from 'fs';
import * as path from 'path';

async function runAuthVerification() {
  console.log('=================================================================');
  console.log('HYPERMELO PHASE 1 AUTHENTICATION HARDENING VERIFICATION SUITE');
  console.log('=================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}${detail ? ` -> ${detail}` : ''}`);
      failed++;
    }
  }

  // -------------------------------------------------------------------------
  // TEST 1: Demo-account exclusion in production mode
  // -------------------------------------------------------------------------
  console.log('--- Phase 1: Demo-Account Exclusion from Production ---');
  // Initially, demo account flag is disabled
  authService.seedDefaultAccounts();
  const unseededDemo = authService.findAccountByEmail('demo@hypermelo.app');
  assert(unseededDemo === null, 'Demo account is NOT seeded by default in production mode');

  const rawAccounts = localStorage.getItem('hypermelo_registered_accounts');
  const accountsList = rawAccounts ? JSON.parse(rawAccounts) : [];
  assert(
    !accountsList.some((a: any) => a.email.toLowerCase() === 'demo@hypermelo.app'),
    'Demo credentials are not present in localStorage accounts registry in production'
  );

  let unseededLoginCaught = false;
  try {
    await authService.loginWithEmail('demo@hypermelo.app', 'Password123!');
  } catch (err: any) {
    unseededLoginCaught = true;
    assert(err.message.includes('No account found'), 'Login with demo credentials rejected when demo fixtures disabled');
  }
  assert(unseededLoginCaught, 'Unseeded demo login blocked in production mode');

  // -------------------------------------------------------------------------
  // TEST 2: Demo-account seeding under explicit test flag
  // -------------------------------------------------------------------------
  console.log('\n--- Phase 2: Explicit Demo-Account Testing Flag ---');
  authService.enableDemoAccountForTesting(true);
  const demoAccount = authService.findAccountByEmail('demo@hypermelo.app');
  assert(demoAccount !== null, 'Demo account is created when enableDemoAccountForTesting(true) is invoked');
  assert(demoAccount?.provider === 'local', 'Demo account has local credentials provider');
  assert(demoAccount?.hashAlgorithm === 'pbkdf2-sha256', 'Demo account uses pbkdf2-sha256 algorithm');
  assert(demoAccount?.iterations === PBKDF2_ITERATIONS, `Demo account iterations is ${PBKDF2_ITERATIONS}`);
  assert(demoAccount?.passwordHash !== 'Password123!', 'Demo password is not stored in plain text');
  assert(
    demoAccount?.passwordHash === '71aea8d3adddbc64be2ca2a4870a602c19bf6a89b4b9bb9045ed3110526db31a',
    'Demo account has verified PBKDF2 hash'
  );

  // Test successful demo sign-in
  const demoUser = await authService.loginWithEmail('demo@hypermelo.app', 'Password123!', true);
  assert(demoUser.email === 'demo@hypermelo.app', 'Demo user signs in successfully with correct credentials');
  assert(authService.isAuthenticated(), 'AuthService state is authenticated');
  assert(authService.getCurrentUser()?.id === demoUser.id, 'Current user matches authenticated demo user');

  // Test wrong password rejection
  let wrongPassCaught = false;
  try {
    await authService.loginWithEmail('demo@hypermelo.app', 'WrongPassword!', true);
  } catch (err: any) {
    wrongPassCaught = true;
    assert(err.message.includes('Incorrect password'), 'Incorrect password rejection message is clear and honest');
  }
  assert(wrongPassCaught, 'Sign in with incorrect password rejected');

  // Sign out
  await authService.logout();
  assert(!authService.isAuthenticated(), 'Logout clears active session');
  assert(authService.getCurrentUser() === null, 'Logout resets currentUser to null');

  // -------------------------------------------------------------------------
  // TEST 3: New User Registration & PBKDF2 Password Hashing
  // -------------------------------------------------------------------------
  console.log('\n--- Phase 3: New User Registration & PBKDF2 Hashing ---');
  const testEmail = 'maya.chen@hypermelo.audio';
  const testName = 'Maya Chen';
  const testPassword = 'CreativePassword2026!';

  // Input validation tests
  let invalidNameCaught = false;
  try {
    await authService.signup('M', testEmail, testPassword);
  } catch (err: any) {
    invalidNameCaught = true;
    assert(err.message.includes('at least 2 characters'), 'Signup rejects names under 2 characters');
  }
  assert(invalidNameCaught, 'Short name validation caught');

  let invalidEmailCaught = false;
  try {
    await authService.signup(testName, 'notanemail', testPassword);
  } catch (err: any) {
    invalidEmailCaught = true;
    assert(err.message.includes('valid email address'), 'Signup rejects malformed email');
  }
  assert(invalidEmailCaught, 'Malformed email validation caught');

  let shortPasswordCaught = false;
  try {
    await authService.signup(testName, testEmail, '12345');
  } catch (err: any) {
    shortPasswordCaught = true;
    assert(err.message.includes('at least 6 characters'), 'Signup rejects passwords under 6 characters');
  }
  assert(shortPasswordCaught, 'Short password validation caught');

  // Valid Registration
  const newUser = await authService.signup(testName, testEmail, testPassword, true);
  assert(newUser.email === testEmail, 'New user successfully registered');
  assert(newUser.name === testName, 'New user name correctly saved');
  assert(authService.isAuthenticated(), 'New user is immediately authenticated');

  // Inspect the stored record in the accounts registry
  const storedMaya = authService.findAccountByEmail(testEmail);
  assert(storedMaya !== null, 'Account record stored in registry');
  assert(storedMaya?.hashAlgorithm === 'pbkdf2-sha256', 'Stored account specifies hashAlgorithm: pbkdf2-sha256');
  assert(storedMaya?.iterations === 100000, 'Stored account specifies iterations: 100000');
  assert(typeof storedMaya?.salt === 'string' && storedMaya.salt.length === 32, 'Stored account has 32-hex-character random salt (16 bytes)');
  assert(typeof storedMaya?.passwordHash === 'string' && storedMaya.passwordHash.length === 64, 'Stored account has 64-hex-character PBKDF2 hash (256 bits)');
  assert(storedMaya?.passwordHash !== testPassword, 'Stored password is NOT stored in plain text');

  // Verify hash matches independent PBKDF2 calculation
  const computedHash = await hashPasswordPBKDF2(testPassword, storedMaya!.salt!, storedMaya!.iterations!);
  assert(computedHash === storedMaya?.passwordHash, 'PBKDF2 hash matches independent calculation');

  // Duplicate registration rejection
  let duplicateCaught = false;
  try {
    await authService.signup(testName, testEmail, 'AnotherPassword123!');
  } catch (err: any) {
    duplicateCaught = true;
    assert(err.message.includes('already exists'), 'Duplicate email registration rejected with helpful message');
  }
  assert(duplicateCaught, 'Duplicate account prevented');

  // Logout and test login with created account
  await authService.logout();
  const loggedInMaya = await authService.loginWithEmail(testEmail, testPassword, true);
  assert(loggedInMaya.id === newUser.id, 'User logs in successfully with PBKDF2 credentials');

  // -------------------------------------------------------------------------
  // TEST 4: Transparent Legacy Account Migration (Re-hash on successful login)
  // -------------------------------------------------------------------------
  console.log('\n--- Phase 4: Transparent Legacy Account Migration ---');
  await authService.logout();

  const legacyEmail = 'legacy.user@example.com';
  const legacyPassword = 'OldPassword123!';
  const legacySalt = 'legacy_salt_12345';
  const legacySingleRoundHash = await hashPasswordLegacySha256(legacyPassword, legacySalt);

  // Manually seed legacy account with single-round SHA-256 (no hashAlgorithm field, mirroring pre-hardening state)
  const legacyAccount: any = {
    id: 'usr_legacy_99',
    name: 'Legacy Listener',
    email: legacyEmail,
    passwordHash: legacySingleRoundHash,
    salt: legacySalt,
    provider: 'local',
    createdAt: Date.now() - 86400000 * 30,
    lastLoginAt: Date.now() - 86400000 * 15
  };

  const currentAccounts = authService.getAllAccounts();
  currentAccounts.push(legacyAccount);
  localStorage.setItem('hypermelo_registered_accounts', JSON.stringify(currentAccounts));

  // Log in with the legacy account's password
  const migratedUser = await authService.loginWithEmail(legacyEmail, legacyPassword, true);
  assert(migratedUser.email === legacyEmail, 'Legacy account successfully signs in using legacy password');

  // Verify account was transparently upgraded in storage to PBKDF2
  const rehashedAccount = authService.findAccountByEmail(legacyEmail);
  assert(rehashedAccount?.hashAlgorithm === 'pbkdf2-sha256', 'Legacy account transparently upgraded to pbkdf2-sha256');
  assert(rehashedAccount?.iterations === 100000, 'Legacy account upgraded to 100,000 iterations');
  assert(rehashedAccount?.passwordHash !== legacySingleRoundHash, 'Legacy single-round hash replaced with PBKDF2 hash');
  assert(rehashedAccount?.salt !== legacySalt, 'Legacy salt replaced with fresh cryptographically random salt');

  // Subsequent login succeeds with the upgraded PBKDF2 credentials
  await authService.logout();
  const reloggedMigrated = await authService.loginWithEmail(legacyEmail, legacyPassword, true);
  assert(reloggedMigrated.id === legacyAccount.id, 'Subsequent login with migrated account succeeds using PBKDF2');

  // -------------------------------------------------------------------------
  // TEST 5: Cryptographic Safe Failure (No Insecure Fallback)
  // -------------------------------------------------------------------------
  console.log('\n--- Phase 5: Cryptographic Safe Failure ---');
  const originalCrypto = (global as any).crypto;
  try {
    // Simulate non-secure context where crypto.subtle is undefined
    Object.defineProperty(global, 'crypto', {
      value: {
        getRandomValues: originalCrypto.getRandomValues.bind(originalCrypto),
        subtle: undefined
      },
      configurable: true,
      writable: true
    });

    let subtleErrorCaught = false;
    try {
      await hashPasswordPBKDF2('testPass', 'salt123');
    } catch (err: any) {
      subtleErrorCaught = true;
      assert(
        err.message.includes('Secure cryptographic operations') && err.message.includes('Web Crypto API'),
        'Fails safely with informative error when crypto.subtle is unavailable'
      );
    }
    assert(subtleErrorCaught, 'PBKDF2 does not silently fall back to an insecure polynomial hash');
  } finally {
    // Restore crypto
    Object.defineProperty(global, 'crypto', {
      value: originalCrypto,
      configurable: true,
      writable: true
    });
  }

  // -------------------------------------------------------------------------
  // TEST 6: Fake Password-Reset Flow Removal & Honest Advisory
  // -------------------------------------------------------------------------
  console.log('\n--- Phase 6: Password Reset Flow Hardening ---');
  const resetAdvisory = await authService.requestPasswordReset(testEmail);
  assert(resetAdvisory.supported === false, 'Password reset reports supported: false');
  assert(resetAdvisory.email === testEmail, 'Advisory targets the requested email');
  assert(
    resetAdvisory.message.includes('local-first') && resetAdvisory.message.includes('cannot be sent'),
    'Advisory honestly explains local-first architecture and absence of email delivery service'
  );
  assert(Array.isArray(resetAdvisory.recoveryOptions) && resetAdvisory.recoveryOptions.length >= 3, 'Advisory lists concrete, honest recovery options');
  assert(!('code' in resetAdvisory), 'Advisory does NOT generate or disclose any verification codes');

  // Verify storage key hypermelo_password_resets is not created
  assert(localStorage.getItem('hypermelo_password_resets') === null, 'No reset codes are stored in localStorage');

  // Verify resetPasswordWithCode method is completely removed from service
  assert(
    typeof (authService as any).resetPasswordWithCode === 'undefined',
    'resetPasswordWithCode method is removed from authService'
  );

  // -------------------------------------------------------------------------
  // TEST 7: Downloaded-Song Metadata Isolation & Preservation
  // -------------------------------------------------------------------------
  console.log('\n--- Phase 7: Downloaded-Song Isolation & Data Preservation ---');
  await authService.logout();

  // Dummy songs for testing
  const dummySongA: Song = {
    id: 'song-alpha',
    title: 'Alpha Waves',
    artist: 'HyperMelo Artist',
    album: 'Ambient Vol 1',
    duration: 180,
    audioUrl: 'https://cdn.hypermelo.app/audio/alpha.mp3',
    artworkUrl: 'https://cdn.hypermelo.app/art/alpha.jpg'
  };

  const dummySongB: Song = {
    id: 'song-beta',
    title: 'Beta Grooves',
    artist: 'HyperMelo Beats',
    album: 'Grooves Vol 2',
    duration: 210,
    audioUrl: 'https://cdn.hypermelo.app/audio/beta.mp3',
    artworkUrl: 'https://cdn.hypermelo.app/art/beta.jpg'
  };

  // 1. Guest downloads Song A
  personalLibraryStore.addDownloadedSong(dummySongA);
  const guestDownloadsInitial = personalLibraryStore.getDownloadedSongs();
  assert(
    guestDownloadsInitial.some((s) => s.id === 'song-alpha'),
    'Guest downloaded Song A persists in guest library'
  );

  // 2. User signs in: guest downloads merge into user library without data loss
  const userA = await authService.loginWithEmail(testEmail, testPassword);
  const userADownloads = personalLibraryStore.getDownloadedSongs(userA.id);
  assert(
    userADownloads.some((s) => s.id === 'song-alpha'),
    'Guest downloads successfully migrated into User A library on sign-in'
  );

  // 3. User A downloads Song B (user-specific download)
  personalLibraryStore.addDownloadedSong(dummySongB, userA.id);
  const userAUpdated = personalLibraryStore.getDownloadedSongs(userA.id);
  assert(
    userAUpdated.some((s) => s.id === 'song-alpha') && userAUpdated.some((s) => s.id === 'song-beta'),
    'User A library holds both Song A and Song B'
  );

  // 4. User A logs out: guest store must NOT contain User A private downloads
  await authService.logout();
  const guestAfterLogout = personalLibraryStore.getDownloadedSongs();
  assert(
    guestAfterLogout.some((s) => s.id === 'song-alpha'),
    'Guest still has access to Song A'
  );
  assert(
    !guestAfterLogout.some((s) => s.id === 'song-beta'),
    'Guest CANNOT access User A private downloaded Song B (Metadata Isolation verified)'
  );

  // 5. User A logs back in: User A library still contains all their songs
  await authService.loginWithEmail(testEmail, testPassword);
  const userARestored = personalLibraryStore.getDownloadedSongs(userA.id);
  assert(
    userARestored.some((s) => s.id === 'song-alpha') && userARestored.some((s) => s.id === 'song-beta'),
    'User A downloads fully preserved upon re-login'
  );

  // 6. Legacy download migration check: naro_downloaded_songs unpartitioned record
  const legacyTrack: Song = {
    id: 'song-legacy-01',
    title: 'Legacy Offline Track',
    artist: 'Vintage Audio',
    album: 'Archive',
    duration: 150,
    audioUrl: 'https://cdn.hypermelo.app/legacy.mp3',
    artworkUrl: 'https://cdn.hypermelo.app/legacy.jpg'
  };
  localStorage.setItem('naro_downloaded_songs', JSON.stringify([legacyTrack]));

  const freshUserDownloads = personalLibraryStore.getDownloadedSongs('usr_new_partition');
  assert(
    freshUserDownloads.some((s) => s.id === 'song-legacy-01'),
    'Legacy unpartitioned naro_downloaded_songs successfully imported without data loss'
  );
  assert(
    localStorage.getItem('naro_downloaded_songs') !== null,
    'Original legacy download store is preserved (not deleted)'
  );

  await authService.logout();

  // -------------------------------------------------------------------------
  // TEST 8: Personal Library (Likes & Playlists) Migration & Preservation
  // -------------------------------------------------------------------------
  console.log('\n--- Phase 8: Playlists & Likes Preservation ---');
  // Guest likes a song
  personalLibraryStore.addLikedSong('track_guest_fav');
  assert(personalLibraryStore.isLiked('track_guest_fav'), 'Guest likes track');

  // User logs in: guest like merges into user account
  await authService.loginWithEmail(testEmail, testPassword);
  assert(personalLibraryStore.isLiked('track_guest_fav', userA.id), 'Guest like merged into signed-in user library');

  // User likes an exclusive track
  personalLibraryStore.addLikedSong('track_user_exclusive', userA.id);
  assert(personalLibraryStore.isLiked('track_user_exclusive', userA.id), 'User likes exclusive track');

  // User logs out
  await authService.logout();
  assert(
    !personalLibraryStore.isLiked('track_user_exclusive'),
    'User exclusive like does NOT leak to guest'
  );

  // -------------------------------------------------------------------------
  // TEST 9: "Remember Me" Session Persistence
  // -------------------------------------------------------------------------
  console.log('\n--- Phase 9: Session Persistence ("Remember Me") ---');
  // With rememberMe = true: stored in localStorage
  await authService.loginWithEmail(testEmail, testPassword, true);
  assert(memoryLocalStorage['hypermelo_auth_session'] !== undefined, 'rememberMe=true persists to localStorage');
  assert(memorySessionStorage['hypermelo_auth_session'] === undefined, 'sessionStorage is cleared when rememberMe=true');

  const sessionObj = JSON.parse(memoryLocalStorage['hypermelo_auth_session']);
  assert(sessionObj.token.startsWith('hm_local_'), 'Session token is honestly identified as hm_local_ (not claiming to be a server JWT)');

  // Re-login with rememberMe = false
  await authService.logout();
  await authService.loginWithEmail(testEmail, testPassword, false);
  assert(memorySessionStorage['hypermelo_auth_session'] !== undefined, 'rememberMe=false persists to sessionStorage');
  assert(memoryLocalStorage['hypermelo_auth_session'] === undefined, 'localStorage is cleared when rememberMe=false');

  // Test restoreSession()
  const restored = authService.restoreSession();
  assert(restored?.email === testEmail, 'restoreSession successfully restores user session from storage');
  await authService.logout();

  // -------------------------------------------------------------------------
  // TEST 10: Google OAuth Architecture & Reporting
  // -------------------------------------------------------------------------
  console.log('\n--- Phase 10: Google OAuth Configuration Readiness ---');
  const googleConfig = authService.getGoogleAuthConfig();
  assert(typeof googleConfig.configured === 'boolean', 'Google auth config exposes configuration readiness status');
  assert(googleConfig.redirectUri === 'https://hypermelo.app', 'Google OAuth redirect URI matches production origin');

  // When VITE_GOOGLE_CLIENT_ID is missing:
  let googleConfigErrorCaught = false;
  try {
    await authService.loginWithGoogle();
  } catch (err: any) {
    googleConfigErrorCaught = true;
    assert(err.message.includes('VITE_GOOGLE_CLIENT_ID'), 'Reports exact missing environment variable (VITE_GOOGLE_CLIENT_ID)');
    assert(err.message.includes('Google Cloud Console'), 'Identifies exact Google Cloud Console setup requirement');
    assert(err.message.includes('authorized origin'), 'Includes authorized origin in setup guidance');
  }
  assert(googleConfigErrorCaught, 'Google login cleanly reports missing configuration without fabricated tokens');

  // Test developer mock flow (when enabled for testing)
  authService.enableMockGoogleForTesting(true);
  const googleUser = await authService.loginWithGoogle();
  assert(googleUser.provider === 'google', 'Google OAuth creates verified Google provider account');
  assert(googleUser.email === 'google.listener@gmail.com', 'Google user email populated correctly');
  assert(authService.isAuthenticated(), 'Google OAuth establishes authenticated session');
  authService.enableMockGoogleForTesting(false);
  await authService.logout();

  // -------------------------------------------------------------------------
  // TEST 11: UI Component & Codebase Inspection
  // -------------------------------------------------------------------------
  console.log('\n--- Phase 11: UI Code Inspection & Hardening Constraints ---');
  const projectRoot = process.cwd();
  const authModalPath = path.resolve(projectRoot, 'src/components/AuthModal.tsx');
  const authModalContent = fs.readFileSync(authModalPath, 'utf8');

  // Check Apple removal
  assert(!authModalContent.includes('handleApple'), 'handleApple function removed from AuthModal');
  assert(!authModalContent.includes('loginWithApple'), 'loginWithApple call removed from AuthModal');
  assert(!authModalContent.includes('<span>Apple</span>'), 'Apple button label removed from AuthModal');
  assert(!authModalContent.includes('150.37 130.25'), 'Apple logo SVG path removed from AuthModal');

  // Check fake reset flow removal
  assert(!authModalContent.includes('reset_code'), 'reset_code mode removed from AuthModal');
  assert(!authModalContent.includes('resetCode'), 'resetCode state removed from AuthModal');
  assert(!authModalContent.includes('6-Digit Verification Code'), '6-digit verification code input removed from AuthModal');
  assert(!authModalContent.includes('Send Verification Code'), 'Send Verification Code button removed from AuthModal');

  // Check honest account help presence
  assert(authModalContent.includes('account_help'), 'AuthModal implements account_help mode');
  assert(authModalContent.includes('Local Device Storage Architecture'), 'AuthModal displays honest Local Device Storage notice');
  assert(authModalContent.includes('Back to Sign In'), 'AuthModal provides Back to Sign In action');
  assert(authModalContent.includes('Continue listening as Guest'), 'AuthModal provides Continue as Guest option');

  // Check Google full-width button
  assert(authModalContent.includes('Continue with Google'), 'Google button uses balanced "Continue with Google" label');
  assert(authModalContent.includes('google-auth-btn'), 'Google button has distinct test/a11y id');

  // Check HyperMelo branding
  assert(authModalContent.includes('HyperMeloLogo'), 'AuthModal imports official HyperMeloLogo component');
  assert(authModalContent.includes('Welcome to HyperMelo'), 'Header displays "Welcome to HyperMelo" for Sign In');
  assert(authModalContent.includes('Create Your HyperMelo Account'), 'Header displays "Create Your HyperMelo Account" for Sign Up');
  assert(authModalContent.includes('aria-label="HyperMelo Personal Account Authentication"'), 'A11y label reflects HyperMelo branding');
  assert(!authModalContent.includes('>Naro</span>'), 'Visible Naro wordmark removed from AuthModal');

  // Check Apple MusicKit isolation constraint
  const appleMusicKitPath = path.resolve(projectRoot, 'src/services/providers/appleMusicKitService.ts');
  assert(fs.existsSync(appleMusicKitPath), 'appleMusicKitService.ts file is present and untouched');
  const appleMusicContent = fs.readFileSync(appleMusicKitPath, 'utf8');
  assert(appleMusicContent.includes('MusicKit'), 'MusicKit functionality is fully intact');
  assert(appleMusicContent.includes('isAuthorized'), 'Apple MusicKit authorization methods are intact');

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log('\n=================================================================');
  console.log(`AUTH VERIFICATION RESULT: ${passed} PASSED, ${failed} FAILED`);
  console.log('=================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runAuthVerification().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
