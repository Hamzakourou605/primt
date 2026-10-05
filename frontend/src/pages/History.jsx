import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import api from "../api";
import Status from "../components/Status";
export default function History() {
  const [f, setF] = useState({ q: "", status: "", from: "", to: "" }); const [data, setData] = useState({ jobs: [], total: 0 });
  useEffect(() => {
    const t = setTimeout(() => api.get("/jobs", { params: Object.fromEntries(Object.entries(f).filter(([, v]) => v)) }).then((r) => setData(r.data)), 250);
    return () => clearTimeout(t);
  }, [f]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="space-y-4"><h1 className="text-2xl font-bold">Historique</h1>
      <div className="flex flex-wrap gap-2"><div className="relative"><Search size={16} className="absolute left-3 top-3 text-slate-400" /><input className="input pl-9" placeholder="Nom de fichier" value={f.q} onChange={set("q")} /></div>
        <select className="input w-40" value={f.status} onChange={set("status")}><option value="">Tous statuts</option><option value="completed">Terminé</option><option value="failed">Échec</option><option value="processing">En cours</option><option value="queued">En attente</option><option value="cancelled">Annulé</option></select>
        <input type="date" className="input w-40" value={f.from} onChange={set("from")} /><input type="date" className="input w-40" value={f.to} onChange={set("to")} /></div>
      <div className="card overflow-x-auto"><table className="w-full text-sm"><thead className="text-left text-slate-500"><tr className="[&>th]:p-3"><th>Fichier</th><th>Pages</th><th>Copies</th><th>Imprimante</th><th>Date</th><th>Résultat</th></tr></thead><tbody>
        {data.jobs.flatMap((j) => j.items.map((i) => <tr key={`${j.id}-${i.id}`} className="border-t border-line [&>td]:p-3"><td>{i.name}{i.error && <div className="text-xs text-red-600">{i.error}</div>}</td><td>{i.pages}</td><td>{j.copies}</td><td>{j.printer}</td>
          <td>{new Date(j.created_at).toLocaleString("fr-FR")}</td><td><Status s={i.status} /></td></tr>))}
        {!data.jobs.length && <tr><td colSpan="6" className="p-4 text-slate-500">Aucun résultat.</td></tr>}</tbody></table></div></div>
  );
}
