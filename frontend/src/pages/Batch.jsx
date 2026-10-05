import { useEffect, useState } from "react";
import { FolderOpen, Upload, Printer, X, Ban, RotateCcw } from "lucide-react";
import api, { errMsg } from "../api";
import Status from "../components/Status";
const MAX = 50 * 1024 * 1024;
async function analyse(file) {
  const head = new TextDecoder("latin1").decode(await file.slice(0, 8).arrayBuffer());
  if (!head.startsWith("%PDF-")) throw new Error("PDF invalide");
  const txt = new TextDecoder("latin1").decode(await file.arrayBuffer());
  return Math.max(1, (txt.match(/\/Type\s*\/Page[^s]/g) || []).length);
}
const FINAL = ["completed", "failed", "cancelled"];
export default function Batch() {
  const [files, setFiles] = useState([]); const [invalid, setInvalid] = useState([]); const [busy, setBusy] = useState(false);
  const [s, setS] = useState({ printer: "", copies: 1, paper: "A4", orientation: "portrait", color: false, duplex: false });
  const [job, setJob] = useState(null); const [err, setErr] = useState("");
  const [printers, setPrinters] = useState([]);
  const add = async (list) => {
    setBusy(true); const ok = [...files], bad = [];
    for (const f of list) {
      if (!f.name.toLowerCase().endsWith(".pdf")) { bad.push(`${f.name} : pas un PDF`); continue; }
      if (f.size > MAX) { bad.push(`${f.name} : > 50 Mo`); continue; }
      if (ok.some((x) => x.name === f.name)) { bad.push(`${f.name} : doublon`); continue; }
      try { ok.push({ name: f.name, size: f.size, pages: await analyse(f) }); } catch (e) { bad.push(`${f.name} : ${e.message}`); }
    }
    setFiles(ok); setInvalid(bad); setBusy(false);
  };
  const start = async () => {
    setErr("");
    try { const { data } = await api.post("/jobs", { ...s, items: files.map(({ name, pages, size }) => ({ name, pages, size })) }); setJob(data); setFiles([]); }
    catch (e) { setErr(errMsg(e)); }
  };
  useEffect(() => {
    if (!job || FINAL.includes(job.status)) return;
    const t = setInterval(() => api.get(`/jobs/${job.id}`).then((r) => setJob(r.data)), 2000);
    return () => clearInterval(t);
  }, [job]);
  useEffect(() => {
    api.get("/printers").then(r => {
      setPrinters(r.data.printers || []);
      if (r.data.printers?.length && !s.printer) setS(prev => ({ ...prev, printer: r.data.printers[0] }));
    }).catch(console.error);
  }, []);
  const act = (a) => api.post(`/jobs/${job.id}/${a}`).then((r) => setJob(r.data));
  const set = (k, v) => setS({ ...s, [k]: v });
  const pages = files.reduce((a, f) => a + f.pages, 0);
  const done = job ? job.items.filter((i) => FINAL.includes(i.status)).length : 0;
  return (
    <div className="space-y-4"><h1 className="text-2xl font-bold">Impression en lot</h1>
      <div className="grid lg:grid-cols-3 gap-4"><div className="lg:col-span-2 space-y-4">
        <div className="card p-6 text-center border-dashed" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); add([...e.dataTransfer.files]); }}>
          <Upload className="mx-auto text-electric mb-2" /><p className="mb-3 text-sm">Glissez vos PDF ici ou</p>
          <div className="flex justify-center gap-2">
            <label className="btn-ghost cursor-pointer"><Upload size={16} />Fichiers<input hidden multiple type="file" accept="application/pdf" onChange={(e) => add([...e.target.files])} /></label>
            <label className="btn-ghost cursor-pointer"><FolderOpen size={16} />Dossier<input hidden type="file" webkitdirectory="" multiple onChange={(e) => add([...e.target.files])} /></label>
          </div>{busy && <p className="text-sm mt-2">Analyse en cours…</p>}
        </div>
        {invalid.length > 0 && <div className="bg-amber-50 text-amber-900 text-sm rounded-lg p-3">{invalid.map((x) => <div key={x}>{x}</div>)}</div>}
        {files.length > 0 && <div className="card overflow-x-auto"><div className="p-3 flex justify-between text-sm"><b>{files.length} fichiers · {pages} pages</b>
          <button className="text-red-600" onClick={() => setFiles([])}>Tout retirer</button></div>
          <table className="w-full text-sm"><tbody>{files.map((f) => <tr key={f.name} className="border-t border-line [&>td]:p-3"><td>{f.name}</td><td>{(f.size / 1048576).toFixed(1)} Mo</td><td>{f.pages} p.</td>
            <td><button onClick={() => setFiles(files.filter((x) => x !== f))}><X size={16} /></button></td></tr>)}</tbody></table></div>}
        {job && <div className="card p-4 space-y-2"><div className="flex justify-between items-center"><b>Travail #{job.id}</b><Status s={job.status} /></div>
          <div className="h-2 bg-soft rounded"><div className="h-2 bg-electric rounded" style={{ width: `${(100 * done) / job.items.length}%` }} /></div>
          {job.items.map((i) => <div key={i.id} className="flex justify-between text-sm"><span>{i.name}{i.error && <em className="text-red-600"> — {i.error}</em>}</span><Status s={i.status} /></div>)}
          <div className="flex gap-2 pt-2"><button className="btn-ghost" onClick={() => act("cancel")}><Ban size={16} />Annuler l&apos;attente</button>
            <button className="btn-ghost" onClick={() => act("retry")}><RotateCcw size={16} />Relancer les échecs</button></div></div>}
      </div>
      <div className="card p-4 space-y-3 h-fit"><h3 className="font-semibold">Paramètres</h3>
        {printers.length > 0 ? (
          <select className="input" value={s.printer} onChange={(e) => set("printer", e.target.value)}>
            {printers.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        ) : (
          <input className="input" placeholder="Recherche imprimantes locales..." value={s.printer} onChange={(e) => set("printer", e.target.value)} />
        )}
        <select className="input" value={s.paper} onChange={(e) => set("paper", e.target.value)}>{["A4", "A3", "Letter", "Legal"].map((p) => <option key={p}>{p}</option>)}</select>
        <select className="input" value={s.orientation} onChange={(e) => set("orientation", e.target.value)}><option value="portrait">Portrait</option><option value="landscape">Paysage</option></select>
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={s.color} onChange={(e) => set("color", e.target.checked)} />Couleur</label>
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={s.duplex} onChange={(e) => set("duplex", e.target.checked)} />Recto-verso</label>
        <label className="text-sm">Copies<input type="number" min="1" max="99" className="input mt-1" value={s.copies} onChange={(e) => set("copies", Math.max(1, +e.target.value || 1))} /></label>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button className="btn-primary w-full" disabled={!files.length || !s.printer.trim()} onClick={start}><Printer size={16} />Imprimer tous les PDF</button>
        <p className="text-xs text-slate-500">L&apos;agent local doit être lancé sur le PC relié à l&apos;imprimante.</p></div></div></div>
  );
}
