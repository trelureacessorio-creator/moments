import { useState } from "react";
import { useStore, list, createRecord } from "../lib/store";
import { TODAY, sod } from "../lib/dates";

const MOL = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function nextBirthday(bd?: string): Date | null {
  if (!bd) return null;
  const [mm, dd] = bd.split("-").map(Number);
  if (!mm || !dd) return null;
  let d = new Date(TODAY.getFullYear(), mm - 1, dd);
  if (sod(d) < TODAY) d = new Date(TODAY.getFullYear() + 1, mm - 1, dd);
  return d;
}

export function Pessoas({ onBack }: { onBack: () => void }) {
  const s = useStore();
  const [name, setName] = useState("");
  const [relation, setRelation] = useState("");
  const [bd, setBd] = useState("");

  const people = list(s.data, "people").filter((p) => !p.deletedAt).sort((a, b) => {
    const na = nextBirthday(a.birthday), nb = nextBirthday(b.birthday);
    if (!na && !nb) return 0; if (!na) return 1; if (!nb) return -1; return na.getTime() - nb.getTime();
  });

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    let birthday = "";
    const m = bd.match(/(\d{1,2})\s*\/\s*(\d{1,2})/);
    if (m) birthday = `${String(+m[2]).padStart(2, "0")}-${String(+m[1]).padStart(2, "0")}`;
    await createRecord("people", { name: name.trim(), relation: relation.trim() || null, birthday: birthday || null });
    setName(""); setRelation(""); setBd("");
  }

  return (
    <>
      <button className="back" onClick={onBack}>‹ Mais</button>
      <div className="hero"><h1 className="scr-title">Pessoas Importantes</h1><p className="scr-sub">Guarde quem importa e lembre das datas especiais.</p></div>
      <section>
        <div className="card">
          {people.length === 0 ? <div className="empty">Nenhuma pessoa ainda.</div> : people.map((p) => {
            const nb = nextBirthday(p.birthday);
            const days = nb ? Math.round((sod(nb).getTime() - TODAY.getTime()) / 864e5) : null;
            return (
              <div className="habit" key={p.id}>
                <div className="habit-top">
                  <span className="avatar">{(p.name || "?").charAt(0).toUpperCase()}</span>
                  <div className="r-main"><div className="r-title">{p.name}</div>{p.relation && <div className="r-sub">{p.relation}</div>}</div>
                  {days != null && days <= 30 && <span className="streak" style={{ color: "var(--accent)" }}>{days}d</span>}
                </div>
                {(p.birthday || p.phone) && (
                  <div className="plines">
                    {p.birthday && <span>🎂 {Number(p.birthday.split("-")[1])} de {MOL[Number(p.birthday.split("-")[0]) - 1]}{days === 0 ? " · é hoje!" : ""}</span>}
                    {p.phone && <span>📞 {p.phone}</span>}
                  </div>
                )}
              </div>
            );
          })}
          <form className="addrow" style={{ flexWrap: "wrap" }} onSubmit={add}>
            <input placeholder="Nome…" value={name} onChange={(e) => setName(e.target.value)} style={{ flex: "1 1 100%" }} />
            <input placeholder="relação" value={relation} onChange={(e) => setRelation(e.target.value)} style={{ flex: 1 }} />
            <input placeholder="aniv. DD/MM" value={bd} onChange={(e) => setBd(e.target.value)} style={{ flex: "none", width: 100 }} />
            <button type="submit" aria-label="Adicionar">+</button>
          </form>
        </div>
      </section>
    </>
  );
}
