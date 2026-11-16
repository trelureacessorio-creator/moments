import { useState } from "react";
import { useStore, list, doLogout, pull } from "./lib/store";
import { BellIcon } from "./lib/icons";
import { Auth } from "./screens/Auth";
import { MeuDia } from "./screens/MeuDia";
import { Calendario } from "./screens/Calendario";
import { Conversar } from "./screens/Conversar";
import { Diario } from "./screens/Diario";
import { Mais } from "./screens/Mais";
import { Metas } from "./screens/Metas";
import { Habitos } from "./screens/Habitos";
import { MeuDinheiro } from "./screens/MeuDinheiro";
import { Evolucao } from "./screens/Evolucao";
import { Pessoas } from "./screens/Pessoas";
import { SonhosIdeias } from "./screens/SonhosIdeias";
import { Familia } from "./screens/Familia";
import { Arquivos } from "./screens/Arquivos";
import { Tarefas } from "./screens/Tarefas";
import { Notificacoes } from "./screens/Notificacoes";
import { Configuracoes } from "./screens/Configuracoes";

type Tab = "meudia" | "calendario" | "conversar" | "diario" | "mais" | "metas" | "habitos" | "dinheiro" | "evolucao" | "pessoas" | "sonhos" | "familia" | "arquivos" | "tarefas" | "notificacoes" | "configuracoes";

const NAV: { id: Tab; ic: string; label: string }[] = [
  { id: "meudia", ic: "◉", label: "Meu Dia" },
  { id: "calendario", ic: "▦", label: "Agenda" },
  { id: "conversar", ic: "✦", label: "Conversar" },
  { id: "diario", ic: "✎", label: "Diário" },
  { id: "mais", ic: "⋯", label: "Mais" },
];
const SECONDARY = new Set<Tab>(["metas", "habitos", "dinheiro", "evolucao", "pessoas", "sonhos", "familia", "arquivos", "tarefas", "notificacoes", "configuracoes"]);

export function App() {
  const s = useStore();
  const [tab, setTab] = useState<Tab>("meudia");

  if (!s.ready) return <div className="loading">Carregando…</div>;
  if (!s.user) return <Auth />;

  const activeNav: Tab = SECONDARY.has(tab) ? "mais" : tab;
  const back = () => setTab("mais");

  const unread = list(s.data, "notifications").filter((n) => !n.deletedAt && n.status !== "read" && !n.readAt).length;

  return (
    <div className="app">
      <header>
        <div className="bar gutter">
          <div className="brand">
            <span className="dot" style={s.user?.photoUrl ? { backgroundImage: `url(${s.user.photoUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined} />
            Moments
          </div>
          <div className="bar-right">
            {s.syncing && <span className="syncdot">sincronizando…</span>}
            <button className="bell" onClick={() => setTab("notificacoes")} aria-label={`Avisos${unread ? ` (${unread} não lidos)` : ""}`}>
              <BellIcon />
              {unread > 0 && <span className="bell-badge">{unread > 9 ? "9+" : unread}</span>}
            </button>
            <button className="chip-btn" onClick={() => pull()}>Atualizar</button>
            <button className="chip-btn" onClick={() => doLogout()}>Sair</button>
          </div>
        </div>
        {s.error && <div className="sync-err">Não foi possível sincronizar agora. Suas mudanças ficam salvas e tentaremos de novo.</div>}
      </header>

      <main>
        {tab === "meudia" && <MeuDia />}
        {tab === "calendario" && <Calendario />}
        {tab === "conversar" && <Conversar />}
        {tab === "diario" && <Diario />}
        {tab === "mais" && <Mais go={(t) => setTab(t as Tab)} />}
        {tab === "metas" && <Metas onBack={back} />}
        {tab === "habitos" && <Habitos onBack={back} />}
        {tab === "dinheiro" && <MeuDinheiro onBack={back} />}
        {tab === "evolucao" && <Evolucao onBack={back} />}
        {tab === "pessoas" && <Pessoas onBack={back} />}
        {tab === "sonhos" && <SonhosIdeias onBack={back} />}
        {tab === "familia" && <Familia onBack={back} />}
        {tab === "arquivos" && <Arquivos onBack={back} />}
        {tab === "tarefas" && <Tarefas onBack={back} />}
        {tab === "notificacoes" && <Notificacoes onBack={back} />}
        {tab === "configuracoes" && <Configuracoes onBack={back} />}
      </main>

      <nav>
        <div className="nav-row">
          {NAV.map((n) => (
            <button key={n.id} className={"nav-item" + (activeNav === n.id ? " on" : "")} onClick={() => setTab(n.id)}>
              <span className="n-ic">{n.ic}</span>
              {n.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
