import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { loginSchema } from "@/lib/validation";
import { writeAudit } from "@/lib/audit";

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 8 * 60 * 60, updateAge: 30 * 60 },
  jwt: { maxAge: 8 * 60 * 60 },
  pages: { signIn: "/login" },
  providers: [CredentialsProvider({
    name: "Email dan kata sandi",
    credentials: { email: { label: "Email", type: "email" }, password: { label: "Kata sandi", type: "password" } },
    async authorize(credentials) {
      const parsed = loginSchema.safeParse(credentials);
      if (!parsed.success) return null;
      const user = await db.user.findUnique({
        where: { email: parsed.data.email },
        include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } }
      });
      if (!user || !user.isActive) {
        if (user) await writeAudit({ organizationId: user.organizationId, actorId: user.id, action: "AUTH_LOGIN_FAILED", entityType: "User", entityId: user.id, metadata: { reason: "inactive" } });
        return null;
      }
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        await writeAudit({ organizationId: user.organizationId, actorId: user.id, action: "AUTH_LOGIN_FAILED", entityType: "User", entityId: user.id, metadata: { reason: "locked" } });
        return null;
      }
      const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
      if (!valid) {
        const attempts = user.failedLoginAttempts + 1;
        await db.user.update({ where: { id: user.id }, data: { failedLoginAttempts: attempts, lockedUntil: attempts >= MAX_ATTEMPTS ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null } });
        await writeAudit({ organizationId: user.organizationId, actorId: user.id, action: "AUTH_LOGIN_FAILED", entityType: "User", entityId: user.id, metadata: { reason: "invalid_credentials", attempts } });
        return null;
      }
      await db.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, lockedUntil: null } });
      await writeAudit({ organizationId: user.organizationId, actorId: user.id, action: "AUTH_LOGIN_SUCCESS", entityType: "User", entityId: user.id });
      const roles = user.roles.map((r) => r.role.name);
      const permissions = [...new Set(user.roles.flatMap((r) => r.role.permissions.map((p) => p.permission.key)))];
      return { id: user.id, email: user.email, name: user.name, organizationId: user.organizationId, employeeId: user.employeeId, roles, permissions, sessionVersion: user.sessionVersion };
    }
  })],
  callbacks: {
    async jwt({ token, user }) {
      if (user) Object.assign(token, user);
      return token;
    },
    async session({ session, token }) {
      if (session.user) Object.assign(session.user, { id: token.id, organizationId: token.organizationId, employeeId: token.employeeId, permissions: token.permissions ?? [], roles: token.roles ?? [] });
      return session;
    }
  }
};
