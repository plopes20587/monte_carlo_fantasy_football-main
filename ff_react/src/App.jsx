// ff_react/src/App.jsx
import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from "recharts";
import "./App.css";
import PropTypes from "prop-types";

/** API base
 *  - Dev: relies on Vite proxy (/api -> http://127.0.0.1:8000)
 *  - Prod: set VITE_API_BASE in .env.production
 */
const API_BASE = import.meta.env.PROD
  ? (import.meta.env.VITE_API_BASE || "")
  : "/api";

/* ---------------- helpers ---------------- */

const fmt = (v) => {
  if (v === null || v === undefined || v === "" || v === "NaN") return "-";
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return n % 1 === 0 ? n.toLocaleString() : n.toLocaleString(undefined, { maximumFractionDigits: 1 });
};

// Build CDF (% 0–100) from raw sample values (use *all* values)
function ecdfFromValues(values) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const nums = values
    .map((v) => (typeof v === "string" ? v.replace(/,/g, "").trim() : v))
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);

  if (!nums.length) return null;
  const n = nums.length;
  // Collapse to unique x with cumulative % at each unique value
  const out = [];
  let i = 0;
  while (i < n) {
    const x = nums[i];
    // advance to last occurrence of x
    let j = i;
    while (j + 1 < n && nums[j + 1] === x) j++;
    const countLeX = j + 1;
    out.push({ x, y: (countLeX / n) * 100 });
    i = j + 1;
  }
  return out;
}

// Convert backend chart array [{ x, cdf }] -> [{ x, y }] with y in 0–100%
function cdfPairsToPercentSeries(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const series = arr
    .map((d) => ({ x: Number(d.x), y: Number(d.cdf) }))
    .filter((d) => Number.isFinite(d.x) && Number.isFinite(d.y))
    .sort((a, b) => a.x - b.x)
    .map((d) => ({ x: d.x, y: Math.max(0, Math.min(100, d.y <= 1 ? d.y * 100 : d.y)) }));
  return series.length ? series : null;
}

// Flexible extractor: prefer full raw samples; else fall back to pre-computed CDF points
function toPercentSeriesFromProjection(proj) {
  if (!proj) return null;

  // Try common raw fields (adjust names here if your backend uses a specific key)
  const rawCandidates =
    proj.raw_samples_half_ppr ||
    proj.raw_values_half_ppr ||
    proj.samples_half_ppr ||
    proj.raw_points ||
    proj.raw_values ||
    proj.samples ||
    proj.values;

  const fromRaw = ecdfFromValues(rawCandidates);
  if (fromRaw && fromRaw.length) return fromRaw;

  // Fallback to existing CDF points
  const fromPairs = cdfPairsToPercentSeries(proj.chart_source_half_ppr);
  return fromPairs;
}

// Step-merge two series by union of x values (keeps *all* x's from both)
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
      if (d.x <= x) y = d.y;
      else break;
    }
    return y;
  };

  return xVals.map((x) => ({
    x,
    [keyA]: stepAt(seriesA, x),
    [keyB]: stepAt(seriesB, x),
  }));
}

// Nice ticks every 5
function ticks5(min, max) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  const lo = Math.floor(min / 5) * 5;
  const hi = Math.ceil(max / 5) * 5;
  const out = [];
  for (let t = lo; t <= hi; t += 5) out.push(t);
  return out;
}

/* -------------- small UI piece -------------- */

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
  a: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  b: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
};

/* ------------------- App ------------------- */

export default function App() {
  const [players, setPlayers] = useState([]);
  const [a, setA] = useState("");
  const [b, setB] = useState("");

  const [projA, setProjA] = useState(null);
  const [projB, setProjB] = useState(null);

  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [loadingProj, setLoadingProj] = useState(false);
  const [error, setError] = useState("");

  // Load players on mount
  useEffect(() => {
    let ignore = false;
    (async () => {
      setLoadingPlayers(true);
      setError("");
      try {
        const r = await fetch(`${API_BASE}/players`);
        if (!r.ok) throw new Error(`Players: ${r.status}`);
        const data = await r.json();
        if (!ignore) setPlayers(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("Failed to load players:", e);
        if (!ignore) setError("Could not load players.");
      } finally {
        if (!ignore) setLoadingPlayers(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  // Auto-select the first two players once loaded (for instant data)
  useEffect(() => {
    if (players.length >= 2 && !a && !b) {
      setA(players[0].id);
      setB(players[1].id);
    }
  }, [players]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load projections when selections change (guard against empty)
  useEffect(() => {
    let ignore = false;

    const load = async (id) => {
      const r = await fetch(`${API_BASE}/projections?player_id=${encodeURIComponent(id)}`);
      if (!r.ok) throw new Error(`Projections: ${r.status}`);
      return r.json();
    };

    (async () => {
      if (!a && !b) {
        setProjA(null);
        setProjB(null);
        return; // prevent /projections without player_id
      }
      setLoadingProj(true);
      setError("");
      try {
        const [pA, pB] = await Promise.all([
          a ? load(a) : Promise.resolve(null),
          b ? load(b) : Promise.resolve(null),
        ]);
        if (ignore) return;
        setProjA(pA);
        setProjB(pB);
      } catch (e) {
        console.error("Failed to load projections:", e);
        if (!ignore) setError("Could not load projections. Try different players or check the API.");
      } finally {
        if (!ignore) setLoadingProj(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [a, b]);

  // Labels for legend/table
  const label = (id) => {
    const meta = players.find((x) => x.id === id);
    if (!meta) return id || "";
    const affix = [meta.team, meta.position].filter(Boolean).join(" ");
    return affix ? `${meta.name} (${affix})` : meta.name;
  };

  // Table fields (explicit)
  const statKeys = ["ppr", "median", "ceiling", "pass_tds"];

  // Chart prep — now uses ALL CSV values if backend sends raw samples, else falls back
  const aSeries = useMemo(() => toPercentSeriesFromProjection(projA), [projA]);
  const bSeries = useMemo(() => toPercentSeriesFromProjection(projB), [projB]);
  const chartData = useMemo(() => mergeSeries(aSeries, bSeries, "A", "B"), [aSeries, bSeries]);

  const { xMin, xMax, xTicks } = useMemo(() => {
    if (!chartData.length) return { xMin: 0, xMax: 0, xTicks: [] };
    const xs = chartData.map((d) => d.x).filter(Number.isFinite);
    const min = Math.min(...xs);
    const max = Math.max(...xs);
    return { xMin: Math.floor(min / 5) * 5, xMax: Math.ceil(max / 5) * 5, xTicks: ticks5(min, max) };
  }, [chartData]);

  // UI states
  const showEmpty = !(a && b);
  const strokeA = "#2563eb";
  const strokeB = "#ef4444";

  return (
    <div className="page">
      <h1 className="title">NFL Player Compare</h1>

      {/* Intro / hero */}
      <div className="hero">
        <p className="subtitle">
          Compare two NFL players using median, ceiling, and half-PPR outcome distributions.
        </p>
        <ul className="steps">
          <li><span className="step-dot">1</span> Pick <strong>Player A</strong> and <strong>Player B</strong>.</li>
          <li><span className="step-dot">2</span> Review the <strong>stat table</strong>.</li>
          <li><span className="step-dot">3</span> Use the <strong>distribution chart</strong> to gauge upside and risk.</li>
        </ul>
        <div className="badges">
          <span className="badge">Half-PPR</span>
        </div>
      </div>

      {/* Error */}
      {error && <div className="banner error" role="alert">{error}</div>}

      {/* Selectors */}
      <div className="selectors">
        <select value={a} onChange={(e) => setA(e.target.value)} disabled={loadingPlayers} aria-label="Select Player A">
          <option value="">{loadingPlayers ? "Loading players…" : "Select Player A"}</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}{p.team ? ` (${p.team}` : ""}{p.position ? ` ${p.position}` : ""}{p.team ? ")" : ""}
            </option>
          ))}
        </select>

        <select value={b} onChange={(e) => setB(e.target.value)} disabled={loadingPlayers} aria-label="Select Player B">
          <option value="">{loadingPlayers ? "Loading players…" : "Select Player B"}</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}{p.team ? ` (${p.team}` : ""}{p.position ? ` ${p.position}` : ""}{p.team ? ")" : ""}
            </option>
          ))}
        </select>
      </div>

      {/* Main content */}
      <div className="content">
        {showEmpty ? (
          <div className="empty">Select two players.</div>
        ) : (
          <div className="two-col">
            {/* LEFT: table */}
            <div className="card">
              {loadingProj ? (
                <div className="muted">Loading projections…</div>
              ) : (
                <div className="compare-grid">
                  <div></div>
                  <strong>{label(a)}</strong>
                  <strong>{label(b)}</strong>
                  {statKeys.map((k) => (
                    <FragmentRow key={k} title={k} a={projA?.[k]} b={projB?.[k]} />
                  ))}
                </div>
              )}
            </div>

            {/* RIGHT: chart */}
            <div className="card chart-card">
              <div className="card-title">Half-PPR Distribution</div>
              {loadingProj ? (
                <div className="muted">Loading chart…</div>
              ) : !aSeries && !bSeries ? (
                <div className="muted">No half-PPR distribution available.</div>
              ) : (
                <div className="chart-wrap" style={{ width: "100%", height: 380 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 8, right: 24, left: 8, bottom: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        type="number"
                        dataKey="x"
                        domain={[xMin, xMax]}
                        ticks={xTicks}
                        allowDecimals={false}
                        tickMargin={10}
                        tick={{ fill: "#e5e7eb" }}
                        axisLine={{ stroke: "rgba(148,163,184,0.4)" }}
                        tickLine={{ stroke: "rgba(148,163,184,0.4)" }}
                        label={{ value: "Half-PPR Points", position: "insideBottom", offset: -8, fill: "#e5e7eb" }}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tickFormatter={(v) => `${v}%`}
                        tick={{ fill: "#e5e7eb" }}
                        axisLine={{ stroke: "rgba(148,163,184,0.4)" }}
                        tickLine={{ stroke: "rgba(148,163,184,0.4)" }}
                        tickMargin={8}
                        label={{ value: "Cumulative %", angle: -90, position: "insideLeft", offset: 8, fill: "#e5e7eb" }}
                      />
                      <Tooltip
                        formatter={(value, name) =>
                          value == null
                            ? "-"
                            : [`${Number(value).toFixed(1)}%`, name === "A" ? label(a) : label(b)]
                        }
                        labelFormatter={(v) => `Pts: ${v}`}
                      />
                      <Legend verticalAlign="bottom" align="center" wrapperStyle={{ bottom: -8 }} />
                      <Line type="monotone" dataKey="A" name={label(a)} dot={false} strokeWidth={3} stroke={strokeA} activeDot={{ r: 4 }} />
                      <Line type="monotone" dataKey="B" name={label(b)} dot={false} strokeWidth={3} stroke={strokeB} activeDot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* TEMP DEBUG: comment out when satisfied */}
      {/* <pre style={{background:"#111", color:"#aaa", padding:8, borderRadius:8}}>
{JSON.stringify({ count: players.length, a, b, hasProjA: !!projA, hasProjB: !!projB }, null, 2)}
</pre> */}
    </div>
  );
}
