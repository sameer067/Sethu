import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getDb } from "./mongodb";
import { ObjectId } from "mongodb";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        phone: { label: "Phone", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.phone || !credentials?.password) return null;
        const db = await getDb();
        const user = await db.collection("users").findOne({
          phone: credentials.phone.trim(),
        });
        if (!user?.passwordHash) return null;
        const ok = await bcrypt.compare(
          credentials.password,
          user.passwordHash as string
        );
        if (!ok) return null;
        return {
          id: (user._id as import("mongodb").ObjectId).toString(),
          phone: user.phone as string,
          name: (user.name as string) || null,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.phone = user.phone;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.phone = token.phone as string;
      }
      return session;
    },
  },
};

export function getUserIdFromObjectId(id: string): ObjectId {
  return new ObjectId(id);
}
