import { describe,expect,it } from "vitest";import { authOptions } from "./auth";
describe("konfigurasi sesi",()=>{it("kedaluwarsa maksimal delapan jam",()=>{expect(authOptions.session?.maxAge).toBe(8*60*60);expect(authOptions.jwt?.maxAge).toBe(8*60*60)});it("menggunakan sesi JWT",()=>expect(authOptions.session?.strategy).toBe("jwt"))});
