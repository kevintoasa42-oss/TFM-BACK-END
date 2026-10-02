/** Public account contracts owned by the API, without credentials. */
export type Role = "admin" | "user";
export interface Account { id: string; name: string; email: string; role: Role }
export interface ManagedAccount extends Account { createdAt: number }
