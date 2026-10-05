import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Printer, ArrowRight } from "lucide-react";
import { useAuth } from "../auth";
import { errMsg } from "../api";
export default function Login() {
  const { login } = useAuth(); const nav = useNavigate();
  const [email, setEmail] = useState(""); const [pw, setPw] = useState(""); const [show, setShow] = useState(false);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setErr("");
    if (!/^\S+@\S+\.\S+$/.test(email)) return setErr("Adresse e-mail invalide");
    if (pw.length < 6) return setErr("Mot de passe trop court");
    setBusy(true);
    try { await login(email, pw); nav("/"); } catch (x) { setErr(errMsg(x)); } finally { setBusy(false); }
  };
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-center p-16 bg-soft">
        <h1 className="text-4xl font-bold mb-3">Imprimez plus malin.<br />Gagnez du temps.</h1>
        <p className="text-slate-600 max-w-md">Imprimez tous les PDF d&apos;un dossier en un clic, avec suivi en temps réel.</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-4">
          <div className="flex items-center gap-2 mb-4"><div className="w-10 h-10 rounded-lg bg-electric grid place-items-center text-white"><Printer size={20} /></div><span className="font-bold text-xl">PrintFlow</span></div>
          <h2 className="text-2xl font-semibold">Bon retour</h2>
          <label className="block text-sm font-medium">Adresse e-mail
            <input className="input mt-1" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nom@entreprise.com" /></label>
          <label className="block text-sm font-medium">Mot de passe
            <div className="relative mt-1"><input className="input pr-10" type={show ? "text" : "password"} value={pw} onChange={(e) => setPw(e.target.value)} />
              <button type="button" className="absolute right-3 top-3 text-slate-500" onClick={() => setShow(!show)}>{show ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>
          {err && <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-lg p-2">{err}</p>}
          <button className="btn-primary w-full" disabled={busy}>{busy ? "Connexion…" : "Se connecter"}<ArrowRight size={16} /></button>
        </form>
      </div>
    </div>
  );
}
