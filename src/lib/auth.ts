import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { writeAudit } from "@/lib/audit";
import { consumeVerifiedProof, requiresMfa } from "@/lib/mfa";
import { z } from "zod";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 8 * 60 * 60, updateAge: 30 * 60 },
  jwt: { maxAge: 8 * 60 * 60 },
  pages: { signIn: "/login" },
  providers: [CredentialsProvider({
    name: "Email dan kata sandi",
    credentials: { proof: { label: "Bukti autentikasi sekali pakai", type: "password" } },
    async authorize(credentials) {
      const parsed = z.object({ proof: z.string().min(32) }).safeParse(credentials);
      if (!parsed.success) return null;
      const user = await consumeVerifiedProof(parsed.data.proof);
      if (!user || !user.isActive) return null;
      await writeAudit({ organizationId: user.organizationId, actorId: user.id, action: "AUTH_LOGIN_SUCCESS", entityType: "User", entityId: user.id });
      const roles = user.roles.map((r) => r.role.name);
      const permissions = [...new Set(user.roles.flatMap((r) => r.role.permissions.map((p) => p.permission.key)))];
      return { id: user.id, email: user.email, name: user.name, organizationId: user.organizationId, employeeId: user.employeeId, roles, permissions, sessionVersion: user.sessionVersion, mfaVerifiedAt: requiresMfa(roles) ? Date.now() : null };
    }
  })],
  callbacks: {
    async jwt({ token, user }) {
      if (user) Object.assign(token, user);
      return token;
    },
    async session({ session, token }) {
      if (session.user) Object.assign(session.user, { id: token.id, organizationId: token.organizationId, employeeId: token.employeeId, permissions: token.permissions ?? [], roles: token.roles ?? [], sessionVersion: token.sessionVersion, mfaVerifiedAt: token.mfaVerifiedAt });
      return session;
    }
  }
};
