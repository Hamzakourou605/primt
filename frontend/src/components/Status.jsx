const map = { completed: ["Terminé", "bg-emerald-100 text-emerald-800"], processing: ["En cours", "bg-blue-100 text-blue-800"],
  queued: ["En attente", "bg-amber-100 text-amber-800"], failed: ["Échec", "bg-red-100 text-red-800"], cancelled: ["Annulé", "bg-slate-200 text-slate-700"] };
export default function Status({ s }) {
  const [l, c] = map[s] || [s, "bg-slate-100"];
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${c}`}>{l}</span>;
}
