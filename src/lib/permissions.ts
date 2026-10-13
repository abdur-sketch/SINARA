export const PERMISSIONS = [
  "organization.read", "organization.manage", "unit.read", "unit.manage",
  "employee.read", "employee.create", "employee.update", "employee.archive",
  "employee.document.read", "employee.document.manage", "position.read", "position.manage",
  "assignment.read", "assignment.manage", "user.manage", "role.manage", "audit.read",
  "employee.self.read"
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<string, readonly PermissionKey[]> = {
  SUPER_ADMIN: PERMISSIONS,
  YAYASAN: ["organization.read", "unit.read", "employee.read", "position.read", "assignment.read", "audit.read"],
  HR_ADMIN: ["organization.read", "unit.read", "unit.manage", "employee.read", "employee.create", "employee.update", "employee.archive", "employee.document.read", "employee.document.manage", "position.read", "position.manage", "assignment.read", "assignment.manage", "audit.read"],
  BENDAHARA: ["organization.read", "unit.read", "employee.read", "position.read", "assignment.read"],
  KEPALA_UNIT: ["unit.read", "employee.read", "position.read", "assignment.read"],
  PEGAWAI: ["employee.self.read"]
};

export function hasPermission(userPermissions: readonly string[] | undefined, required: PermissionKey) {
  return Boolean(userPermissions?.includes(required));
}
