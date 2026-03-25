export type UserRole = 'PLAYER' | 'CREATOR' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  createdAt: Date;
}

export interface UserPublic {
  id: string;
  username: string;
  role: UserRole;
}

export interface UserProfile {
  id: string;
  userId: string;
  bio: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

