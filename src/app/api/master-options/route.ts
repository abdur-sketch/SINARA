import { getApiActor } from "@/lib/access";
import { db } from "@/lib/db";
export async function GET(){const actor=await getApiActor("employee.read");if("error" in actor)return actor.error;const organizationId=actor.session.user.organizationId;const [units,positions]=await Promise.all([db.unit.findMany({where:{organizationId,isActive:true},select:{id:true,name:true},orderBy:{name:"asc"}}),db.position.findMany({where:{organizationId,isActive:true},select:{id:true,name:true},orderBy:{name:"asc"}})]);return Response.json({units,positions})}
