import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, Printer, History, LogOut, Menu } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../auth";
const links = [["/", "Tableau de bord", LayoutDashboard], ["/batch", "Impression en lot", Printer], ["/history", "Historique", History]];
export default function Layout() {
  const { user, logout } = useAuth(); const nav = useNavigate(); const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen lg:flex">
      <aside className={`${open ? "flex" : "hidden"} lg:flex flex-col w-full lg:w-60 bg-white border-r border-line p-4 lg:sticky lg:top-0 lg:h-screen`}>
        <div className="flex items-center gap-2 mb-8"><div className="w-9 h-9 rounded-lg bg-electric grid place-items-center text-white"><Printer size={18} /></div><span className="font-bold text-lg">PrintFlow</span></div>
        <nav className="space-y-1 flex-1">
          {links.map(([to, label, Icon]) => (
            <NavLink key={to} to={to} end={to === "/"} onClick={() => setOpen(false)}
              className={({ isActive }) => `flex items-center gap-3 px-3 h-10 rounded-lg text-sm font-medium ${isActive ? "bg-electric text-white" : "text-navy hover:bg-soft"}`}>
              <Icon size={18} />{label}</NavLink>))}
        </nav>
        <div className="border-t border-line pt-3 flex items-center justify-between text-sm">
          <span className="truncate">{user?.name || user?.email}</span>
          <button title="Déconnexion" onClick={() => { logout(); nav("/login"); }}><LogOut size={18} /></button>
        </div>
      </aside>
      <div className="flex-1 min-w-0">
        <button className="lg:hidden p-3" onClick={() => setOpen(!open)}><Menu /></button>
        <main className="p-4 lg:p-8 max-w-6xl mx-auto"><Outlet /></main>
      </div>
    </div>
  );
}
