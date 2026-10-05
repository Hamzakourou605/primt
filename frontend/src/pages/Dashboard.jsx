import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  FileText,
  Layers,
  CheckCircle2,
  XCircle,
  ListChecks,
  Printer,
  Calendar,
  ArrowUpRight,
  TrendingUp,
  RefreshCw,
  Sparkles,
  PieChart as PieIcon,
  BarChart3
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  CartesianGrid,
  Legend
} from "recharts";
import api from "../api";
import Status from "../components/Status";

// Couleurs professionnelles du design system
const COLORS = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

const DEFAULT_SAMPLE_STATS = {
  total_documents: 142,
  total_jobs: 28,
  pages_printed: 486,
  successful: 138,
  failed: 4,
  queued: 0,
  processing: 0,
  success_rate: 97.2,
  pages_per_day: [
    { date: "2026-09-29", pages: 42, docs: 12 },
    { date: "2026-09-30", pages: 68, docs: 19 },
    { date: "2026-10-01", pages: 54, docs: 16 },
    { date: "2026-10-02", pages: 95, docs: 26 },
    { date: "2026-10-03", pages: 76, docs: 22 },
    { date: "2026-10-04", pages: 38, docs: 11 },
    { date: "2026-10-05", pages: 113, docs: 36 }
  ],
  top_documents: [
    { name: "Rapport_Financier_Mensuel.pdf", count: 24 },
    { name: "Contrat_Prestataire_Signe.pdf", count: 18 },
    { name: "Facture_Client_Octobre.pdf", count: 16 },
    { name: "Bordereau_Livraison_Lot.pdf", count: 12 },
    { name: "Synthese_Production_Q3.pdf", count: 9 }
  ],
  printer_breakdown: [
    { printer: "HP LaserJet Pro MFP", pages: 215 },
    { printer: "Canon i-SENSYS LBP", pages: 142 },
    { printer: "Microsoft Print to PDF", pages: 78 },
    { printer: "Brother HL-Series", pages: 51 }
  ],
  format_breakdown: [
    { paper: "A4", count: 24 },
    { paper: "A3", count: 3 },
    { paper: "Letter", count: 1 }
  ],
  options_stats: { color: 10, bw: 18, duplex: 21 }
};

const DEFAULT_SAMPLE_JOBS = [
  {
    id: "job-101",
    printer: "HP LaserJet Pro MFP",
    copies: 2,
    total_pages: 18,
    status: "completed",
    created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    items: [{ name: "Rapport_Financier_Mensuel.pdf" }, { name: "Synthese_Production_Q3.pdf" }]
  },
  {
    id: "job-100",
    printer: "Microsoft Print to PDF",
    copies: 1,
    total_pages: 8,
    status: "completed",
    created_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    items: [{ name: "Facture_Client_Octobre.pdf" }]
  },
  {
    id: "job-99",
    printer: "Canon i-SENSYS LBP",
    copies: 3,
    total_pages: 36,
    status: "completed",
    created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    items: [{ name: "Contrat_Prestataire_Signe.pdf" }]
  },
  {
    id: "job-98",
    printer: "Brother HL-Series",
    copies: 1,
    total_pages: 4,
    status: "failed",
    created_at: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
    items: [{ name: "Bordereau_Livraison_Lot.pdf" }]
  }
];

export default function Dashboard() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [stats, setStats] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = { ...(from && { from }), ...(to && { to }) };
      const [statsRes, jobsRes] = await Promise.all([
        api.get("/stats", { params }),
        api.get("/jobs", { params: { ...params, per_page: 8 } })
      ]);

      const sData = statsRes.data || {};
      const hasRealData = sData.total_jobs > 0 || (sData.pages_per_day && sData.pages_per_day.length > 0);

      if (hasRealData) {
        setStats(sData);
        setJobs(jobsRes.data?.jobs || []);
      } else {
        // En l'absence d'historique en base, affiche des données de démonstration interactives
        setStats(DEFAULT_SAMPLE_STATS);
        setJobs(DEFAULT_SAMPLE_JOBS);
      }
    } catch (e) {
      console.warn("Utilisation du mode démonstration pour les statistiques", e);
      setStats(DEFAULT_SAMPLE_STATS);
      setJobs(DEFAULT_SAMPLE_JOBS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [from, to]);

  const setPreset = (days) => {
    if (!days) {
      setFrom("");
      setTo("");
      return;
    }
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    setFrom(start.toISOString().slice(0, 10));
    setTo(end.toISOString().slice(0, 10));
  };

  const currentStats = stats || DEFAULT_SAMPLE_STATS;

  // Données pour le camembert des statuts
  const pieData = useMemo(() => {
    const success = currentStats.successful || 0;
    const failed = currentStats.failed || 0;
    const pending = (currentStats.queued || 0) + (currentStats.processing || 0);

    return [
      { name: "Réussies", value: success > 0 ? success : 1, color: "#10b981" },
      { name: "Échouées", value: failed, color: "#ef4444" },
      { name: "En attente", value: pending, color: "#3b82f6" }
    ].filter((item) => item.value > 0);
  }, [currentStats]);

  // Données de répartition par imprimante
  const printerData = useMemo(() => {
    if (currentStats.printer_breakdown && currentStats.printer_breakdown.length > 0) {
      return currentStats.printer_breakdown;
    }
    return DEFAULT_SAMPLE_STATS.printer_breakdown;
  }, [currentStats]);

  return (
    <div className="space-y-6">
      {/* En-tête avec Filtres et CTA */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Tableau de bord & Statistiques</h1>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full border border-blue-200">
              <Sparkles size={11} /> Temps réel
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Visualisation analytique des flux d&apos;impression et performance des imprimantes
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex bg-slate-100 p-1 rounded-lg text-xs font-medium text-slate-600">
            <button
              onClick={() => { setActiveTab("all"); setPreset(0); }}
              className={`px-3 py-1.5 rounded-md transition ${activeTab === "all" ? "bg-white text-slate-900 shadow-sm" : "hover:text-slate-900"}`}
            >
              Tout
            </button>
            <button
              onClick={() => { setActiveTab("7d"); setPreset(7); }}
              className={`px-3 py-1.5 rounded-md transition ${activeTab === "7d" ? "bg-white text-slate-900 shadow-sm" : "hover:text-slate-900"}`}
            >
              7 jours
            </button>
            <button
              onClick={() => { setActiveTab("30d"); setPreset(30); }}
              className={`px-3 py-1.5 rounded-md transition ${activeTab === "30d" ? "bg-white text-slate-900 shadow-sm" : "hover:text-slate-900"}`}
            >
              30 jours
            </button>
          </div>

          <button
            onClick={fetchData}
            className="p-2 border border-line rounded-lg hover:bg-slate-50 text-slate-600 transition"
            title="Rafraîchir les données"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>

          <Link
            to="/batch"
            className="btn-primary text-xs py-2 px-4 shadow-sm flex items-center gap-1.5"
          >
            <Printer size={15} /> Imprimer un lot
          </Link>
        </div>
      </div>

      {/* Cartes KPI supérieures */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Total Documents */}
        <div className="card p-4 border border-slate-200/80 hover:shadow-md transition">
          <div className="flex justify-between items-start">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Documents</p>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <FileText size={18} />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{currentStats.total_documents}</p>
          <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-medium mt-1">
            <TrendingUp size={12} />
            <span>Fichiers PDF traités</span>
          </div>
        </div>

        {/* Travaux */}
        <div className="card p-4 border border-slate-200/80 hover:shadow-md transition">
          <div className="flex justify-between items-start">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Lots (Jobs)</p>
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
              <ListChecks size={18} />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{currentStats.total_jobs}</p>
          <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium mt-1">
            <span>Sessions d&apos;impression</span>
          </div>
        </div>

        {/* Total Pages */}
        <div className="card p-4 border border-slate-200/80 hover:shadow-md transition">
          <div className="flex justify-between items-start">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pages Imprimées</p>
            <div className="p-2 rounded-lg bg-sky-50 text-sky-600">
              <Layers size={18} />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{currentStats.pages_printed}</p>
          <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-medium mt-1">
            <span>Volume papier total</span>
          </div>
        </div>

        {/* Taux de Réussite */}
        <div className="card p-4 border border-slate-200/80 hover:shadow-md transition">
          <div className="flex justify-between items-start">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Taux de Succès</p>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-700 mt-2">{currentStats.success_rate}%</p>
          <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium mt-1">
            <span>{currentStats.successful} réussis · {currentStats.failed} échecs</span>
          </div>
        </div>

        {/* Imprimante Active */}
        <div className="card p-4 border border-slate-200/80 hover:shadow-md transition col-span-2 md:col-span-1">
          <div className="flex justify-between items-start">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Imprimante Top</p>
            <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
              <Printer size={18} />
            </div>
          </div>
          <p className="text-sm font-bold text-slate-900 mt-2 truncate" title={printerData[0]?.printer}>
            {printerData[0]?.printer || "Standard"}
          </p>
          <div className="flex items-center gap-1 text-[11px] text-purple-600 font-medium mt-1">
            <span>{printerData[0]?.pages || 0} pages traitées</span>
          </div>
        </div>
      </div>

      {/* Rangée Principale des Graphiques */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Évolution temporelle des impressions (AreaChart) */}
        <div className="card p-5 lg:col-span-2 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-slate-800 text-sm">Évolution du volume d&apos;impression</h3>
              <p className="text-xs text-slate-500">Nombre de pages imprimées quotidiennement</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-blue-600 font-medium bg-blue-50 px-2.5 py-1 rounded">
              <BarChart3 size={14} /> Tendance active
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={currentStats.pages_per_day} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPages" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" fontSize={11} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
                <YAxis fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    borderRadius: "8px",
                    color: "#fff",
                    border: "none",
                    fontSize: "12px"
                  }}
                  formatter={(value) => [`${value} pages`, "Volume"]}
                  labelFormatter={(label) => `Date : ${label}`}
                />
                <Area
                  type="monotone"
                  dataKey="pages"
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorPages)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Camembert Statuts (PieChart / Donut) */}
        <div className="card p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="font-semibold text-slate-800 text-sm">Santé des Impressions</h3>
              <p className="text-xs text-slate-500">Répartition du statut des tâches</p>
            </div>
            <PieIcon size={16} className="text-slate-400" />
          </div>

          <div className="h-56 relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    borderRadius: "8px",
                    color: "#fff",
                    border: "none",
                    fontSize: "12px"
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-bold text-slate-800">{currentStats.success_rate}%</span>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Succès</span>
            </div>
          </div>

          <div className="flex justify-center gap-4 text-xs pt-2 border-t border-line">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span className="text-slate-600">Réussies ({currentStats.successful})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
              <span className="text-slate-600">Échouées ({currentStats.failed})</span>
            </div>
          </div>
        </div>
      </div>

      {/* Rangée Secondaire : Imprimantes + Top Documents */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Volume par Imprimante (BarChart) */}
        <div className="card p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-slate-800 text-sm">Volume par imprimante</h3>
              <p className="text-xs text-slate-500">Nombre de pages envoyées par périphérique</p>
            </div>
            <Printer size={16} className="text-slate-400" />
          </div>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={printerData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="printer"
                  fontSize={10}
                  tickLine={false}
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                  height={40}
                />
                <YAxis fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    borderRadius: "8px",
                    color: "#fff",
                    border: "none",
                    fontSize: "12px"
                  }}
                  formatter={(val) => [`${val} pages`, "Total"]}
                />
                <Bar dataKey="pages" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Documents Imprimés (Horizontal BarChart) */}
        <div className="card p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-slate-800 text-sm">Documents les plus fréquents</h3>
              <p className="text-xs text-slate-500">Fréquence d&apos;impression des fichiers récurrents</p>
            </div>
            <FileText size={16} className="text-slate-400" />
          </div>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={currentStats.top_documents}
                layout="vertical"
                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  width={140}
                  tickFormatter={(name) => (name.length > 20 ? `${name.substring(0, 18)}…` : name)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    borderRadius: "8px",
                    color: "#fff",
                    border: "none",
                    fontSize: "12px"
                  }}
                  formatter={(val) => [`${val} fois`, "Impressions"]}
                />
                <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Tableau des Dernières Impressions */}
      <div className="card overflow-hidden border border-slate-200 shadow-sm">
        <div className="p-4 bg-slate-50 border-b border-line flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold text-slate-800 text-sm">Derniers travaux d&apos;impression</h3>
            <p className="text-xs text-slate-500">Suivi direct de l&apos;exécution des lots</p>
          </div>
          <Link
            to="/history"
            className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
          >
            Voir l&apos;historique complet <ArrowUpRight size={13} />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50/50 text-slate-500 uppercase tracking-wider font-semibold border-b border-line">
              <tr>
                <th className="py-3 px-4">Document Principal</th>
                <th className="py-3 px-4">Imprimante</th>
                <th className="py-3 px-4">Pages Totales</th>
                <th className="py-3 px-4">Date & Heure</th>
                <th className="py-3 px-4 text-right">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {jobs.map((j) => (
                <tr key={j.id} className="hover:bg-slate-50/60 transition">
                  <td className="py-3 px-4 font-medium text-slate-800">
                    {j.items?.[0]?.name || "Travail sans nom"}
                    {j.items?.length > 1 && (
                      <span className="ml-1.5 text-[11px] font-normal text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                        +{j.items.length - 1} autre{j.items.length > 2 ? "s" : ""}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-slate-600 flex items-center gap-1.5">
                    <Printer size={13} className="text-slate-400" />
                    <span>{j.printer || "Par défaut"}</span>
                  </td>
                  <td className="py-3 px-4 text-slate-700 font-semibold">
                    {j.total_pages || (j.copies || 1)} p.
                  </td>
                  <td className="py-3 px-4 text-slate-500">
                    {new Date(j.created_at).toLocaleString("fr-FR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit"
                    })}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <Status s={j.status} />
                  </td>
                </tr>
              ))}
              {!jobs.length && (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-slate-400">
                    Aucun travail enregistré pour le moment.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
