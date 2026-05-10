import "server-only";

import bcrypt from "bcryptjs";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { resolveSuperAdminAccess } from "@/lib/auth/super-admin";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/auth/login",
  },
  providers: [
    CredentialsProvider({
      name: "Email and Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password ?? "";

        if (!email || !password) {
          throw new Error("Email and password are required.");
        }

        const user = await prisma.user.findUnique({
          where: {
            email,
          },
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
            organization_id: true,
            is_active: true,
            is_super_admin: true,
            password_hash: true,
          },
        });

        if (!user?.password_hash) {
          throw new Error("Invalid email or password.");
        }

        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
          throw new Error("Invalid email or password.");
        }

        if (!user.is_active) {
          throw new Error("This account is inactive. Please contact your administrator.");
        }

        const isSuperAdmin = resolveSuperAdminAccess({
          email: user.email,
          isSuperAdmin: user.is_super_admin,
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          organizationId: user.organization_id,
          isActive: user.is_active,
          isSuperAdmin,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.organizationId = user.organizationId ?? null;
        token.isActive = user.isActive ?? true;
        token.isSuperAdmin = user.isSuperAdmin ?? false;
        return token;
      }

      if (!token.sub) {
        return token;
      }

      const currentUser = await prisma.user.findUnique({
        where: {
          id: token.sub,
        },
        select: {
          email: true,
          name: true,
          image: true,
          organization_id: true,
          is_active: true,
          is_super_admin: true,
        },
      });

      if (!currentUser) {
        return token;
      }

      token.email = currentUser.email;
      token.name = currentUser.name;
      token.picture = currentUser.image;
      token.organizationId = currentUser.organization_id;
      token.isActive = currentUser.is_active;
      token.isSuperAdmin = resolveSuperAdminAccess({
        email: currentUser.email,
        isSuperAdmin: currentUser.is_super_admin,
      });
      return token;
    },
    async session({ session, token }) {
      if (!session.user || !token.sub) {
        return session;
      }

      session.user.id = token.sub;
      session.user.organizationId = typeof token.organizationId === "string" ? token.organizationId : null;
      session.user.isActive = token.isActive !== false;
      session.user.isSuperAdmin = token.isSuperAdmin === true;

      return session;
    },
  },
  secret: process.env.AUTH_SECRET,
};
