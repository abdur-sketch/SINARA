export type ResetMail={to:string;token:string;expiresAt:Date};
export interface Mailer{sendPasswordReset(message:ResetMail):Promise<void>}
const developmentOutbox:ResetMail[]=[];
class FakeMailer implements Mailer{async sendPasswordReset(message:ResetMail){developmentOutbox.push(message)}}
export function getMailer():Mailer{if(process.env.MAILER_ADAPTER!=="fake"&&process.env.NODE_ENV==="production")throw new Error("Provider email resmi belum dikonfigurasi");return new FakeMailer()}
export function readDevelopmentOutbox(){if(process.env.NODE_ENV==="production")throw new Error("Outbox hanya tersedia pada development");return [...developmentOutbox]}
export function clearDevelopmentOutbox(){developmentOutbox.length=0}
