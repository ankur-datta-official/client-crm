import type { DefaultSession } from "next-auth";

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

declare module "next-auth/jwt" {
  interface JWT {
    organizationId?: string | null;
    isActive?: boolean;
    isSuperAdmin?: boolean;
  }
}
