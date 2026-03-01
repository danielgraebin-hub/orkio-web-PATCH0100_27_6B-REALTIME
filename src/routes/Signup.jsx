import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../ui/api.js";

function qp() {
  const p = new URLSearchParams(window.location.search);
  const out = {};
  for (const [k,v] of p.entries()) out[k]=v;
  return out;
}

export default function Signup() {
  const nav = useNavigate();
  const q = useMemo(() => qp(), []);
  const [form, setForm] = useState({
    name: "",
    email: "",
    company: "",
    role: "",
    segment: q.segment || "enterprise",
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const onChange = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e){
    e.preventDefault();
    setErr("");
    setLoading(true);
    try{
      const r = await apiFetch("/api/leads", {
        method: "POST",
        body: {
          name: form.name,
          email: form.email,
          company: form.company,
          role: form.role,
          segment: form.segment,
          source: "qr",
        }
      });
      if(!r?.ok) throw new Error("lead_failed");
      // store lead for chat
      localStorage.setItem("orkio_lead", JSON.stringify({
        lead_id: r.lead_id,
        name: form.name,
        email: form.email,
        company: form.company,
        role: form.role,
        segment: form.segment
      }));
      nav("/?autochat=1");
    }catch(_e){
      setErr("Não foi possível concluir o cadastro. Tenta de novo?");
    }finally{
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#070910] text-white">
      <div className="mx-auto max-w-xl px-4 py-10">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/80">
          <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_6px_rgba(52,211,153,0.15)]" />
          Confidential • International Version
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
          <h1 className="text-2xl font-extrabold tracking-tight">Entre no Orkio</h1>
          <p className="mt-2 text-white/70">
            Leva 20 segundos. Depois, você conversa com o <b>Orkio — o CEO dos CEOs</b>.
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="text-xs text-white/70">Nome</label>
              <input className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 outline-none focus:border-white/20"
                     required value={form.name} onChange={onChange("name")} placeholder="Seu nome"/>
            </div>
            <div>
              <label className="text-xs text-white/70">Email</label>
              <input className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 outline-none focus:border-white/20"
                     required type="email" value={form.email} onChange={onChange("email")} placeholder="seu@email.com"/>
            </div>
            <div>
              <label className="text-xs text-white/70">Empresa</label>
              <input className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 outline-none focus:border-white/20"
                     required value={form.company} onChange={onChange("company")} placeholder="Sua empresa"/>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs text-white/70">Cargo</label>
                <input className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 outline-none focus:border-white/20"
                       value={form.role} onChange={onChange("role")} placeholder="CEO, CTO, Head..."/>
              </div>
              <div>
                <label className="text-xs text-white/70">Segmento</label>
                <select className="mt-1 w-full rounded-xl border border-white/10 bg-[#0b1020] px-3 py-2 outline-none focus:border-white/20"
                        value={form.segment} onChange={onChange("segment")}>
                  <option value="enterprise">Enterprise</option>
                  <option value="fintech">Fintech</option>
                  <option value="legal">Legal</option>
                  <option value="support">Support</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            {err ? <div className="rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">{err}</div> : null}

            <button disabled={loading}
                    className="w-full rounded-xl bg-gradient-to-r from-violet-500 to-emerald-400 px-4 py-2.5 font-extrabold text-black shadow-[0_16px_30px_rgba(124,92,255,0.2)] disabled:opacity-60">
              {loading ? "Enviando..." : "Entrar e falar com Orkio →"}
            </button>

            <button type="button" onClick={() => nav("/")}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 font-semibold text-white/90 hover:bg-white/10">
              Voltar
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
