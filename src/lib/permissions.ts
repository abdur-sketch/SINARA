export const BASE_PERMISSIONS = [
  "organization.read", "organization.manage", "unit.read", "unit.manage",
  "employee.read", "employee.create", "employee.update", "employee.archive",
  "employee.document.read", "employee.document.manage", "position.read", "position.manage",
  "assignment.read", "assignment.manage", "user.manage", "role.manage", "audit.read",
  "employee.self.read"
] as const;

export const COMPENSATION_PERMISSIONS = [
  "compensation.grade.read", "compensation.grade.manage",
  "compensation.policy.read", "compensation.policy.manage", "compensation.policy.approve",
  "compensation.component.read", "compensation.component.manage",
  "compensation.proposal.create", "compensation.proposal.review",
  "compensation.simulation.run", "compensation.simulation.export", "compensation.audit.read"
] as const;

export const ATTENDANCE_PERMISSIONS = [
  "attendance.read.own", "attendance.read.unit", "attendance.read.all",
  "attendance.checkin", "attendance.manage", "attendance.correction.create",
  "attendance.correction.review", "attendance.schedule.manage", "attendance.report.export",
  "leave.create", "leave.review", "leave.manage"
] as const;

export const PERMISSIONS = [...BASE_PERMISSIONS, ...COMPENSATION_PERMISSIONS, ...ATTENDANCE_PERMISSIONS] as const;

export type PermissionKey = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<string, readonly PermissionKey[]> = {
  SUPER_ADMIN: PERMISSIONS,
  YAYASAN: ["organization.read", "unit.read", "employee.read", "position.read", "assignment.read", "audit.read", "compensation.grade.read", "compensation.policy.read", "compensation.policy.approve", "compensation.component.read", "compensation.proposal.review", "compensation.simulation.run", "compensation.audit.read", "attendance.read.all", "attendance.report.export"],
  HR_ADMIN: ["organization.read", "unit.read", "unit.manage", "employee.read", "employee.create", "employee.update", "employee.archive", "employee.document.read", "employee.document.manage", "position.read", "position.manage", "assignment.read", "assignment.manage", "audit.read", "compensation.grade.read", "compensation.grade.manage", "compensation.policy.read", "compensation.policy.manage", "compensation.component.read", "compensation.component.manage", "compensation.proposal.create", "compensation.simulation.run", "compensation.audit.read", ...ATTENDANCE_PERMISSIONS],
  BENDAHARA: ["organization.read", "unit.read", "employee.read", "position.read", "assignment.read", "compensation.grade.read", "compensation.policy.read", "compensation.component.read", "compensation.simulation.run", "compensation.simulation.export"],
  KEPALA_UNIT: ["unit.read", "employee.read", "position.read", "assignment.read", "attendance.read.own", "attendance.read.unit", "attendance.checkin", "attendance.correction.create", "attendance.correction.review", "attendance.report.export", "leave.create", "leave.review"],
  PEGAWAI: ["employee.self.read", "attendance.read.own", "attendance.checkin", "attendance.correction.create", "leave.create"]
};

export function hasPermission(userPermissions: readonly string[] | undefined, required: PermissionKey) {
  return Boolean(userPermissions?.includes(required));
}
