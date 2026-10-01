// Canonical Provider Authentication Contracts for NARO

export interface ProviderTokenResponse {
  developerToken: string | null;
  userToken?: string | null;
  expiresIn?: number;
  source: 'backend' | 'client-storage' | 'environment';
}

export interface AppleAuthTokens {
  developerToken: string | null;
  userToken: string | null;
}

/**
 * Backend-facing Provider Authentication Contract.
 * Manages developer token retrieval and user authorization tokens
 * without exposing server secrets to client components.
 */
export interface IProviderAuthService {
  getAppleDeveloperToken(): Promise<string | null>;
  setAppleDeveloperToken(token: string): Promise<void>;
  getAppleUserToken(): Promise<string | null>;
  setAppleUserToken(token: string): Promise<void>;
  clearAppleTokens(): Promise<void>;
}
