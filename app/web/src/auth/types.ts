export interface AuthUser {
  username: string;
  email?: string;
  displayName: string;
}

export interface SignInInput {
  username: string;
  password: string;
}

/**
 * The surface the app needs from an identity provider. `cognito` talks to an Amazon Cognito
 * user pool (the AWS replacement for Salesforce login); `stub` keeps everything in the browser
 * for local development and tests.
 */
export interface AuthClient {
  readonly mode: 'stub' | 'cognito';
  getCurrentUser(): Promise<AuthUser | null>;
  getAccessToken(): Promise<string | null>;
  signIn(input: SignInInput): Promise<AuthUser>;
  signOut(): Promise<void>;
}

export class AuthError extends Error {
  constructor(
    message: string,
    readonly code: string = 'AuthError',
  ) {
    super(message);
    this.name = 'AuthError';
  }
}
