import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { dateOnly } from "./attendance";

const db = new PrismaClient(); const auth = vi.hoisted(() => ({ requireRecentMfa: vi.fn() }));
vi.mock("@/lib/access", () => ({ requireRecentMfa: auth.requireRecentMfa }));
let organizationId="", requesterId="", reviewerId="", employeeId="", leaveId="";
beforeAll(async()=>{
  const organization=await db.organization.create({data:{code:"LEAVE_API_TEST",name:"Leave API Test"}});organizationId=organization.id;
  const unit=await db.unit.create({data:{organizationId,code:"UNIT",name:"Leave Unit",type:"TEST"}});
  const employee=await db.employee.create({data:{organizationId,employeeNumber:"LEAVE-001",fullName:"Leave Employee",gender:"FEMALE",startDate:dateOnly("2026-01-01"),internalStatus:"GTY",primaryUnitId:unit.id}});employeeId=employee.id;
  const [requester,reviewer]=await Promise.all([db.user.create({data:{organizationId,employeeId,email:"leave-requester@example.test",name:"Requester",passwordHash:"test"}}),db.user.create({data:{organizationId,email:"leave-reviewer@example.test",name:"Reviewer",passwordHash:"test"}})]);requesterId=requester.id;reviewerId=reviewer.id;
  const schedule=await db.workSchedule.create({data:{organizationId,code:"LEAVE-REG",name:"Regular",workDays:[1,2,3,4,5],startMinute:480,endMinute:960}});await db.workScheduleAssignment.create({data:{employeeId,scheduleId:schedule.id,effectiveFrom:dateOnly("2026-01-01")}});
  const leaveType=await db.leaveType.create({data:{organizationId,code:"ANNUAL",name:"Annual leave",annualQuota:12}});
  const leave=await db.leaveRequest.create({data:{organizationId,employeeId,leaveTypeId:leaveType.id,startDate:dateOnly("2026-10-15"),endDate:dateOnly("2026-10-15"),workDays:1,reason:"Synthetic approval",requestedById:requesterId}});leaveId=leave.id;
});
afterAll(()=>db.$disconnect());
beforeEach(()=>auth.requireRecentMfa.mockResolvedValue({session:{user:{id:reviewerId,organizationId,permissions:["attendance.read.all"]}}}));

describe("leave approval transaction",()=>{
  it("prevents self approval",async()=>{auth.requireRecentMfa.mockResolvedValueOnce({session:{user:{id:requesterId,organizationId,permissions:["attendance.read.all"]}}});const {POST}=await import("@/app/api/attendance/leave/[id]/review/route");const response=await POST(reviewRequest(),{params:Promise.resolve({id:leaveId})});expect(response!.status).toBe(409)});
  it("approves leave, consumes balance, and creates attendance without payroll mutation",async()=>{const {POST}=await import("@/app/api/attendance/leave/[id]/review/route");const response=await POST(reviewRequest(),{params:Promise.resolve({id:leaveId})});expect(response!.status).toBe(200);expect(await db.leaveRequest.findUnique({where:{id:leaveId},select:{status:true}})).toEqual({status:"APPROVED"});expect(await db.leaveBalance.findFirst({where:{employeeId},select:{allowance:true,used:true}})).toEqual({allowance:12,used:1});expect(await db.attendanceRecord.findUnique({where:{organizationId_employeeId_date:{organizationId,employeeId,date:dateOnly("2026-10-15")}},select:{status:true}})).toEqual({status:"LEAVE"})});
});
function reviewRequest(){return new Request("http://local/api/attendance/leave/id/review",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"APPROVE"})})}
