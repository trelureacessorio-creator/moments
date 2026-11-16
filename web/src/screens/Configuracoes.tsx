import { useState, useEffect } from "react";
import { useStore, list, updateRecord, pull, doLogout } from "../lib/store";
import { api } from "../lib/api";
import { getTheme, applyTheme, type Theme } from "../lib/theme";
import { pushSupported, isStandalone, pushStatus, enablePush, disablePush, type PushState } from "../lib/push";

const TIMEZONES = [
  "America/Sao_Paulo", "America/Bahia", "America/Fortaleza", "America/Recife",
  "America/Belem", "America/Manaus", "America/Cuiaba", "America/Porto_Velho", "America/Rio_Branco",
];

type Sess = { id: string; deviceName: string | null; userAgent: string | null; createdAt: string; lastUsedAt: string };

function shortAgent(ua: string | null): string {
  if (!ua) return "Dispositivo";
  if (/iphone/i.test(ua)) return "iPhone";
  if (/ipad/i.test(ua)) return "iPad";
  if (/android/i.test(ua)) return "Android";
  if (/windows/i.test(ua)) return "Windows";
  if (/mac/i.test(ua)) return "Mac";
  if (/linux/i.test(ua)) return "Linux";
  return "Navegador";
}
function fmtDate(iso: string): string {
  try { return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); }
  catch { return ""; }
}

export function Configuracoes({ onBack }: { onBack: () => void }) {
  const s = useStore();
  const pref: any = list(s.data, "preferences")[0];
  const [sessions, setSessions] = useState<Sess[] | null>(null);
  const [newPriority, setNewPriority] = useState("");
  const [theme, setTheme] = useState<Theme>(getTheme());
  const [pushSt, setPushSt] = useState<PushState | "loading">("loading");
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMsg, setPushMsg] = useState<string | null>(null);
  const isIOS = typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);

  function chooseTheme(t: Theme) { setTheme(t); applyTheme(t); }

  useEffect(() => { pushStatus().then(setPushSt); }, []);

  async function togglePush() {
    setPushBusy(true); setPushMsg(null);
    try {
      if (pushSt === "on") {
        await disablePush();
        setPushSt("off");
      } else {
        const r = await enablePush();
        if (r === "on") { setPushSt("on"); setPushMsg("Lembretes ativados neste aparelho. ✓"); }
        else if (r === "denied") setPushMsg("Permissão negada. Ative as notificações do Moments nas configurações do aparelho.");
        else if (r === "unsupported") setPushMsg("Este navegador não suporta lembretes.");
        else setPushMsg("Não foi possível ativar agora. Tente de novo.");
      }
    } finally {
      setPushBusy(false);
    }
  }

  useEffect(() => { if (!pref) pull().catch(() => {}); }, [pref]);
  useEffect(() => { api.sessions().then((r) => setSessions(r.sessions)).catch(() => setSessions([])); }, []);

  function set(field: string, value: any) {
    if (!pref) return;
    updateRecord("preferences", pref.id, { [field]: value });
  }

  const priorities: string[] = pref?.priorities || [];
  function addPriority() {
    const v = newPriority.trim();
    if (!v || priorities.includes(v)) { setNewPriority(""); return; }
    set("priorities", [...priorities, v]);
    setNewPriority("");
  }
  function removePriority(p: string) {
    set("priorities", priorities.filter((x) => x !== p));
  }

  async function endSession(id: string) {
    await api.deleteSession(id).catch(() => {});
    setSessions((prev) => (prev ? prev.filter((x) => x.id !== id) : prev));
  }

  const notifOn = pref?.notifOn !== false;

  return (
    <>
      <button className="back" onClick={onBack}>‹ Mais</button>
      <div className="hero"><h1 className="scr-title">Configurações</h1><p className="scr-sub">Seu perfil, avisos e dispositivos.</p></div>

      {/* Perfil */}
      <section>
        <div className="card pad">
          <div className="cfg-h">Perfil</div>
          <div className="cfg-row"><span className="cfg-lbl">Nome</span><span className="cfg-val">{s.user?.name}</span></div>
          <div className="cfg-row"><span className="cfg-lbl">E-mail</span><span className="cfg-val">{s.user?.email}</span></div>
        </div>
      </section>

      {/* Lembretes no celular (push) */}
      <section>
        <div className="card pad">
          <div className="cfg-h">Lembretes no celular</div>
          {pushSt === "unsupported" ? (
            <p className="cfg-note">Este navegador não suporta lembretes no aparelho.</p>
          ) : isIOS && !isStandalone() ? (
            <>
              <p className="cfg-note">Para receber lembretes no iPhone, primeiro adicione o Moments à Tela de Início:</p>
              <ol className="cfg-steps">
                <li>Toque no botão <b>Compartilhar</b> (quadrado com seta) do Safari.</li>
                <li>Escolha <b>“Adicionar à Tela de Início”</b>.</li>
                <li>Abra o Moments pelo ícone criado e volte aqui para <b>Ativar</b>.</li>
              </ol>
            </>
          ) : (
            <>
              <p className="cfg-note">Receba avisos (resumo do dia, metas, mudanças compartilhadas) mesmo com o app fechado.</p>
              <button className="btn" style={{ marginTop: 10, width: "100%" }} onClick={togglePush} disabled={pushBusy || pushSt === "loading"}>
                {pushBusy ? "…" : pushSt === "on" ? "Desativar lembretes neste aparelho" : "Ativar lembretes neste aparelho"}
              </button>
              {pushSt === "denied" && <p className="cfg-note">As notificações estão bloqueadas. Permita o Moments nas configurações do navegador/aparelho.</p>}
            </>
          )}
          {pushMsg && <p className="cfg-note">{pushMsg}</p>}
        </div>
      </section>

      {/* Aparência */}
      <section>
        <div className="card pad">
          <div className="cfg-h">Aparência</div>
          <div className="seg">
            {([["light", "Claro"], ["dark", "Escuro"], ["system", "Sistema"]] as [Theme, string][]).map(([v, lbl]) => (
              <button key={v} className={"seg-btn" + (theme === v ? " on" : "")} onClick={() => chooseTheme(v)}>{lbl}</button>
            ))}
          </div>
          <p className="cfg-note">“Sistema” acompanha o tema do seu aparelho automaticamente.</p>
        </div>
      </section>

      {/* Avisos / notificações */}
      <section>
        <div className="card pad">
          <div className="cfg-h">Avisos</div>
          <label className="cfg-row">
            <span className="cfg-lbl">Receber lembretes</span>
            <input type="checkbox" className="sw" checked={notifOn} disabled={!pref} onChange={(e) => set("notifOn", e.target.checked)} />
          </label>
          <div className="cfg-row"><span className="cfg-lbl">Resumo da manhã</span>
            <input type="time" value={pref?.morning || "07:00"} disabled={!pref || !notifOn} onChange={(e) => set("morning", e.target.value)} />
          </div>
          <div className="cfg-row"><span className="cfg-lbl">Resumo da noite</span>
            <input type="time" value={pref?.night || "20:00"} disabled={!pref || !notifOn} onChange={(e) => set("night", e.target.value)} />
          </div>
          <div className="cfg-row"><span className="cfg-lbl">Planejar domingo</span>
            <input type="time" value={pref?.sunday || "18:00"} disabled={!pref || !notifOn} onChange={(e) => set("sunday", e.target.value)} />
          </div>
          <div className="cfg-row"><span className="cfg-lbl">Fuso horário</span>
            <select value={pref?.timezone || "America/Sao_Paulo"} disabled={!pref} onChange={(e) => set("timezone", e.target.value)}>
              {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz.replace("America/", "").replace("_", " ")}</option>)}
            </select>
          </div>
          {!pref && <div className="cfg-note">Carregando suas preferências…</div>}
        </div>
      </section>

      {/* Prioridades da vida */}
      <section>
        <div className="card pad">
          <div className="cfg-h">Minhas prioridades</div>
          <p className="cfg-note">O Moments usa isso para dar foco às suas sugestões.</p>
          <div className="chips" style={{ marginTop: 6 }}>
            {priorities.length === 0 && <span className="cfg-note">Nenhuma ainda.</span>}
            {priorities.map((p) => (
              <button className="chip" key={p} onClick={() => removePriority(p)} title="Remover">{p} ✕</button>
            ))}
          </div>
          <form className="addrow" style={{ marginTop: 8 }} onSubmit={(e) => { e.preventDefault(); addPriority(); }}>
            <input placeholder="Ex.: Família, Saúde, Estudos…" value={newPriority} disabled={!pref} onChange={(e) => setNewPriority(e.target.value)} />
            <button type="submit" aria-label="Adicionar" disabled={!pref}>+</button>
          </form>
        </div>
      </section>

      {/* Dispositivos conectados */}
      <section>
        <div className="card pad">
          <div className="cfg-h">Dispositivos conectados</div>
          {sessions === null ? (
            <div className="cfg-note">Carregando…</div>
          ) : sessions.length === 0 ? (
            <div className="cfg-note">Nenhuma sessão ativa encontrada.</div>
          ) : (
            sessions.map((ss) => (
              <div className="cfg-row" key={ss.id}>
                <span className="cfg-lbl">{ss.deviceName || shortAgent(ss.userAgent)}<br /><small className="cfg-note">ativo em {fmtDate(ss.lastUsedAt)}</small></span>
                <button className="chip-btn" onClick={() => endSession(ss.id)}>encerrar</button>
              </div>
            ))
          )}
          <p className="cfg-note">Encerrar um dispositivo desconecta aquela sessão. Se for a atual, você será deslogado.</p>
        </div>
      </section>

      <section>
        <button className="btn ghost" style={{ width: "100%" }} onClick={() => doLogout()}>Sair da conta</button>
        <p className="cfg-note" style={{ textAlign: "center", marginTop: 10 }}>Moments — seus momentos, organizados com você.</p>
      </section>
    </>
  );
}
