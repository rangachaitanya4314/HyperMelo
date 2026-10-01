// Official Apple MusicKit JS Service for NARO
// Manages MusicKit configuration, developer token, and user authorization
// Conforms to Apple Music Web API specifications without faking credentials

import { providerAuthService } from '../../backend/services/ProviderAuthService';

export interface AppleMusicAuthState {
  isConfigured: boolean;
  isAuthorized: boolean;
  hasSubscription: boolean;
  developerTokenConfigured: boolean;
  userToken: string | null;
  error?: string;
}

export type AppleMusicAuthListener = (state: AppleMusicAuthState) => void;

class AppleMusicKitService {
  private isLoaded = false;
  private isConfigured = false;
  private musicKitInstance: unknown = null;
  private listeners: Set<AppleMusicAuthListener> = new Set();
  private developerToken: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.developerToken =
        localStorage.getItem('naro_apple_developer_token') ||
        (import.meta.env.VITE_APPLE_DEVELOPER_TOKEN as string) ||
        null;
    }
  }

  public subscribe(listener: AppleMusicAuthListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emitState(error?: string) {
    const state = this.getState(error);
    this.listeners.forEach((l) => {
      try {
        l(state);
      } catch (err) {
        console.error('Error in Apple MusicKit auth listener:', err);
      }
    });
  }

  public getState(error?: string): AppleMusicAuthState {
    const isAuth = this.isAuthorized();
    return {
      isConfigured: this.isConfigured,
      isAuthorized: isAuth,
      hasSubscription: isAuth, // MusicKit authorises users with Apple Music subscription
      developerTokenConfigured: !!this.developerToken,
      userToken: typeof window !== 'undefined' ? localStorage.getItem('naro_apple_user_token') : null,
      error
    };
  }

  public isAuthorized(): boolean {
    if (typeof window === 'undefined') return false;
    const instance = this.getMusicKitInstance();
    if (instance && typeof instance === 'object' && 'isAuthorized' in instance) {
      return Boolean((instance as { isAuthorized: boolean }).isAuthorized);
    }
    return Boolean(localStorage.getItem('naro_apple_user_token'));
  }

  public setDeveloperToken(token: string): void {
    this.developerToken = token.trim();
    providerAuthService.setAppleDeveloperToken(this.developerToken);
    this.isConfigured = false;
    this.musicKitInstance = null;
    this.initMusicKit().catch((err) => console.warn('MusicKit re-init error:', err));
  }

  public getDeveloperToken(): string | null {
    return this.developerToken;
  }

  /**
   * Load MusicKit JS dynamically from Apple CDN
   */
  public async loadScript(): Promise<boolean> {
    if (this.isLoaded) return true;
    if (typeof window === 'undefined') return false;

    // Check if already in window
    if ((window as unknown as { MusicKit?: unknown }).MusicKit) {
      this.isLoaded = true;
      return true;
    }

    return new Promise((resolve) => {
      const existingScript = document.querySelector('script[src*="musickit.js"]');
      if (existingScript) {
        this.isLoaded = true;
        resolve(true);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://js-cdn.music.apple.com/musickit/v3/musickit.js';
      script.async = true;
      script.onload = () => {
        this.isLoaded = true;
        resolve(true);
      };
      script.onerror = () => {
        console.warn('Failed to load Apple MusicKit JS SDK from Apple CDN.');
        resolve(false);
      };
      document.head.appendChild(script);
    });
  }

  /**
   * Configure MusicKit instance with developer token
   */
  public async initMusicKit(): Promise<boolean> {
    if (this.isConfigured && this.musicKitInstance) return true;
    if (!this.developerToken) {
      this.emitState();
      return false;
    }

    const loaded = await this.loadScript();
    if (!loaded) {
      this.emitState('Failed to load MusicKit SDK from Apple CDN');
      return false;
    }

    const globalMusicKit = (window as unknown as { MusicKit?: { configure: (options: unknown) => unknown; getInstance: () => unknown } }).MusicKit;
    if (!globalMusicKit) {
      this.emitState('MusicKit SDK global object unavailable');
      return false;
    }

    try {
      this.musicKitInstance = await globalMusicKit.configure({
        developerToken: this.developerToken,
        app: {
          name: 'NARO',
          build: '1.0.0'
        }
      });
      this.isConfigured = true;
      this.emitState();
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid Apple Developer Token';
      console.warn('MusicKit.configure error:', err);
      this.isConfigured = false;
      this.emitState(message);
      return false;
    }
  }

  /**
   * Authorize user with Apple ID / Apple Music subscription
   */
  public async authorize(): Promise<boolean> {
    const initialized = await this.initMusicKit();
    if (!initialized) {
      throw new Error('Apple MusicKit requires an Apple Developer Token before authenticating users.');
    }

    const instance = this.getMusicKitInstance() as { authorize: () => Promise<string>; isAuthorized: boolean } | null;
    if (!instance || !instance.authorize) {
      throw new Error('MusicKit instance is not ready for authorization.');
    }

    try {
      const musicUserToken = await instance.authorize();
      if (musicUserToken) {
        await providerAuthService.setAppleUserToken(musicUserToken);
      }
      this.emitState();
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Apple Music authorization cancelled or failed.';
      this.emitState(message);
      throw new Error(message);
    }
  }

  /**
   * Disconnect Apple Music account
   */
  public async unauthorize(): Promise<void> {
    const instance = this.getMusicKitInstance() as { unauthorize: () => Promise<void> } | null;
    if (instance && instance.unauthorize) {
      try {
        await instance.unauthorize();
      } catch {
        // ignore
      }
    }
    await providerAuthService.setAppleUserToken('');
    this.emitState();
  }

  public getMusicKitInstance(): unknown {
    if (this.musicKitInstance) return this.musicKitInstance;
    if (typeof window !== 'undefined') {
      const globalMusicKit = (window as unknown as { MusicKit?: { getInstance: () => unknown } }).MusicKit;
      if (globalMusicKit && globalMusicKit.getInstance) {
        this.musicKitInstance = globalMusicKit.getInstance();
      }
    }
    return this.musicKitInstance;
  }
}

export const appleMusicKitService = new AppleMusicKitService();
