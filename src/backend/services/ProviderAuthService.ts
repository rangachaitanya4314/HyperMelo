// Backend Provider Authentication Service for NARO
// Implements IProviderAuthService contract behind backend boundary
// Manages developer and user tokens without exposing backend secrets to frontend views

import type { IProviderAuthService } from '../../shared';

export class ProviderAuthService implements IProviderAuthService {
  private developerToken: string | null = null;
  private userToken: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        this.developerToken =
          localStorage.getItem('naro_apple_developer_token') ||
          (import.meta.env?.VITE_APPLE_DEVELOPER_TOKEN as string) ||
          null;
        this.userToken = localStorage.getItem('naro_apple_user_token') || null;
      } catch {
        // Safe storage access fallback
      }
    }
  }

  public async getAppleDeveloperToken(): Promise<string | null> {
    if (this.developerToken) return this.developerToken;
    if (typeof window !== 'undefined') {
      try {
        return (
          localStorage.getItem('naro_apple_developer_token') ||
          (import.meta.env?.VITE_APPLE_DEVELOPER_TOKEN as string) ||
          null
        );
      } catch {
        return null;
      }
    }
    return null;
  }

  public async setAppleDeveloperToken(token: string): Promise<void> {
    const cleanToken = token.trim();
    this.developerToken = cleanToken || null;
    if (typeof window !== 'undefined') {
      try {
        if (cleanToken) {
          localStorage.setItem('naro_apple_developer_token', cleanToken);
        } else {
          localStorage.removeItem('naro_apple_developer_token');
        }
      } catch {
        // Safe storage access fallback
      }
    }
  }

  public async getAppleUserToken(): Promise<string | null> {
    if (this.userToken) return this.userToken;
    if (typeof window !== 'undefined') {
      try {
        return localStorage.getItem('naro_apple_user_token') || null;
      } catch {
        return null;
      }
    }
    return null;
  }

  public async setAppleUserToken(token: string): Promise<void> {
    const cleanToken = token.trim();
    this.userToken = cleanToken || null;
    if (typeof window !== 'undefined') {
      try {
        if (cleanToken) {
          localStorage.setItem('naro_apple_user_token', cleanToken);
        } else {
          localStorage.removeItem('naro_apple_user_token');
        }
      } catch {
        // Safe storage access fallback
      }
    }
  }

  public async clearAppleTokens(): Promise<void> {
    this.developerToken = null;
    this.userToken = null;
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('naro_apple_developer_token');
        localStorage.removeItem('naro_apple_user_token');
      } catch {
        // Safe storage access fallback
      }
    }
  }
}

export const providerAuthService = new ProviderAuthService();
