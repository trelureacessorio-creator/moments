const ITEMS: { id: string; ic: string; name: string; desc: string }[] = [
  { id: "metas", ic: "◈", name: "Metas", desc: "progresso e ritmo" },
  { id: "habitos", ic: "◷", name: "Hábitos", desc: "sequências diárias" },
  { id: "dinheiro", ic: "◈", name: "Meu Dinheiro", desc: "receitas e gastos" },
  { id: "evolucao", ic: "◴", name: "Minha Evolução", desc: "resumos e conquistas" },
  { id: "familia", ic: "⇄", name: "Planejamento Familiar", desc: "compartilhar com a família" },
  { id: "pessoas", ic: "♥", name: "Pessoas", desc: "contatos importantes" },
  { id: "sonhos", ic: "✦", name: "Sonhos e Ideias", desc: "inspirações" },
  { id: "arquivos", ic: "▤", name: "Arquivos", desc: "documentos e fotos" },
  { id: "tarefas", ic: "✓", name: "Tarefas", desc: "pendentes e concluídas" },
  { id: "notificacoes", ic: "◔", name: "Avisos", desc: "lembretes e alertas" },
  { id: "configuracoes", ic: "⚙", name: "Configurações", desc: "perfil, avisos e dispositivos" },
  { id: "privacidade", ic: "🔒", name: "Privacidade", desc: "como seus dados são tratados" },
];

export function Mais({ go }: { go: (tab: string) => void }) {
  return (
    <>
      <div className="hero"><h1 className="scr-title">Mais</h1><p className="scr-sub">Suas outras áreas no Moments.</p></div>
      <section>
        <div className="more-grid">
          {ITEMS.map((it) => (
            <button className="more-cell" key={it.id} onClick={() => go(it.id)}>
              <span className="m-ic">{it.ic}</span>
              <span className="m-name">{it.name}</span>
              <span className="m-desc">{it.desc}</span>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}
