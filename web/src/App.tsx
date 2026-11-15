import { useState } from "react";
import { useStore, doLogout, pull } from "./lib/store";
import { Auth } from "./screens/Auth";
import { MeuDia } from "./screens/MeuDia";
import { Tarefas } from "./screens/Tarefas";
import { Calendario } from "./screens/Calendario";
import { Notificacoes } from "./screens/Notificacoes";

type Tab = "meudia" | "calendario" | "tarefas" | "notificacoes";

const NAV: { id: Tab; ic: string; label: string }[] = [
  { id: "meudia", ic: "◉", label: "Meu Dia" },
  { id: "calendario", ic: "▦", label: "Calendário" },
  { id: "tarefas", ic: "✓", label: "Tarefas" },
  { id: "notificacoes", ic: "◔", label: "Avisos" },
];

export function App() {
  const s = useStore();
  const [tab, setTab] = useState<Tab>("meudia");

  if (!s.ready) return <div className="loading">Carregando…</div>;
  if (!s.user) return <Auth />;

  return (
    <div className="app">
      <header>
        <div className="bar gutter">
          <div className="brand"><span className="dot" />Moments</div>
          <div className="bar-right">
            {s.syncing && <span className="syncdot">sincronizando…</span>}
            <button className="chip-btn" onClick={() => pull()}>Atualizar</button>
            <button className="chip-btn" onClick={() => doLogout()}>Sair</button>
          </div>
        </div>
        {s.error && <div className="sync-err">Não foi possível sincronizar agora. Suas mudanças ficam salvas e tentaremos de novo.</div>}
      </header>

      <main>
        {tab === "meudia" && <MeuDia />}
        {tab === "calendario" && <Calendario />}
        {tab === "tarefas" && <Tarefas />}
        {tab === "notificacoes" && <Notificacoes />}
      </main>

      <nav>
        <div className="nav-row">
          {NAV.map((n) => (
            <button key={n.id} className={"nav-item" + (tab === n.id ? " on" : "")} onClick={() => setTab(n.id)}>
              <span className="n-ic">{n.ic}</span>
              {n.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
