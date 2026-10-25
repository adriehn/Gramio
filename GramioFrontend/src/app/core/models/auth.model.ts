export interface UserProfile {
  id: string;
  email: string;
  displayName?: string;
}

export interface AuthCredentials {
  email: string;
  password: string;
}