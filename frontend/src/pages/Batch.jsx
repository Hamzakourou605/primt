import { useEffect, useState } from "react";
import { FolderOpen, Upload, Printer, X, Ban, RotateCcw, RefreshCw, CheckCircle2, Laptop, Sliders } from "lucide-react";
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
  const [files, setFiles] = useState([]);
  const [invalid, setInvalid] = useState([]);
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [printers, setPrinters] = useState([]);
  const [detectedCount, setDetectedCount] = useState(0);
  const [customPrinter, setCustomPrinter] = useState(false);
  const [s, setS] = useState({
    printer: "",
    copies: 1,
    paper: "A4",
    orientation: "portrait",
    color: false,
    duplex: false
  });
  const [job, setJob] = useState(null);
  const [err, setErr] = useState("");

  const loadPrinters = async () => {
    setScanning(true);
    try {
      const res = await api.get("/printers");
      const list = res.data?.printers || [];
      setPrinters(list);
      setDetectedCount(res.data?.detected_count || 0);
      const def = res.data?.default || list[0] || "Microsoft Print to PDF";
      if (!s.printer || !list.includes(s.printer)) {
        setS((prev) => ({ ...prev, printer: def }));
      }
    } catch (e) {
      console.error("Erreur de détection des imprimantes", e);
      if (!printers.length) {
        const fallbacks = [
          "Microsoft Print to PDF",
          "Imprimante par défaut Windows",
          "HP LaserJet / DeskJet",
          "Canon PIXMA",
          "Brother HL Series"
        ];
        setPrinters(fallbacks);
        setS((prev) => ({ ...prev, printer: fallbacks[0] }));
      }
    } finally {
      setScanning(false);
    }
  };

  useEffect(() => {
    loadPrinters();
  }, []);

  const add = async (list) => {
    setBusy(true);
    const ok = [...files];
    const bad = [];
    for (const f of list) {
      if (!f.name.toLowerCase().endsWith(".pdf")) {
        bad.push(`${f.name} : pas un PDF`);
        continue;
      }
      if (f.size > MAX) {
        bad.push(`${f.name} : taille supérieure à 50 Mo`);
        continue;
      }
      if (ok.some((x) => x.name === f.name)) {
        bad.push(`${f.name} : doublon ignoré`);
        continue;
      }
      try {
        ok.push({ name: f.name, size: f.size, pages: await analyse(f), rawFile: f });
      } catch (e) {
        bad.push(`${f.name} : ${e.message}`);
      }
    }
    setFiles(ok);
    setInvalid(bad);
    setBusy(false);
  };

  const start = async () => {
    setErr("");
    try {
      const payload = {
        ...s,
        items: files.map(({ name, pages, size }) => ({ name, pages, size }))
      };
      const { data } = await api.post("/jobs", payload);
      setJob(data);
      setFiles([]);
    } catch (e) {
      setErr(errMsg(e));
    }
  };

  const handleBrowserPrint = () => {
    window.print();
  };

  useEffect(() => {
    if (!job || FINAL.includes(job.status)) return;
    const t = setInterval(() => api.get(`/jobs/${job.id}`).then((r) => setJob(r.data)), 2000);
    return () => clearInterval(t);
  }, [job]);

  const act = (a) => api.post(`/jobs/${job.id}/${a}`).then((r) => setJob(r.data));
  const setParam = (k, v) => setS({ ...s, [k]: v });
  const totalPages = files.reduce((a, f) => a + f.pages, 0) * s.copies;
  const doneCount = job ? job.items.filter((i) => FINAL.includes(i.status)).length : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Impression en lot de documents</h1>
          <p className="text-sm text-slate-500 mt-1">
            Détection automatique de vos imprimantes PC & Laptop et gestion par lots
          </p>
        </div>
        <button
          onClick={handleBrowserPrint}
          className="btn-ghost text-xs border border-line flex items-center gap-2"
          title="Ouvre la boîte de dialogue d'impression Windows de votre ordinateur"
        >
          <Laptop size={15} /> Boîte d&apos;impression Windows (Ctrl+P)
        </button>
      </div>

      {/* Carte de Sélection & Détection de l'imprimante */}
      <div className="card p-5 bg-gradient-to-r from-blue-50/50 via-white to-slate-50 border border-blue-100 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
              <Printer size={18} />
            </div>
            <div>
              <span className="font-semibold text-slate-800 text-sm">Choix de l&apos;imprimante connectée</span>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>
                  {detectedCount > 0
                    ? `${detectedCount} imprimante(s) physique(s) détectée(s)`
                    : `${printers.length} imprimantes disponibles`}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={loadPrinters}
            disabled={scanning}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:bg-blue-50 transition"
          >
            <RefreshCw size={13} className={scanning ? "animate-spin" : ""} />
            {scanning ? "Détection en cours…" : "Actualiser la détection"}
          </button>
        </div>

        <div className="grid md:grid-cols-3 gap-3 items-center">
          <div className="md:col-span-2">
            {!customPrinter ? (
              <select
                className="input bg-white font-medium text-slate-800"
                value={s.printer}
                onChange={(e) => setParam("printer", e.target.value)}
              >
                {printers.map((p) => (
                  <option key={p} value={p}>
                    🖨️ {p}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="input bg-white"
                placeholder="Entrez le nom ou l'IP de l'imprimante..."
                value={s.printer}
                onChange={(e) => setParam("printer", e.target.value)}
              />
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCustomPrinter(!customPrinter)}
              className="text-xs text-slate-600 hover:text-slate-900 border border-slate-300 rounded px-3 py-2 bg-white flex items-center gap-1.5 w-full justify-center"
            >
              <Sliders size={13} />
              {customPrinter ? "Liste détectée" : "Saisie manuelle"}
            </button>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Colonne gauche : Upload et fichiers */}
        <div className="lg:col-span-2 space-y-4">
          <div
            className="card p-8 text-center border-2 border-dashed border-slate-200 hover:border-blue-400 transition bg-slate-50/50 rounded-xl"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              add([...e.dataTransfer.files]);
            }}
          >
            <div className="w-12 h-12 mx-auto rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mb-3">
              <Upload size={22} />
            </div>
            <h3 className="font-semibold text-slate-800 text-base">Glissez vos fichiers PDF ici</h3>
            <p className="text-xs text-slate-500 mb-4 mt-1">Prend en charge les fichiers individuels et les dossiers entiers</p>
            <div className="flex justify-center gap-3">
              <label className="btn-primary cursor-pointer text-xs py-2 px-4 shadow-sm">
                <Upload size={14} /> Choisir des PDF
                <input hidden multiple type="file" accept="application/pdf" onChange={(e) => add([...e.target.files])} />
              </label>
              <label className="btn-ghost cursor-pointer text-xs py-2 px-4 border border-line bg-white">
                <FolderOpen size={14} /> Importer un dossier
                <input hidden type="file" webkitdirectory="" multiple onChange={(e) => add([...e.target.files])} />
              </label>
            </div>
            {busy && <p className="text-xs text-blue-600 font-medium mt-3">Analyse des pages en cours…</p>}
          </div>

          {invalid.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-lg p-3 space-y-1">
              {invalid.map((x) => (
                <div key={x} className="flex items-center gap-1.5">
                  <span>⚠️</span>
                  <span>{x}</span>
                </div>
              ))}
            </div>
          )}

          {files.length > 0 && (
            <div className="card overflow-hidden shadow-sm">
              <div className="p-3 bg-slate-50 border-b border-line flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-700">
                  {files.length} document(s) sélectionné(s) · {totalPages} page(s) totale(s) avec copies
                </span>
                <button
                  className="text-red-600 hover:text-red-800 font-medium"
                  onClick={() => setFiles([])}
                >
                  Tout effacer
                </button>
              </div>
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-xs">
                  <tbody>
                    {files.map((f) => (
                      <tr key={f.name} className="border-t border-line hover:bg-slate-50/50 [&>td]:p-2.5">
                        <td className="font-medium text-slate-800">{f.name}</td>
                        <td className="text-slate-500">{(f.size / 1048576).toFixed(1)} Mo</td>
                        <td className="text-slate-600 font-semibold">{f.pages} page(s)</td>
                        <td className="text-right">
                          <button
                            className="text-slate-400 hover:text-red-600 p-1"
                            onClick={() => setFiles(files.filter((x) => x !== f))}
                          >
                            <X size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {job && (
            <div className="card p-5 space-y-3 border-blue-200 bg-blue-50/20 shadow-sm">
              <div className="flex justify-between items-center">
                <div>
                  <span className="font-bold text-slate-800 text-sm">Travail en cours #{job.id}</span>
                  <p className="text-xs text-slate-500">Imprimante : {job.printer}</p>
                </div>
                <Status s={job.status} />
              </div>
              <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all duration-300"
                  style={{ width: `${(100 * doneCount) / (job.items?.length || 1)}%` }}
                />
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {job.items?.map((i) => (
                  <div key={i.id} className="flex justify-between items-center text-xs bg-white p-2 rounded border border-line">
                    <span className="truncate max-w-xs text-slate-700">
                      {i.name}
                      {i.error && <em className="text-red-600 ml-1"> — {i.error}</em>}
                    </span>
                    <Status s={i.status} />
                  </div>
                ))}
              </div>
              <div className="flex gap-2 pt-2 border-t border-line">
                <button className="btn-ghost text-xs py-1.5" onClick={() => act("cancel")}>
                  <Ban size={14} /> Annuler l&apos;attente
                </button>
                <button className="btn-ghost text-xs py-1.5" onClick={() => act("retry")}>
                  <RotateCcw size={14} /> Relancer les échecs
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Colonne droite : Paramètres d'impression */}
        <div className="card p-5 space-y-4 h-fit shadow-sm border border-slate-200">
          <div className="border-b border-line pb-2">
            <h3 className="font-semibold text-slate-800 text-sm">Options d&apos;impression</h3>
            <p className="text-xs text-slate-500">Appliquées à tous les PDF du lot</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Format de papier</label>
            <select
              className="input text-xs"
              value={s.paper}
              onChange={(e) => setParam("paper", e.target.value)}
            >
              {["A4", "A3", "Letter", "Legal"].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Orientation</label>
            <select
              className="input text-xs"
              value={s.orientation}
              onChange={(e) => setParam("orientation", e.target.value)}
            >
              <option value="portrait">Portrait</option>
              <option value="landscape">Paysage</option>
            </select>
          </div>

          <div className="space-y-2 pt-1">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                checked={s.color}
                onChange={(e) => setParam("color", e.target.checked)}
              />
              Impression en couleur
            </label>

            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                checked={s.duplex}
                onChange={(e) => setParam("duplex", e.target.checked)}
              />
              Recto-verso automatique
            </label>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Nombre d&apos;exemplaires (Copies)
            </label>
            <input
              type="number"
              min="1"
              max="99"
              className="input text-xs"
              value={s.copies}
              onChange={(e) => setParam("copies", Math.max(1, +e.target.value || 1))}
            />
          </div>

          {err && <p className="text-xs text-red-600 bg-red-50 p-2.5 rounded border border-red-100">{err}</p>}

          <button
            className="btn-primary w-full py-3 text-sm font-semibold flex items-center justify-center gap-2 shadow-md transition disabled:opacity-50"
            disabled={!files.length || !s.printer.trim()}
            onClick={start}
          >
            <Printer size={16} />
            Lancer l&apos;impression ({files.length} doc{files.length > 1 ? "s" : ""})
          </button>

          <div className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded border border-line space-y-1">
            <p className="flex items-center gap-1.5 font-medium text-slate-700">
              <CheckCircle2 size={13} className="text-emerald-600" /> Imprimante ciblée :
            </p>
            <p className="truncate text-slate-600">{s.printer || "Aucune sélectionnée"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
