"use client";
import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
export function LogoutButton(){return <button className="nav-link" style={{width:"100%",border:0,background:"transparent",cursor:"pointer"}} onClick={()=>signOut({callbackUrl:"/login"})}><LogOut size={18}/><span>Keluar</span></button>}
