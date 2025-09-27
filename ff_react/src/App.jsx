import { useEffect, useMemo, useState } from "react";

export default function App() {
  const [players, setPlayers] = useState([]);
  const [projections, setProjections] = useState([]);
  const [a, setA] = useState("");
  const [b, setB] = useState("");

  useEffect(() => {
    Promise.all([fetch("/players.json"), fetch("/projections.json")])
      .then(([p, pr]) => Promise.all([p.json(), pr.json()]))
      .then(([ps, projs]) => {
        setPlayers(ps || []);
        setProjections(projs || []);
      })
      .catch((err) => console.error(err));
  }, []);

  const byId = useMemo(
    () => new Map(projections.map((p) => [p.id, p])),
    [projections]
  );
  const A = a ? byId.get(a) : undefined;
  const B = b ? byId.get(b) : undefined;

  return (
    <div style={{ maxWidth: 800, margin: "40px auto", padding: 16 }}>
      <h1>NFL Player Compare (Local)</h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <select value={a} onChange={(e) => setA(e.target.value)}>
          <option value="">Select Player A</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.team} {p.position})
            </option>
          ))}
        </select>

        <select value={b} onChange={(e) => setB(e.target.value)}>
          <option value="">Select Player B</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.team} {p.position})
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginTop: 20 }}>
        {!A || !B ? (
          <div>Select two players.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <div></div>
            <strong>{players.find((p) => p.id === a)?.name}</strong>
            <strong>{players.find((p) => p.id === b)?.name}</strong>

            <div>Projected PPR</div><div>{A.ppr ?? "-"}</div><div>{B.ppr ?? "-"}</div>
            <div>Median</div><div>{A.median ?? "-"}</div><div>{B.median ?? "-"}</div>
            <div>Ceiling</div><div>{A.ceiling ?? "-"}</div><div>{B.ceiling ?? "-"}</div>
            <div>Floor</div><div>{A.floor ?? "-"}</div><div>{B.floor ?? "-"}</div>
          </div>
        )}
      </div>
    </div>
  );
}
