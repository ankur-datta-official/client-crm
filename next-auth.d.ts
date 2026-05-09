import type { DefaultSession } from "next-auth";
import type { AdapterUser as DefaultAdapterUser } from "next-auth/adapters";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      organizationId: string | null;
      isActive: boolean;
      isSuperAdmin: boolean;
    };
  }

  interface User {
    organizationId?: string | null;
    isActive?: boolean;
    isSuperAdmin?: boolean;
  }
}

declare module "next-auth/adapters" {
  interface AdapterUser extends DefaultAdapterUser {
    organizationId?: string | null;
    isActive?: boolean;
    isSuperAdmin?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    organizationId?: string | null;
    isActive?: boolean;
    isSuperAdmin?: boolean;
  }
}

export {};
