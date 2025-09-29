import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend } from "recharts";
import "./App.css";

/* ---------- helpers ---------- */
const fmt = (v) => {
  if (v === null || v === undefined || v === "" || v === "NaN") return "-";
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return n % 1 === 0 ? n.toLocaleString() : n.toLocaleString(undefined, { maximumFractionDigits: 1 });
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
    for (const d of series) { if (d.x <= x) y = d.y; else break; }
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
    const rest = [...s].filter((k) => !presentPreferred.includes(k) && !k.startsWith("chart_source_")).sort();
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

  // derive nice [min,max] rounded to /5 and a ticks array every 5 pts
const { xMin, xMax, xTicks } = useMemo(() => {
  if (!chartData.length) return { xMin: 0, xMax: 0, xTicks: [] };
  const xs = chartData.map(d => d.x).filter(n => Number.isFinite(n));
  const min = Math.min(...xs);
  const max = Math.max(...xs);
  const roundDown5 = (n) => Math.floor(n / 5) * 5;
  const roundUp5   = (n) => Math.ceil(n / 5) * 5;
  const lo = roundDown5(min);
  const hi = roundUp5(max);
  const ticks = [];
  for (let t = lo; t <= hi; t += 5) ticks.push(t);
  return { xMin: lo, xMax: hi, xTicks: ticks };
}, [chartData]);


  if (loading) {
    return <div className="page">Loading…</div>;
  }
  if (err) {
    return <div className="page" style={{ color: "crimson" }}>Error: {err}</div>;
  }

  // Static colors for now; we can wire team colors later.
  const strokeA = "#2563eb"; // blue
  const strokeB = "#ef4444"; // red

  return (
    <div className="page">
      <h1 className="title">NFL Player Compare</h1>
{/* Intro / hero */}
<div className="hero">
  <p className="subtitle">
    Compare two NFL players using median, ceiling, and half-PPR outcome distributions.
  </p>

  <ul className="steps">
    <li><span className="step-dot">1</span> Pick <strong>Player A</strong> and <strong>Player B</strong> below.</li>
    <li><span className="step-dot">2</span> Review the <strong>stat table</strong> on the left.</li>
    <li><span className="step-dot">3</span> Use the <strong>distribution chart</strong> to gauge upside and risk.</li>
  </ul>

  <div className="badges">
    <span className="badge">Live data</span>
    <span className="badge">Half-PPR</span>
    <span className="badge">From CSV</span>
  </div>
</div>
      {/* Selectors */}
      <div className="selectors">
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
      <div className="content">
        {!A || !B ? (
          <div className="empty">Select two players.</div>
        ) : (
          <div className="two-col">
            {/* LEFT: table card */}
            <div className="card">
              <div className="compare-grid">
                <div></div>
                <strong>{label(A.id)}</strong>
                <strong>{label(B.id)}</strong>
                {allKeys.map((k) => (
                  <FragmentRow key={k} title={k} a={A[k]} b={B[k]} />
                ))}
              </div>
            </div>

            {/* RIGHT: chart card */}
            <div className="card chart-card">
              <div className="card-title">Half-PPR Distribution</div>
              {!aSeries && !bSeries ? (
                <div className="muted">No half-PPR histogram available for either player.</div>
              ) : (
                <div className="chart-wrap">
                  <ResponsiveContainer>
               <LineChart data={chartData} margin={{ top: 8, right: 24, left: 0, bottom: 4 }}  // ← extra space so labels never clip
>
                      <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          type="number"
                          dataKey="x"
                          domain={[xMin, xMax]}
                          ticks={xTicks}
                          allowDecimals={false}
                          tickMargin={0}
                          tick={{ fill: "#e5e7eb" }}
                          axisLine={{ stroke: "rgba(148,163,184,0.4)" }}
                          tickLine={{ stroke: "rgba(148,163,184,0.4)" }}
                          label={{ value: "Half-PPR Points", position: "insideBottom", offset: -12, fill: "#e5e7eb" }}
                        />
                        <YAxis
                          domain={[0, 100]}
                          tickFormatter={(v) => `${v}%`}
                          tick={{ fill: "#e5e7eb" }}
                          axisLine={{ stroke: "rgba(148,163,184,0.4)" }}
                          tickLine={{ stroke: "rgba(148,163,184,0.4)" }}
                          tickMargin={0}                             // ← space between y tick line and numbers
                          label={{ value: "Cumulative %", angle: -90, position: "insideLeft", offset: 8, fill: "#e5e7eb" }} // ← gap to y-axis label
                        />

                      <Tooltip
                        formatter={(value) => (value == null ? "-" : `${Number(value).toFixed(1)}%`)}
                        labelFormatter={(v) => `Pts: ${v}`}
                      />
                      <Legend verticalAlign="bottom" align="center" wrapperStyle={{ bottom: -32 }} />
                      <Line type="monotone" dataKey="A" name={label(A.id)} dot={false} strokeWidth={3} stroke={strokeA} activeDot={{ r: 4 }} />
                      <Line type="monotone" dataKey="B" name={label(B.id)} dot={false} strokeWidth={3} stroke={strokeB} activeDot={{ r: 4 }} />
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
      <div className="row-label">{title.replace(/_/g, " ")}</div>
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
