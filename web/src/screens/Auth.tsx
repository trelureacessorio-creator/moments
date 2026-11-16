import { useState } from "react";
import { doLogin, doRegister } from "../lib/store";
import { PoliticaConteudo } from "./Privacidade";

export function Auth() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [showPolicy, setShowPolicy] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "register") await doRegister(email.trim().toLowerCase(), name.trim(), password);
      else await doLogin(email.trim().toLowerCase(), password);
    } catch (err: any) {
      const code = err?.body?.error || err?.message;
      setError(
        code === "invalid_credentials" ? "E-mail ou senha incorretos." :
        code === "email_in_use" ? "Este e-mail já tem conta." :
        code === "validation" ? "Verifique os dados (senha com ao menos 8 caracteres)." :
        "Não foi possível conectar. A API está rodando?"
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-brand"><span className="dot" />Moments</div>
      <div className="auth-tag">Guarde seus momentos. Organize sua vida.</div>

      {error && <div className="err">{error}</div>}

      <form onSubmit={submit}>
        {mode === "register" && (
          <div className="field">
            <label htmlFor="name">Nome</label>
            <input id="name" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
          </div>
        )}
        <div className="field">
          <label htmlFor="email">E-mail</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </div>
        <div className="field">
          <label htmlFor="password">Senha</label>
          <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete={mode === "register" ? "new-password" : "current-password"} />
        </div>
        <button className="btn" type="submit" disabled={busy}>
          {busy ? "Entrando…" : mode === "register" ? "Criar conta" : "Entrar"}
        </button>
      </form>

      {mode === "register" && (
        <p className="auth-policy">Ao criar a conta, você concorda com a{" "}
          <button type="button" className="linklike" onClick={() => setShowPolicy(true)}>Política de Privacidade</button>.
        </p>
      )}

      {showPolicy && (
        <div className="overlay" onClick={() => setShowPolicy(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head"><h3>🔒 Política de Privacidade</h3><button className="chip-btn" onClick={() => setShowPolicy(false)}>Fechar</button></div>
            <PoliticaConteudo />
          </div>
        </div>
      )}

      <div className="auth-switch">
        {mode === "login" ? (
          <>Ainda não tem conta? <button type="button" onClick={() => { setMode("register"); setError(null); }}>Criar conta</button></>
        ) : (
          <>Já tem conta? <button type="button" onClick={() => { setMode("login"); setError(null); }}>Entrar</button></>
        )}
      </div>
    </div>
  );
}
