// NARO Authentication Service
// Manages user session, email login/signup, Google/Apple social sign-in, and guest state
// Conforms to NARO Phase 3 Master Specification

import { personalLibraryStore, type User } from '../storage/personalLibraryStore';

export interface AuthSession {
  user: User;
  token: string;
  rememberMe: boolean;
}

class AuthService {
  private currentUser: User | null = null;
  private listeners: Set<(user: User | null) => void> = new Set();

  constructor() {
    this.restoreSession();
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

  public restoreSession(): User | null {
    if (typeof window === 'undefined') return null;
    try {
      const stored = localStorage.getItem('naro_auth_session') || sessionStorage.getItem('naro_auth_session');
      if (stored) {
        const session: AuthSession = JSON.parse(stored);
        if (session?.user?.id) {
          this.currentUser = session.user;
          return session.user;
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

  public async loginWithEmail(email: string, _password: string, rememberMe = true): Promise<User> {
    if (!email || !email.includes('@')) {
      throw new Error('Please enter a valid email address.');
    }

    const cleanEmail = email.trim().toLowerCase();
    const namePart = cleanEmail.split('@')[0];
    const formattedName = namePart.charAt(0).toUpperCase() + namePart.slice(1);

    const user: User = {
      id: `usr_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`,
      name: formattedName,
      email: cleanEmail,
      createdAt: Date.now()
    };

    this.saveSession(user, rememberMe);
    personalLibraryStore.migrateGuestDataToUser(user.id);
    this.currentUser = user;
    this.notify();
    return user;
  }

  public async signup(name: string, email: string, _password: string, rememberMe = true): Promise<User> {
    if (!name || name.trim().length < 2) {
      throw new Error('Please enter your full name.');
    }
    if (!email || !email.includes('@')) {
      throw new Error('Please enter a valid email address.');
    }

    const cleanEmail = email.trim().toLowerCase();
    const user: User = {
      id: `usr_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`,
      name: name.trim(),
      email: cleanEmail,
      createdAt: Date.now()
    };

    this.saveSession(user, rememberMe);
    personalLibraryStore.migrateGuestDataToUser(user.id);
    this.currentUser = user;
    this.notify();
    return user;
  }

  public async loginWithGoogle(): Promise<User> {
    // Simulated Google OAuth response in browser
    const user: User = {
      id: `usr_google_${Date.now().toString(36)}`,
      name: 'Google Listener',
      email: 'listener@gmail.com',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
      createdAt: Date.now()
    };

    this.saveSession(user, true);
    personalLibraryStore.migrateGuestDataToUser(user.id);
    this.currentUser = user;
    this.notify();
    return user;
  }

  public async loginWithApple(): Promise<User> {
    // Simulated Apple OAuth response in browser
    const user: User = {
      id: `usr_apple_${Date.now().toString(36)}`,
      name: 'Apple Music Member',
      email: 'member@icloud.com',
      createdAt: Date.now()
    };

    this.saveSession(user, true);
    personalLibraryStore.migrateGuestDataToUser(user.id);
    this.currentUser = user;
    this.notify();
    return user;
  }

  public async logout(): Promise<void> {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('naro_auth_session');
      sessionStorage.removeItem('naro_auth_session');
    }
    this.currentUser = null;
    this.notify();
  }

  private saveSession(user: User, rememberMe: boolean): void {
    if (typeof window === 'undefined') return;
    const session: AuthSession = {
      user,
      token: `naro_jwt_${user.id}_${Date.now()}`,
      rememberMe
    };
    const storage = rememberMe ? localStorage : sessionStorage;
    storage.setItem('naro_auth_session', JSON.stringify(session));
  }
}

export const authService = new AuthService();
