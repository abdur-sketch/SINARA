import { z } from "zod";

const optionalText = z.string().trim().max(500).optional().or(z.literal(""));
export const employeeSchema = z.object({
  employeeNumber: z.string().trim().min(2, "Nomor induk wajib diisi").max(40),
  fullName: z.string().trim().min(2, "Nama lengkap wajib diisi").max(150),
  gender: z.enum(["MALE", "FEMALE"]),
  birthDate: z.string().date().optional().or(z.literal("")),
  email: z.string().email("Email tidak valid").optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  address: optionalText,
  lastEducation: z.string().trim().max(100).optional().or(z.literal("")),
  competencies: optionalText,
  startDate: z.string().date(),
  internalStatus: z.enum(["GTY", "CGTY", "GTTY", "TENDIK", "TENAGA_PESANTREN"]),
  relationshipType: z.enum(["PERMANENT", "FIXED_TERM", "PART_TIME", "FREELANCE", "OTHER"]),
  contractEndDate: z.string().date().optional().or(z.literal("")),
  primaryUnitId: z.string().uuid(),
  positionId: z.string().uuid()
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(12).max(128)
});

export type EmployeeInput = z.infer<typeof employeeSchema>;
