import NextAuth, { DefaultSession } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@regintel/database";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "VIEWER" | "REVIEWER" | "ADMIN";
    } & DefaultSession["user"];
  }

  interface User {
    role: "VIEWER" | "REVIEWER" | "ADMIN";
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt", // Changed from "database" to work with middleware
  },
  pages: {
    signIn: "/auth/signin",
  },
  callbacks: {
    async jwt({ token, user }) {
      // On sign in, add user info to token
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      // Add user info from token to session
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as "VIEWER" | "REVIEWER" | "ADMIN";
      }
      return session;
    },
  },
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
      // Optional: Restrict to organization
      // authorization: {
      //   params: {
      //     scope: "read:user user:email read:org",
      //   },
      // },
    }),
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      // Optional: Restrict to specific domain
      // authorization: {
      //   params: {
      //     hd: "yourcompany.com", // Google Workspace domain
      //   },
      // },
    }),
  ],
});
