import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { getApiActor } from "@/lib/access";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { quarantineScan, validateFileSignature } from "@/lib/documents";

const allowed = new Set(["application/pdf", "image/jpeg", "image/png"]);
const types = new Set(["APPOINTMENT_DECREE", "CONTRACT", "DIPLOMA", "CERTIFICATE", "ASSIGNMENT"]);

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getApiActor("employee.document.manage");
  if ("error" in actor) return actor.error;
  const { id } = await params;
  const organizationId = actor.session.user.organizationId;
  const employee = await db.employee.findFirst({ where: { id, organizationId } });
  if (!employee) return Response.json({ error: "Pegawai tidak ditemukan" }, { status: 404 });
  const form = await req.formData();
  const file = form.get("file");
  const title = String(form.get("title") ?? "").trim();
  const type = String(form.get("type") ?? "");
  if (!(file instanceof File) || !title || !types.has(type)) return Response.json({ error: "Metadata dokumen tidak valid" }, { status: 400 });
  if (!allowed.has(file.type) || file.size > 5 * 1024 * 1024) return Response.json({ error: "File harus PDF/JPG/PNG dan maksimal 5 MB" }, { status: 400 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!validateFileSignature(bytes, file.type).valid) return Response.json({ error: "Isi file tidak cocok dengan tipe yang dikirim" }, { status: 400 });
  const scan = quarantineScan(bytes);
  if (scan.status === "REJECTED") {
    await writeAudit({ organizationId, actorId: actor.session.user.id, action: "DOCUMENT_REJECTED", entityType: "Employee", entityId: id, metadata: { reason: scan.note } });
    return Response.json({ error: "File ditolak oleh pemeriksaan keamanan" }, { status: 400 });
  }
  const storageKey = `${organizationId}/${id}/${randomUUID()}`;
  const root = path.resolve(/* turbopackIgnore: true */ process.env.DOCUMENT_STORAGE_PATH ?? "private-uploads");
  const target = path.resolve(root, storageKey);
  if (!target.startsWith(root + path.sep)) return Response.json({ error: "Lokasi file tidak valid" }, { status: 400 });
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bytes, { flag: "wx", mode: 0o600 });
  const document = await db.employeeDocument.create({ data: { organizationId, employeeId: id, type: type as never, title, storageKey, originalName: path.basename(file.name), mimeType: file.type, sizeBytes: file.size, scanStatus: scan.status, scanNote: scan.note } });
  await writeAudit({ organizationId, actorId: actor.session.user.id, action: "DOCUMENT_QUARANTINED", entityType: "EmployeeDocument", entityId: document.id, metadata: { employeeId: id, type, sizeBytes: file.size } });
  return Response.json({ id: document.id, scanStatus: document.scanStatus }, { status: 201 });
}
