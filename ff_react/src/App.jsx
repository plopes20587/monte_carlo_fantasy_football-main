import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend,
} from "recharts";

/* ---------- helpers ---------- */
const fmt = (v) => {
  if (v === null || v === undefined || v === "" || v === "NaN") return "-";
  if (typeof v === "number") return Number.isInteger(v) ? v : v.toFixed(1);
  const n = Number(v);
  if (!Number.isNaN(n)) return Number.isInteger(n) ? n : n.toFixed(1);
  return String(v);
};

function parseHalfPPR(jsonStr) {
  if (!jsonStr || typeof jsonStr !== "string") return null;
  let arr;
  try {
    arr = JSON.parse(jsonStr);
    if (!Array.isArray(arr)) return null;
  } catch {
    return null;
  }
  let bins = arr
    .map((b) => ({ pts: Number(b.pts), pct: Number(b.pct) }))
    .filter((b) => Number.isFinite(b.pts) && Number.isFinite(b.pct))
    .sort((a, b) => a.pts - b.pts);
  if (bins.length === 0) return null;

  const nonDecreasing = bins.every((b, i) => i === 0 || b.pct >= bins[i - 1].pct);
  let data = [];
  if (nonDecreasing) {
    const scale = bins[bins.length - 1].pct <= 1 ? 100 : 1;
    data = bins.map((b) => ({ x: b.pts, y: Math.max(0, Math.min(100, b.pct * scale)) }));
  } else {
    const total = bins.reduce((s, b) => s + b.pct, 0);
    const scale = total <= 1 ? 100 : 1;
    let cum = 0;
    for (const b of bins) {
      cum += b.pct * scale;
      data.push({ x: b.pts, y: Math.max(0, Math.min(100, cum)) });
    }
  }
  return data;
}

function mergeSeries(seriesA, seriesB, keyA = "A", keyB = "B") {
  if (!seriesA && !seriesB) return [];
  const xs = new Set();
  (seriesA || []).forEach((d) => xs.add(d.x));
  (seriesB || []).forEach((d) => xs.add(d.x));
  const xVals = Array.from(xs).sort((a, b) => a - b);

  const stepAt = (series, x) => {
    if (!series || series.length === 0) return null;
    let y = null;
    for (const d of series) {
      if (d.x <= x) y = d.y; else break;
    }
    return y;
  };

  return xVals.map((x) => ({
    x,
    [keyA]: stepAt(seriesA, x),
    [keyB]: stepAt(seriesB, x),
  }));
}

/* ---------- main component ---------- */
export default function App() {
  const [players, setPlayers] = useState([]);
  const [projections, setProjections] = useState([]);
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const [pRes, prRes] = await Promise.all([
          fetch("/api/players"),
          fetch("/api/projections"),
        ]);
        if (!pRes.ok || !prRes.ok) {
          throw new Error(`HTTP players:${pRes.status} projections:${prRes.status}`);
        }
        const [ps, projs] = await Promise.all([pRes.json(), prRes.json()]);
        setPlayers(Array.isArray(ps) ? ps : []);
        setProjections(Array.isArray(projs) ? projs : []);
      } catch (e) {
        setErr(e.message || String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const byId = useMemo(() => new Map(projections.map((p) => [p.id, p])), [projections]);
  const A = a ? byId.get(a) : undefined;
  const B = b ? byId.get(b) : undefined;

  const label = (id) => {
    const meta = players.find((x) => x.id === id);
    if (!meta) return id || "";
    const affix = [meta.team, meta.position].filter(Boolean).join(" ");
    return affix ? `${meta.name} (${affix})` : meta.name;
  };

  const allKeys = useMemo(() => {
    const s = new Set();
    for (const row of projections) {
      Object.keys(row).forEach((k) => { if (k !== "id") s.add(k); });
    }
    const preferred = ["ppr", "median", "ceiling", "pass_tds"];
    const presentPreferred = preferred.filter((k) => s.has(k));
    const rest = [...s]
      .filter((k) => !presentPreferred.includes(k) && !k.startsWith("chart_source_"))
      .sort();
    return [...presentPreferred, ...rest];
  }, [projections]);

  const aSeries = useMemo(
    () => (A && A.chart_source_half_ppr ? parseHalfPPR(A.chart_source_half_ppr) : null),
    [A]
  );
  const bSeries = useMemo(
    () => (B && B.chart_source_half_ppr ? parseHalfPPR(B.chart_source_half_ppr) : null),
    [B]
  );
  const chartData = useMemo(
    () => (aSeries || bSeries ? mergeSeries(aSeries, bSeries, "A", "B") : []),
    [aSeries, bSeries]
  );

  if (loading) {
    return <div style={{ maxWidth: 1100, margin: "40px auto", padding: 16 }}>Loading…</div>;
  }
  if (err) {
    return (
      <div style={{ maxWidth: 1100, margin: "40px auto", padding: 16, color: "crimson" }}>
        Error: {err}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: "40px auto", padding: 16 }}>
      <h1>NFL Player Compare</h1>

      {/* Selectors */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
        <select value={a} onChange={(e) => setA(e.target.value)}>
          <option value="">Select Player A</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}{p.team ? ` (${p.team}` : ""}{p.position ? ` ${p.position}` : ""}{p.team ? ")" : ""}
            </option>
          ))}
        </select>

        <select value={b} onChange={(e) => setB(e.target.value)}>
          <option value="">Select Player B</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}{p.team ? ` (${p.team}` : ""}{p.position ? ` ${p.position}` : ""}{p.team ? ")" : ""}
            </option>
          ))}
        </select>
      </div>

      {/* Main content */}
      <div style={{ marginTop: 20 }}>
        {!A || !B ? (
          <div>Select two players.</div>
        ) : (
          <div
            className="two-col"
            style={{
              display: "grid",
              gridTemplateColumns: "1.2fr 1fr",
              gap: 16,
              alignItems: "start",
              marginTop: 8,
            }}
          >
            {/* LEFT: table card */}
            <div
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                padding: 16,
                boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                background: "#000",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.1fr 1fr 1fr",
                  gap: 10,
                  alignItems: "center",
                }}
              >
                <div></div>
                <strong>{label(A.id)}</strong>
                <strong>{label(B.id)}</strong>

                {allKeys.map((k) => (
                  <FragmentRow key={k} title={k} a={A[k]} b={B[k]} />
                ))}
              </div>
            </div>

            {/* RIGHT: chart card */}
            <div
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                padding: 16,
                boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                background: "#fff",
                minHeight: 340,
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Half-PPR Distribution</div>

              {!aSeries && !bSeries ? (
                <div style={{ opacity: 0.7 }}>No half-PPR histogram available for either player.</div>
              ) : (
                <div style={{ width: "100%", height: 300 }}>
                  <ResponsiveContainer>
                    <LineChart data={chartData} margin={{ top: 10, right: 20, left: 20, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="x"
                        label={{ value: "Half-PPR Points", position: "insideBottom", offset: -5 }}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tickFormatter={(v) => `${v}%`}
                        label={{ value: "Cumulative %", angle: -90, position: "insideLeft" }}
                      />
                      <Tooltip
                        formatter={(value) => (value == null ? "-" : `${Number(value).toFixed(1)}%`)}
                        labelFormatter={(v) => `Pts: ${v}`}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="A" name={label(A.id)} dot={false} />
                      <Line type="monotone" dataKey="B" name={label(B.id)} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- row component ---------- */
function FragmentRow({ title, a, b }) {
  return (
    <>
      <div style={{ textTransform: "capitalize" }}>{title.replace(/_/g, " ")}</div>
      <div>{fmt(a)}</div>
      <div>{fmt(b)}</div>
    </>
  );
}

FragmentRow.propTypes = {
  title: PropTypes.string.isRequired,
  a: PropTypes.oneOfType([PropTypes.number, PropTypes.string, PropTypes.oneOf([null])]),
  b: PropTypes.oneOfType([PropTypes.number, PropTypes.string, PropTypes.oneOf([null])]),
};
