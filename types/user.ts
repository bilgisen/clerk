export interface User {
  id: string;
  email: string;
  name?: string;
  role?: string;
  image?: string;
  emailVerified?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}
