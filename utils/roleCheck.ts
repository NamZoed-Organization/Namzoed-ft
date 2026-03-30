/**
 * Role-based access control utilities
 */

export const MONGOOSE_EMAIL = "mongoose@gmail.com";

/**
 * Check if a user has the Mongoose role (special provider)
 */
export const isMongooseUser = (email?: string | null): boolean => {
  if (email == null || typeof email !== "string") return false;
  return email.trim().toLowerCase() === MONGOOSE_EMAIL.toLowerCase();
};

/**
 * Check if current user is Mongoose based on user object
 */
export const isUserMongoose = (user: any): boolean => {
  return isMongooseUser(user?.email);
};
