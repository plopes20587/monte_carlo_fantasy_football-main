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

const BASE_STAT_ROWS = [
  { label: "pass tds", rules: { include: [/pass|passing/, /td/], exclude: [/sample|chart/] } },
  { label: "pass INTs", rules: { include: [/pass/, /interception/], exclude: [/sample|chart/] } },
  { label: "rush/rec TDs", rules: { include: [/rush.*rec|rec.*rush/, /td/], exclude: [/pass|sample|chart/] } },
  { label: "reception yards", rules: { include: [/reception/, /yard/], exclude: [/rush|pass|sample|chart/] } },
  { label: "rush yards", rules: { include: [/rushing?/, /(yard|yds?)/], exclude: [/rec|pass|sample|chart/] } },
  { label: "receptions", rules: { include: [/receptions?$|^rec(?!eive)/], exclude: [/yard|td|sample|chart/] } },
  { label: "pass yards", rules: { include: [/passing?/, /(yard|yds?)/], exclude: [/rec|rush|sample|chart/] } },
];

const SCORING_SPECIFIC_ROWS = {
  full_ppr: [
    { label: "full-PPR mean", rules: { include: [/(total|score)/, /full/, /ppr/], exclude: [/median|sample|chart|half|std|standard|no/] } },
    { label: "full-PPR median", rules: { include: [/full/, /ppr/, /median/], exclude: [/sample|chart|half|no|std|standard/] } },
  ],
  half_ppr: [
    { label: "half-PPR mean", rules: { include: [/(total|score)/, /half/, /ppr/], exclude: [/median|sample|chart|full|std|standard|no/] } },
    { label: "half-PPR median", rules: { include: [/half/, /ppr/, /median/], exclude: [/sample|chart|full|no|std|standard/] } },
  ],
  no_ppr: [
    { label: "no-PPR mean", rules: { include: [/(total|score)/, /(no|std|standard)/, /ppr/], exclude: [/median|sample|chart|full|half/] } },
    { label: "no-PPR median", rules: { include: [/(no|std|standard)/, /median/], exclude: [/sample|chart|full|half|ppr/] } },
  ],
};

const SCORING_META = {
  full_ppr: {
    chartTitle: "Full-PPR Points",
    medianKey: "total_score_full_ppr_median",
    chartKey: "chart_source_full_ppr",
  },
  half_ppr: {
    chartTitle: "Half-PPR Points",
    medianKey: "total_score_half_ppr_median",
    chartKey: "chart_source_half_ppr",
  },
  no_ppr: {
    chartTitle: "No-PPR Points",
    medianKey: "total_score_no_ppr_median",
    chartKey: "chart_source_no_ppr",
  },
};


/* ---------------- formatting helper ---------------- */

const fmt = (v) => {
  if (v === null || v === undefined || v === "" || v === "NaN") return "-";
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return n % 1 === 0
    ? n.toLocaleString()
    : n.toLocaleString(undefined, { maximumFractionDigits: 3 });
};

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
        
        // Sort alphabetically by name
        const sorted = normalized.sort((a, b) => {
          return a.name.localeCompare(b.name);
        });
        
        if (!cancelled) {
          setPlayers(sorted);
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

  // Unwrap common shapes
  if (Array.isArray(data)) return data[0] ?? null;
  if (data && typeof data === "object") {
    if (data.projection && typeof data.projection === "object") return data.projection;
    if (data.data && typeof data.data === "object") return data.data;
    return data;
  }
  return null;
}

/* ---------------- flatten + stat resolver (regex-based) ---------------- */

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
    const score = (isScalar(val) ? 2 : 0) + include.length;
    if (!best || score > best.score) best = { k, val, score };
  }
  return best ? best.val : undefined;
}

function asNumberIfPossible(v) {
  if (v == null) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : v;
}

const buildSeries = (projection, chartKey) => {
  if (!projection) return null;
  const data = projection?.[chartKey];
  if (!Array.isArray(data) || data.length === 0) return null;

  const series = data
    .map((d) => ({ x: Number(d.x), y: Number(d.y) }))
    .filter((d) => Number.isFinite(d.x) && Number.isFinite(d.y))
    .sort((a, b) => a.x - b.x);

  return series.length ? series : null;
};

const mergeSeries = (aSeries, bSeries) => {
  if (!aSeries && !bSeries) return [];

  const xs = new Set();
  (aSeries || []).forEach((d) => {
    if (d.x >= 0 && d.x <= 26) xs.add(d.x);
  });
  (bSeries || []).forEach((d) => {
    if (d.x >= 0 && d.x <= 26) xs.add(d.x);
  });

  const xVals = Array.from(xs).sort((a, b) => a - b);
  return xVals.map((x) => ({
    x,
    A: aSeries?.find((d) => d.x === x)?.y ?? null,
    B: bSeries?.find((d) => d.x === x)?.y ?? null,
  }));
};

/* ---------------- App ---------------- */

export default function App() {
  const { players, status, error } = usePlayers();

  const [a, setA] = useState("");
  const [b, setB] = useState("");

  const [projA, setProjA] = useState(null);
  const [projB, setProjB] = useState(null);

  const [scoringFormat, setScoringFormat] = useState("half_ppr");

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

  // Dynamic rows based on scoring format
  const STAT_ROWS = useMemo(() => {
    const extraRows = SCORING_SPECIFIC_ROWS[scoringFormat] || SCORING_SPECIFIC_ROWS.half_ppr;
    return [...BASE_STAT_ROWS, ...extraRows];
  }, [scoringFormat]);

  // Build table row values via regex resolver on the FLATTENED keys
  const tableRows = STAT_ROWS.map(({ label: rowLabel, rules }) => {
    const aVal = asNumberIfPossible(resolveByRegexFlat(projA, rules));
    const bVal = asNumberIfPossible(resolveByRegexFlat(projB, rules));
    return { rowLabel, aVal, bVal };
  });

  const scoringMeta = SCORING_META[scoringFormat] || SCORING_META.half_ppr;

  // Chart data based on selected scoring format
  const aSeries = useMemo(
    () => buildSeries(projA, scoringMeta.chartKey),
    [projA, scoringMeta.chartKey]
  );

  const bSeries = useMemo(
    () => buildSeries(projB, scoringMeta.chartKey),
    [projB, scoringMeta.chartKey]
  );

  const chartData = useMemo(
    () => mergeSeries(aSeries, bSeries),
    [aSeries, bSeries]
  );

  const aMedian = projA ? Number(projA[scoringMeta.medianKey]) : null;
  const bMedian = projB ? Number(projB[scoringMeta.medianKey]) : null;

  const showEmpty = !(a && b);
  const strokeA = "#2563eb";
  const strokeB = "#ef4444";

  return (
    <div className="page">
      <h1 className="title">NFL Player Compare</h1>

      <div className="hero">
        <p className="subtitle">
          Compare two NFL players using median, ceiling, and outcome distributions.
        </p>
        <ul className="steps">
          <li><span className="step-dot">1</span> Pick player A and player B</li>
          <li><span className="step-dot">2</span> Review the stat table</li>
          <li><span className="step-dot">3</span> Use the distribution chart to gauge upside and risk.</li>
        </ul>
        <div className="badges">
          <span className="badge">Full-PPR</span>
          <span className="badge">Half-PPR</span>
          <span className="badge">No-PPR</span>
        </div>
      </div>

      {status === "error" && <div className="banner error">Could not load players: {error}</div>}

      <div className="selectors">
        <select value={a} onChange={(e) => setA(e.target.value)} disabled={status !== "success"} aria-label="Select Player A">
          <option value="">{status === "loading" ? "Loading players..." : "Select Player A"}</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}{p.team ? ` (${p.team}` : ""}{p.position ? ` ${p.position}` : ""}{p.team ? ")" : ""}
            </option>
          ))}
        </select>
        <select value={b} onChange={(e) => setB(e.target.value)} disabled={status !== "success"} aria-label="Select Player B">
          <option value="">{status === "loading" ? "Loading players..." : "Select Player B"}</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}{p.team ? ` (${p.team}` : ""}{p.position ? ` ${p.position}` : ""}{p.team ? ")" : ""}
            </option>
          ))}
        </select>
      </div>

      {/* Scoring Format Selector */}
      {(a || b) && (
        <div className="scoring-selector">
          <label>Scoring Format:</label>
          <select
            value={scoringFormat}
            onChange={(e) => setScoringFormat(e.target.value)}
          >
            <option value="full_ppr">Full PPR</option>
            <option value="half_ppr">Half PPR</option>
            <option value="no_ppr">No PPR</option>
          </select>
        </div>
      )}

      <div className="content">
        {showEmpty ? (
          <div className="empty">Select two players.</div>
        ) : (
          <div className="two-col">
            {/* LEFT: table */}
            <div className="card">
              {loadingProj ? (
                <div className="muted">Loading projections...</div>
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
            </div>

            {/* RIGHT: chart */}
            <div className="card chart-card">
              <div className="card-title">Score Distribution</div>
              {!aSeries && !bSeries ? (
                <div className="muted">No distribution available.</div>
              ) : (
                <div className="chart-wrap" style={{ width: "100%", height: 500 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={chartData}
                      margin={{ top: 30, right: 20, left: 20, bottom: 50 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="rgba(255, 255, 255, 0.1)"
                      />
                      {/* Custom Y-axis label positioned above chart */}
                      <text
                        x={20}
                        y={10}
                        fill="#e5e7eb"
                        fontSize={14}
                        fontWeight={500}
                      >
                        Probability %
                      </text>
                      <XAxis
                        type="number"
                        dataKey="x"
                        domain={[0, 26]}
                        ticks={[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26]}
                        allowDecimals={false}
                        allowDataOverflow={false}
                        tickMargin={10}
                        tick={{ fill: "#e5e7eb", fontSize: 14 }}
                        axisLine={{ stroke: "rgba(148,163,184,0.4)" }}
                        tickLine={{ stroke: "rgba(148,163,184,0.4)" }}
                        label={{ value: scoringMeta.chartTitle, position: "insideBottom", offset: -20, fill: "#e5e7eb" }}
                      />
                      <YAxis
                        domain={[0, 48]}
                        ticks={[0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46, 48]}
                        tickFormatter={(v) => `${v}%`}
                        tick={{ fill: "#e5e7eb", fontSize: 14 }}
                        axisLine={{ stroke: "rgba(148,163,184,0.4)" }}
                        tickLine={{ stroke: "rgba(148,163,184,0.4)" }}
                        tickMargin={4}
                        width={40}
                      />
                      <Tooltip
                        formatter={(value, name) =>
                          value == null ? "-" : [`${value.toFixed(1)}%`, name]
                        }
                        labelFormatter={(v) => `Pts: ${v}`}
                        contentStyle={{
                          backgroundColor: "#1e293b",
                          border: "1px solid rgba(148, 163, 184, 0.3)",
                          borderRadius: "8px",
                          padding: "12px",
                          boxShadow: "0 4px 6px rgba(0, 0, 0, 0.3)",
                        }}
                        labelStyle={{
                          color: "#94a3b8",
                          fontWeight: "500",
                          marginBottom: "4px",
                        }}
                        itemStyle={{
                          color: "#e5e7eb",
                          padding: "2px 0",
                        }}
                      />
                      <Legend
                        verticalAlign="bottom"
                        align="center"
                        wrapperStyle={{ paddingTop: 30 }}
                      />
                      {Number.isFinite(aMedian) && aMedian <= 26 && (
                        <ReferenceLine
                          x={aMedian}
                          stroke={strokeA}
                          strokeDasharray="4 4"
                        />
                      )}
                      {Number.isFinite(bMedian) && bMedian <= 26 && (
                        <ReferenceLine
                          x={bMedian}
                          stroke={strokeB}
                          strokeDasharray="4 4"
                        />
                      )}
                      <Line
                        type="monotone"
                        dataKey="A"
                        name={label(a)}
                        dot={false}
                        strokeWidth={3}
                        stroke={strokeA}
                        activeDot={{ r: 4 }}
                        connectNulls
                      />
                      <Line
                        type="monotone"
                        dataKey="B"
                        name={label(b)}
                        dot={false}
                        strokeWidth={3}
                        stroke={strokeB}
                        activeDot={{ r: 4 }}
                        connectNulls
                      />
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
