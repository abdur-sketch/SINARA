import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      organizationId: string;
      employeeId?: string | null;
      permissions: string[];
      roles: string[];
      name?: string | null;
      email?: string | null;
    };
  }
  interface User {
    organizationId: string;
    employeeId?: string | null;
    permissions: string[];
    roles: string[];
    sessionVersion: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    organizationId: string;
    employeeId?: string | null;
    permissions: string[];
    roles: string[];
    sessionVersion: number;
  }
}
