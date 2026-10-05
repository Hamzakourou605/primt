import { useEffect, useState } from "react";
import { FileText, Layers, CheckCircle2, XCircle, ListChecks } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from "recharts";
import api from "../api";
import Status from "../components/Status";
const Card = ({ icon: I, label, value, color }) => (
  <div className="card p-4 flex items-center justify-between"><div><p className="text-xs text-slate-500 uppercase">{label}</p><p className="text-2xl font-bold mt-1">{value}</p></div><I className={color} /></div>);
export default function Dashboard() {
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [s, setS] = useState(null); const [jobs, setJobs] = useState([]);
  useEffect(() => {
    const params = { ...(from && { from }), ...(to && { to }) };
    api.get("/stats", { params }).then((r) => setS(r.data));
    api.get("/jobs", { params: { ...params, per_page: 8 } }).then((r) => setJobs(r.data.jobs));
  }, [from, to]);
  if (!s) return <p>Chargement…</p>;
  const pie = [["Réussies", s.successful, "#006c49"], ["Échouées", s.failed, "#ba1a1a"]];
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3"><h1 className="text-2xl font-bold">Tableau de bord</h1>
        <div className="flex gap-2"><input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /><input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} /></div></div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card icon={FileText} label="Documents imprimés" value={s.total_documents} color="text-electric" />
        <Card icon={ListChecks} label="Travaux" value={s.total_jobs} color="text-electric" />
        <Card icon={Layers} label="Pages imprimées" value={s.pages_printed} color="text-electric" />
        <Card icon={CheckCircle2} label="Réussies" value={`${s.successful} (${s.success_rate}%)`} color="text-ok" />
        <Card icon={XCircle} label="Échouées" value={s.failed} color="text-red-600" />
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card p-4 lg:col-span-2 h-72"><h3 className="font-semibold mb-2">Pages imprimées par jour</h3>
          <ResponsiveContainer width="100%" height="90%"><AreaChart data={s.pages_per_day}><XAxis dataKey="date" fontSize={11} /><YAxis fontSize={11} /><Tooltip />
            <Area dataKey="pages" stroke="#4263eb" fill="#4263eb33" /></AreaChart></ResponsiveContainer></div>
        <div className="card p-4 h-72"><h3 className="font-semibold mb-2">Réussies / échouées</h3>
          <ResponsiveContainer width="100%" height="90%"><PieChart><Pie data={pie.map(([name, value]) => ({ name, value }))} dataKey="value" innerRadius={50} outerRadius={80}>
            {pie.map((p) => <Cell key={p[0]} fill={p[2]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div>
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card p-4 h-64"><h3 className="font-semibold mb-2">Documents les plus imprimés</h3>
          <ResponsiveContainer width="100%" height="85%"><BarChart data={s.top_documents} layout="vertical"><XAxis type="number" hide /><YAxis type="category" dataKey="name" width={110} fontSize={11} /><Tooltip /><Bar dataKey="count" fill="#4263eb" radius={4} /></BarChart></ResponsiveContainer></div>
        <div className="card p-4 lg:col-span-2 overflow-x-auto"><h3 className="font-semibold mb-2">Dernières impressions</h3>
          <table className="w-full text-sm"><thead className="text-left text-slate-500"><tr><th>Document(s)</th><th>Pages</th><th>Date</th><th>Statut</th></tr></thead><tbody>
            {jobs.map((j) => <tr key={j.id} className="border-t border-line"><td className="py-2">{j.items[0]?.name}{j.items.length > 1 && ` +${j.items.length - 1}`}</td><td>{j.total_pages}</td>
              <td>{new Date(j.created_at).toLocaleString("fr-FR")}</td><td><Status s={j.status} /></td></tr>)}
            {!jobs.length && <tr><td colSpan="4" className="py-4 text-slate-500">Aucune impression.</td></tr>}</tbody></table></div>
      </div>
    </div>
  );
}
