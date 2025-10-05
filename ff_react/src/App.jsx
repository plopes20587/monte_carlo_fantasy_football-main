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
  ReferenceLine,
} from "recharts";
import "./App.css";
import PropTypes from "prop-types";

/** API base
 *  Dev: uses Vite proxy at /api if VITE_API_BASE is not set
 *  Prod: set VITE_API_BASE to your backend origin
 */
const API_BASE = import.meta.env.PROD
  ? (import.meta.env.VITE_API_BASE || "")
  : (import.meta.env.VITE_API_BASE || "/api");


/* ---------------- formatting helper ---------------- */

const fmt = (v) => {
  if (v === null || v === undefined || v === "" || v === "NaN") return "-";
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return n % 1 === 0
    ? n.toLocaleString()
    : n.toLocaleString(undefined, { maximumFractionDigits: 3 });
};

/* ---------------- Half-PPR ECDF helpers ---------------- */

function ecdfFromValues(values) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const nums = values
    .map((v) => (typeof v === "string" ? v.replace(/,/g, "").trim() : v))
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
  if (!nums.length) return null;
  const n = nums.length;
  const out = [];
  for (let i = 0; i < n; ) {
    const x = nums[i];
    let j = i;
    while (j + 1 < n && nums[j + 1] === x) j++;
    out.push({ x, y: ((j + 1) / n) * 100 });
    i = j + 1;
  }
  return out;
}

function cdfPairsToPercentSeries(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const series = arr
    .map((d) => ({ x: Number(d.x), y: Number(d.cdf) }))
    .filter((d) => Number.isFinite(d.x) && Number.isFinite(d.y))
    .sort((a, b) => a.x - b.x)
    .map((d) => ({ x: d.x, y: Math.max(0, Math.min(100, d.y <= 1 ? d.y * 100 : d.y)) }));
  return series.length ? series : null;
}

function halfPprSeriesFromProjection(proj) {
  if (!proj) return null;
  const rawCandidates =
    proj.raw_values_half_ppr ||
    proj.samples_half_ppr ||
    proj.total_score_half_ppr_samples ||
    proj.raw_total_score_half_ppr;
  const fromRaw = ecdfFromValues(rawCandidates);
  if (fromRaw && fromRaw.length) return fromRaw;
  return cdfPairsToPercentSeries(proj.chart_source_half_ppr);
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

function ticks5(min, max) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  const lo = Math.floor(min / 5) * 5;
  const hi = Math.ceil(max / 5) * 5;
  const out = [];
  for (let t = lo; t <= hi; t += 5) out.push(t);
  return out;
}

/* ---------------- tiny table row component ---------------- */

function FragmentRow({ title, a, b }) {
  return (
    <>
      <div className="row-label">{title}</div>
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

/* ---------------- robust data loading ---------------- */

function usePlayers() {
  const [players, setPlayers] = useState([]);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatus("loading");
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/players`, { credentials: "omit" });
        if (!res.ok) throw new Error(`HTTP ${res.status} on /players`);
        const data = await res.json();
        const list = Array.isArray(data) ? data : Array.isArray(data?.players) ? data.players : [];
        const normalized = list.map((p, i) => ({
          id: p.id ?? p.player_id ?? p.slug ?? String(i),
          name: p.name ?? p.player_name ?? "Unknown",
          team: p.team ?? p.nfl_team ?? "",
          position: p.position ?? p.pos ?? "",
        }));
        if (!cancelled) {
          setPlayers(normalized);
          setStatus("success");
        }
      } catch (e) {
        if (!cancelled) {
          setError(String(e.message || e));
          setStatus("error");
          console.error("Failed to load players:", e);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { players, status, error };
}

async function fetchProjection(playerId) {
  const url = `${API_BASE}/projections?player_id=${encodeURIComponent(playerId)}`;
  const res = await fetch(url, { credentials: "omit" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  const data = await res.json();

  // Unwrap common shapes:
  // - { projection: {...} }  -or-  { data: {...} }
  // - [ {...} ]
  // - plain {...}
  if (Array.isArray(data)) return data[0] ?? null;
  if (data && typeof data === "object") {
    if (data.projection && typeof data.projection === "object") return data.projection;
    if (data.data && typeof data.data === "object") return data.data;
    return data;
  }
  return null;
}

/* ---------------- flatten + stat resolver (regex-based) ---------------- */

/** Deep-flatten an object into a 1-level map with dotted paths (arrays keep numeric indices) */
function flattenObject(obj, prefix = "", out = {}) {
  if (obj == null) return out;
  if (typeof obj !== "object") {
    out[prefix || ""] = obj;
    return out;
  }
  const base = prefix ? prefix + "." : "";
  for (const [k, v] of Object.entries(obj)) {
    const key = base + k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      flattenObject(v, key, out);
    } else {
      out[key] = v;
    }
  }
  return out;
}

/** Pick the best flattened key by include/exclude regex rules (prefer scalar values) */
function resolveByRegexFlat(obj, { include = [], exclude = [] } = {}) {
  if (!obj || typeof obj !== "object") return undefined;
  const flat = flattenObject(obj);
  let best = null;
  const isScalar = (v) => v == null || ["string", "number", "boolean"].includes(typeof v);

  for (const k of Object.keys(flat)) {
    const key = k.toLowerCase();
    if (!include.every((re) => re.test(key))) continue;
    if (exclude.some((re) => re.test(key))) continue;

    const val = flat[k];
    const score = (isScalar(val) ? 2 : 0) + include.length; // prefer scalars
    if (!best || score > best.score) best = { k, val, score };
  }
  return best ? best.val : undefined;
}

function asNumberIfPossible(v) {
  if (v == null) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : v;
}

/* ---------------- App ---------------- */

export default function App() {
  const { players, status, error } = usePlayers();

  const [a, setA] = useState("");
  const [b, setB] = useState("");

  const [projA, setProjA] = useState(null);
  const [projB, setProjB] = useState(null);

  const [loadingProj, setLoadingProj] = useState(false);
  const [projErr, setProjErr] = useState("");

  // Auto-select the first two players once loaded
  useEffect(() => {
    if (players.length >= 2 && !a && !b) {
      setA(players[0].id);
      setB(players[1].id);
    }
  }, [players]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load projections when selections change
  useEffect(() => {
    let ignore = false;
    (async () => {
      if (!a && !b) {
        setProjA(null);
        setProjB(null);
        return;
      }
      setLoadingProj(true);
      setProjErr("");
      try {
        const [pA, pB] = await Promise.all([
          a ? fetchProjection(a) : Promise.resolve(null),
          b ? fetchProjection(b) : Promise.resolve(null),
        ]);
        if (ignore) return;
        setProjA(pA);
        setProjB(pB);
      } catch (e) {
        console.error("Failed to load projections:", e);
        if (!ignore) setProjErr("Could not load projections. Try different players or check the API.");
      } finally {
        if (!ignore) setLoadingProj(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [a, b]);

  // Friendly label for selects / legend
  const label = (id) => {
    const meta = players.find((x) => x.id === id);
    if (!meta) return id || "";
    const affix = [meta.team, meta.position].filter(Boolean).join(" ");
    return affix ? `${meta.name} (${affix})` : meta.name;
  };

  // Rows + matching rules (regex include/exclude) against FLATTENED keys
const STAT_ROWS = [
  // headline rows
  {
    label: "ppr",
    rules: { include: [/^ppr$/], exclude: [/full|half|no|std|standard|median|p50|percentile|sample|chart/] },
  },
  {
    label: "median",
    rules: { include: [/median|^p50$|percentile_?50/], exclude: [/sample|chart/] },
  },
  {
    label: "ceiling",
    rules: { include: [/ceiling|^p95$|percentile_?95/], exclude: [/sample|chart/] },
  },
  {
    label: "pass tds",
    rules: { include: [/pass|passing/, /td/], exclude: [/sample|chart/] },
  },

  // added stat lines
  { label: "pass INTs",       rules: { include: [/interception|^ints?$/], exclude: [/sample|chart/] } },
  { label: "rush/rec TDs",    rules: { include: [/(rush|rushing|rec(eiv|ept))/, /td/], exclude: [/pass|sample|chart/] } },
  { label: "reception yards", rules: { include: [/(receiv|recept|rec)\w*/, /(yard|yds?)/], exclude: [/rush|pass|sample|chart/] } },
  { label: "rush yards",      rules: { include: [/rushing?/, /(yard|yds?)/], exclude: [/rec|pass|sample|chart/] } },
  { label: "receptions",      rules: { include: [/receptions?$|^rec(?!eive)/], exclude: [/yard|td|sample|chart/] } },
  { label: "pass yards",      rules: { include: [/passing?/, /(yard|yds?)/], exclude: [/rec|rush|sample|chart/] } },

  // scoring buckets (distinct)
  { label: "full-PPR points", rules: { include: [/(total|score)/, /full/, /ppr/], exclude: [/median|sample|chart|half|std|standard|no/] } },
  { label: "half-PPR points", rules: { include: [/(total|score)/, /half/, /ppr/], exclude: [/median|sample|chart|full|std|standard|no/] } },
  { label: "no-PPR points",   rules: { include: [/(total|score)/, /(no|std|standard)/, /ppr/], exclude: [/median|sample|chart|full|half/] } },

  { label: "full-PPR median", rules: { include: [/full/, /ppr/, /median/], exclude: [/sample|chart|half|no|std|standard/] } },
  { label: "half-PPR median", rules: { include: [/half/, /ppr/, /median/], exclude: [/sample|chart|full|no|std|standard/] } },
  { label: "no-PPR median",   rules: { include: [/(no|std|standard)/, /median/], exclude: [/sample|chart|full|half|ppr/] } },
];


  // Build table row values via regex resolver on the FLATTENED keys
  const tableRows = STAT_ROWS.map(({ label: rowLabel, rules }) => {
    const aVal = asNumberIfPossible(resolveByRegexFlat(projA, rules));
    const bVal = asNumberIfPossible(resolveByRegexFlat(projB, rules));
    return { rowLabel, aVal, bVal };
  });

  // Half-PPR chart data
  const aSeries = useMemo(() => halfPprSeriesFromProjection(projA), [projA]);
  const bSeries = useMemo(() => halfPprSeriesFromProjection(projB), [projB]);
  const chartData = useMemo(() => mergeSeries(aSeries, bSeries, "A", "B"), [aSeries, bSeries]);

  const { xMin, xMax, xTicks } = useMemo(() => {
    if (!chartData.length) return { xMin: 0, xMax: 0, xTicks: [] };
    const xs = chartData.map((d) => d.x).filter(Number.isFinite);
    const min = Math.min(...xs);
    const max = Math.max(...xs);
    return { xMin: Math.floor(min / 5) * 5, xMax: Math.ceil(max / 5) * 5, xTicks: ticks5(min, max) };
  }, [chartData]);

  // Optional vertical medians if present on projection
  const aMedian =
    Number.isFinite(Number(projA?.total_score_half_ppr_median))
      ? Number(projA.total_score_half_ppr_median)
      : (Number.isFinite(Number(projA?.median)) ? Number(projA.median) : null);
  const bMedian =
    Number.isFinite(Number(projB?.total_score_half_ppr_median))
      ? Number(projB.total_score_half_ppr_median)
      : (Number.isFinite(Number(projB?.median)) ? Number(projB.median) : null);

  const showEmpty = !(a && b);
  const strokeA = "#2563eb";
  const strokeB = "#ef4444";

  // Debug toggle (?debug=1) shows FLATTENED keys so you can confirm names quickly
  const debug = typeof window !== "undefined" && /[?&]debug=1\b/.test(window.location.search);

  const flatA = useMemo(() => (projA ? flattenObject(projA) : null), [projA]);
  const flatB = useMemo(() => (projB ? flattenObject(projB) : null), [projB]);

  return (
    <div className="page">
      <h1 className="title">NFL Player Compare</h1>

      <div className="hero">
        <p className="subtitle">
          Compare two NFL players using median, ceiling, and outcome distributions.
        </p>
        <ul className="steps">
          <li><span className="step-dot">1</span> Pick <strong>Player A</strong> and <strong>Player B</strong>.</li>
          <li><span className="step-dot">2</span> Review the <strong>stat table</strong>.</li>
          <li><span className="step-dot">3</span> Use the <strong>distribution chart</strong> to gauge upside and risk.</li>
        </ul>
        <div className="badges"><span className="badge">Half-PPR</span></div>
      </div>

      {status === "error" && <div className="banner error">Couldn’t load players: {error}</div>}

      <div className="selectors">
        <select value={a} onChange={(e) => setA(e.target.value)} disabled={status !== "success"} aria-label="Select Player A">
          <option value="">{status === "loading" ? "Loading players…" : "Select Player A"}</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}{p.team ? ` (${p.team}` : ""}{p.position ? ` ${p.position}` : ""}{p.team ? ")" : ""}
            </option>
          ))}
        </select>
        <select value={b} onChange={(e) => setB(e.target.value)} disabled={status !== "success"} aria-label="Select Player B">
          <option value="">{status === "loading" ? "Loading players…" : "Select Player B"}</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}{p.team ? ` (${p.team}` : ""}{p.position ? ` ${p.position}` : ""}{p.team ? ")" : ""}
            </option>
          ))}
        </select>
      </div>

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
                  {tableRows.map(({ rowLabel, aVal, bVal }) => (
                    <FragmentRow key={rowLabel} title={rowLabel} a={aVal} b={bVal} />
                  ))}
                </div>
              )}
              {projErr && <div className="banner error" style={{ marginTop: 8 }}>{projErr}</div>}
              {debug && (
                <details style={{ marginTop: 8 }}>
                  <summary style={{ cursor: "pointer" }}>debug: flattened projection keys</summary>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <strong>A keys</strong>
                      <pre style={{ whiteSpace: "pre-wrap" }}>
                        {flatA ? Object.keys(flatA).sort().join("\n") : "—"}
                      </pre>
                    </div>
                    <div>
                      <strong>B keys</strong>
                      <pre style={{ whiteSpace: "pre-wrap" }}>
                        {flatB ? Object.keys(flatB).sort().join("\n") : "—"}
                      </pre>
                    </div>
                  </div>
                </details>
              )}
            </div>

            {/* RIGHT: chart — Half-PPR ECDF */}
            <div className="card chart-card">
              <div className="card-title">Half-PPR Distribution</div>
              {!aSeries && !bSeries ? (
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
                          value == null ? "-" : [`${Number(value).toFixed(1)}%`, name === "A" ? label(a) : label(b)]
                        }
                        labelFormatter={(v) => `Pts: ${v}`}
                      />
                      <Legend verticalAlign="bottom" align="center" wrapperStyle={{ bottom: -8 }} />

                      {Number.isFinite(aMedian) && (
                        <ReferenceLine
                          x={aMedian}
                          stroke={strokeA}
                          strokeDasharray="4 4"
                          label={{ value: `${(players.find(p => p.id === a)?.name || "A").split(" ")[0]} median`, position: "top", fill: "#e5e7eb" }}
                        />
                      )}
                      {Number.isFinite(bMedian) && (
                        <ReferenceLine
                          x={bMedian}
                          stroke={strokeB}
                          strokeDasharray="4 4"
                          label={{ value: `${(players.find(p => p.id === b)?.name || "B").split(" ")[0]} median`, position: "top", fill: "#e5e7eb" }}
                        />
                      )}

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
    </div>
  );
}
