import { useEffect, useMemo, useState, memo, useCallback } from "react";
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
import Select from "react-select";
import "./App.css";
import PropTypes from "prop-types";
import {
  trackPlayerSelection,
  trackPlayerComparison,
  trackScoringFormatChange,
} from "./analytics";
import CookieConsent from "./CookieConsent";

/** API base
 *  Dev: uses Vite proxy at /api if VITE_API_BASE is not set
 *  Prod: set VITE_API_BASE to your backend origin
 */
const API_BASE = import.meta.env.PROD
  ? import.meta.env.VITE_API_BASE || ""
  : import.meta.env.VITE_API_BASE || "/api";

const BASE_STAT_ROWS = [
  {
    label: "pass tds",
    rules: { include: [/pass|passing/, /td/], exclude: [/sample|chart/] },
  },
  {
    label: "pass INTs",
    rules: { include: [/pass/, /interception/], exclude: [/sample|chart/] },
  },
  {
    label: "rush/rec TDs",
    rules: {
      include: [/rush.*rec|rec.*rush/, /td/],
      exclude: [/pass|sample|chart/],
    },
  },
  {
    label: "reception yards",
    rules: {
      include: [/reception/, /yard/],
      exclude: [/rush|pass|sample|chart/],
    },
  },
  {
    label: "rush yards",
    rules: {
      include: [/rushing?/, /(yard|yds?)/],
      exclude: [/rec|pass|sample|chart/],
    },
  },
  {
    label: "receptions",
    rules: {
      include: [/receptions?$|^rec(?!eive)/],
      exclude: [/yard|td|sample|chart/],
    },
  },
  {
    label: "pass yards",
    rules: {
      include: [/passing?/, /(yard|yds?)/],
      exclude: [/rec|rush|sample|chart/],
    },
  },
];

const SCORING_SPECIFIC_ROWS = {
  full_ppr: [
    {
      label: "full-PPR mean",
      rules: {
        include: [/(total|score)/, /full/, /ppr/],
        exclude: [/median|sample|chart|half|std|standard|no/],
      },
    },
    {
      label: "full-PPR median",
      rules: {
        include: [/full/, /ppr/, /median/],
        exclude: [/sample|chart|half|no|std|standard/],
      },
    },
  ],
  half_ppr: [
    {
      label: "half-PPR mean",
      rules: {
        include: [/(total|score)/, /half/, /ppr/],
        exclude: [/median|sample|chart|full|std|standard|no/],
      },
    },
    {
      label: "half-PPR median",
      rules: {
        include: [/half/, /ppr/, /median/],
        exclude: [/sample|chart|full|no|std|standard/],
      },
    },
  ],
  no_ppr: [
    {
      label: "no-PPR mean",
      rules: {
        include: [/(total|score)/, /(no|std|standard)/, /ppr/],
        exclude: [/median|sample|chart|full|half/],
      },
    },
    {
      label: "no-PPR median",
      rules: {
        include: [/(no|std|standard)/, /median/],
        exclude: [/sample|chart|full|half|ppr/],
      },
    },
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

/* ---------------- react-select custom styles ---------------- */

const customSelectStyles = {
  control: (provided, state) => ({
    ...provided,
    backgroundColor: "#1e293b",
    borderColor: state.isFocused ? "#3b82f6" : "rgba(148, 163, 184, 0.3)",
    borderWidth: "2px",
    borderRadius: "8px",
    padding: "4px 8px",
    minHeight: "48px",
    boxShadow: state.isFocused ? "0 0 0 3px rgba(59, 130, 246, 0.1)" : "none",
    cursor: "pointer",
    "&:hover": {
      borderColor: "#3b82f6",
    },
  }),
  menu: (provided) => ({
    ...provided,
    backgroundColor: "#1e293b",
    border: "2px solid rgba(148, 163, 184, 0.3)",
    borderRadius: "8px",
    marginTop: "4px",
    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.3)",
  }),
  menuList: (provided) => ({
    ...provided,
    padding: "4px",
    maxHeight: "300px",
  }),
  option: (provided, state) => ({
    ...provided,
    backgroundColor: state.isFocused
      ? "#334155"
      : state.isSelected
      ? "#3b82f6"
      : "transparent",
    color: "#e5e7eb",
    padding: "12px 16px",
    cursor: "pointer",
    borderRadius: "6px",
    fontSize: "16px",
    textAlign: "left",
    "&:active": {
      backgroundColor: "#3b82f6",
    },
  }),
  singleValue: (provided) => ({
    ...provided,
    color: "#e5e7eb",
    fontSize: "16px",
    textAlign: "left",
  }),
  input: (provided) => ({
    ...provided,
    color: "#e5e7eb",
    fontSize: "16px",
    textAlign: "left",
  }),
  placeholder: (provided) => ({
    ...provided,
    color: "#94a3b8",
    fontSize: "16px",
    textAlign: "left",
  }),
  indicatorSeparator: () => ({
    display: "none",
  }),
  dropdownIndicator: (provided) => ({
    ...provided,
    color: "#94a3b8",
    "&:hover": {
      color: "#e5e7eb",
    },
  }),
  clearIndicator: (provided) => ({
    ...provided,
    color: "#94a3b8",
    "&:hover": {
      color: "#ef4444",
    },
  }),
};

/* ---------------- custom react-select components ---------------- */

const DropdownIndicator = memo(function DropdownIndicator(props) {
  const { selectProps } = props;
  const isMenuOpen = selectProps.menuIsOpen;

  return (
    <div style={{ padding: "0 8px", display: "flex", alignItems: "center" }}>
      {isMenuOpen ? (
        // Search icon (magnifying glass)
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ color: "#94a3b8" }}
        >
          <path
            d="M9 17A8 8 0 1 0 9 1a8 8 0 0 0 0 16zM19 19l-4.35-4.35"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        // Chevron down icon
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ color: "#94a3b8" }}
        >
          <path
            d="M5 7.5L10 12.5L15 7.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </div>
  );
});

DropdownIndicator.propTypes = {
  selectProps: PropTypes.shape({
    menuIsOpen: PropTypes.bool,
  }).isRequired,
};

/* ---------------- formatting helper ---------------- */

const fmt = (v) => {
  if (v === null || v === undefined || v === "" || v === "NaN") return "-";
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return n % 1 === 0
    ? n.toLocaleString()
    : n.toLocaleString(undefined, { maximumFractionDigits: 1 });
};

/* ---------------- tiny table row component ---------------- */

const FragmentRow = memo(function FragmentRow({ title, a, b }) {
  return (
    <>
      <div className="row-label">{title}</div>
      <div>{fmt(a)}</div>
      <div>{fmt(b)}</div>
    </>
  );
});
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
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.players)
          ? data.players
          : [];
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
  const url = `${API_BASE}/projections?player_id=${encodeURIComponent(
    playerId
  )}`;
  const res = await fetch(url, { credentials: "omit" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  const data = await res.json();

  // Unwrap common shapes
  if (Array.isArray(data)) return data[0] ?? null;
  if (data && typeof data === "object") {
    if (data.projection && typeof data.projection === "object")
      return data.projection;
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
  const isScalar = (v) =>
    v == null || ["string", "number", "boolean"].includes(typeof v);

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
    // Cap data at x=30 to prevent lines from extending too far
    if (d.x >= 0 && d.x <= 30) xs.add(d.x);
  });
  (bSeries || []).forEach((d) => {
    // Cap data at x=30 to prevent lines from extending too far
    if (d.x >= 0 && d.x <= 30) xs.add(d.x);
  });

  const xVals = Array.from(xs).sort((a, b) => a - b);
  const merged = xVals.map((x) => ({
    x,
    A: aSeries?.find((d) => d.x === x)?.y ?? null,
    B: bSeries?.find((d) => d.x === x)?.y ?? null,
  }));

  // Filter out points where both players have probability <= 0.1% (no meaningful data)
  return merged.filter((point) => {
    const hasDataA = point.A != null && point.A > 0.1;
    const hasDataB = point.B != null && point.B > 0.1;
    return hasDataA || hasDataB;
  });
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

  const [menuAOpen, setMenuAOpen] = useState(false);
  const [menuBOpen, setMenuBOpen] = useState(false);
  const [showChartTooltip, setShowChartTooltip] = useState(false);

  const [windowWidth, setWindowWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1024
  );

  // Track window resize for responsive chart ticks
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Track page views on mount
  useEffect(() => {
    import("./analytics").then(({ trackPageView }) => {
      trackPageView(window.location.pathname);
    });
  }, []);

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

        // Track player comparison when both players are loaded
        if (pA && pB) {
          const playerAMeta = players.find((p) => p.id === a);
          const playerBMeta = players.find((p) => p.id === b);
          if (playerAMeta && playerBMeta) {
            trackPlayerComparison(
              playerAMeta.name,
              playerBMeta.name,
              scoringFormat
            );
          }
        }
      } catch (e) {
        console.error("Failed to load projections:", e);
        if (!ignore)
          setProjErr(
            "Could not load projections. Try different players or check the API."
          );
      } finally {
        if (!ignore) setLoadingProj(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [a, b, players, scoringFormat]);

  // Friendly label for selects / legend
  const label = useCallback((id) => {
    const meta = players.find((x) => x.id === id);
    if (!meta) return id || "";
    const affix = [meta.team, meta.position].filter(Boolean).join(" ");
    return affix ? `${meta.name} (${affix})` : meta.name;
  }, [players]);

  // Format players for react-select
  const playerOptions = useMemo(() => {
    return players.map((p) => {
      const affix = [p.team, p.position].filter(Boolean).join(" ");
      return {
        value: p.id,
        label: affix ? `${p.name} (${affix})` : p.name,
      };
    });
  }, [players]);

  // Scoring format options for react-select
  const scoringOptions = [
    { value: "full_ppr", label: "Full PPR" },
    { value: "half_ppr", label: "Half PPR" },
    { value: "no_ppr", label: "No PPR" },
  ];

  // Dynamic rows based on scoring format
  const STAT_ROWS = useMemo(() => {
    const extraRows =
      SCORING_SPECIFIC_ROWS[scoringFormat] || SCORING_SPECIFIC_ROWS.half_ppr;
    return [...BASE_STAT_ROWS, ...extraRows];
  }, [scoringFormat]);

  // Build table row values via regex resolver on the FLATTENED keys
  const tableRows = useMemo(() => {
    return STAT_ROWS.map(({ label: rowLabel, rules }) => {
      const aVal = asNumberIfPossible(resolveByRegexFlat(projA, rules));
      const bVal = asNumberIfPossible(resolveByRegexFlat(projB, rules));
      return { rowLabel, aVal, bVal };
    });
  }, [STAT_ROWS, projA, projB]);

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

  // Calculate max x value (points) from the data where there's meaningful probability
  const maxXValue = useMemo(() => {
    if (!chartData.length) return 26;

    // Find the highest x value where either player has probability > 0.1%
    let maxMeaningfulX = 0;
    for (const point of chartData) {
      const hasDataA = point.A != null && point.A > 0.1;
      const hasDataB = point.B != null && point.B > 0.1;
      if ((hasDataA || hasDataB) && point.x > maxMeaningfulX) {
        maxMeaningfulX = point.x;
      }
    }

    // Add a small buffer (2 points) and round up to nearest even number
    const buffered = maxMeaningfulX + 2;
    const calculated = Math.ceil(buffered / 2) * 2;

    // Cap the x-axis at 30 to prevent lines from appearing too flat
    return Math.min(calculated, 30);
  }, [chartData]);

  // Calculate max y value to determine if we need to extend y-axis beyond 20%
  const maxYValue = useMemo(() => {
    if (!chartData.length) return 20;
    const maxA = Math.max(...chartData.map((d) => d.A ?? 0));
    const maxB = Math.max(...chartData.map((d) => d.B ?? 0));
    const maxVal = Math.max(maxA, maxB);

    // If max exceeds 20%, round up to nearest 10
    if (maxVal > 20) {
      return Math.ceil(maxVal / 10) * 10;
    }
    return 20;
  }, [chartData]);

  // Generate ticks dynamically based on max value
  const yAxisTicks = useMemo(() => {
    const ticks = [];
    for (let i = 0; i <= maxYValue; i += 2) {
      ticks.push(i);
    }
    return ticks;
  }, [maxYValue]);

  // Responsive x-axis ticks based on screen size and dynamic max value
  const xAxisTicks = useMemo(() => {
    const ticks = [];
    let interval;

    if (windowWidth < 480) {
      // Mobile: larger intervals for readability
      interval = Math.max(6, Math.ceil(maxXValue / 5));
    } else if (windowWidth < 768) {
      // Tablet: medium intervals
      interval = Math.max(4, Math.ceil(maxXValue / 7));
    } else {
      // Desktop: every 2 points
      interval = 2;
    }

    for (let i = 0; i <= maxXValue; i += interval) {
      ticks.push(i);
    }

    // Ensure the max value is included if not already
    if (ticks[ticks.length - 1] !== maxXValue) {
      ticks.push(maxXValue);
    }

    return ticks;
  }, [windowWidth, maxXValue]);

  const aMedian = projA ? Number(projA[scoringMeta.medianKey]) : null;
  const bMedian = projB ? Number(projB[scoringMeta.medianKey]) : null;

  const showEmpty = !(a && b);
  const strokeA = "#2563eb";
  const strokeB = "#ef4444";

  return (
    <div className="page">
      <CookieConsent />
      <h1 className="title">NFL Player Compare</h1>

      <div className="hero">
        <p className="subtitle">
          Compare two NFL players using mean, median, and outcome distributions.
        </p>
        <ul className="steps">
          <li>
            <span className="step-dot">1</span> Pick player A and player B
          </li>
          <li>
            <span className="step-dot">2</span> Review the stat table
          </li>
          <li>
            <span className="step-dot">3</span> Use the distribution chart to
            gauge upside and risk.
          </li>
        </ul>
        <div className="badges">
          <span className="badge">Full-PPR</span>
          <span className="badge">Half-PPR</span>
          <span className="badge">No-PPR</span>
        </div>
      </div>

      {status === "error" && (
        <div className="banner error">Could not load players: {error}</div>
      )}

      <div className="selectors">
        <Select
          value={playerOptions.find((opt) => opt.value === a) || null}
          onChange={(selectedOption) => {
            const newPlayerId = selectedOption?.value || "";
            setA(newPlayerId);
            if (selectedOption) {
              const player = players.find((p) => p.id === selectedOption.value);
              if (player) {
                trackPlayerSelection(player.name, player.position, "A");
              }
            }
          }}
          options={playerOptions}
          styles={customSelectStyles}
          components={{ DropdownIndicator }}
          placeholder={
            status === "loading" ? "Loading players..." : "Search players..."
          }
          isDisabled={status !== "success"}
          isSearchable={true}
          isClearable={false}
          controlShouldRenderValue={!menuAOpen}
          onMenuOpen={() => setMenuAOpen(true)}
          onMenuClose={() => setMenuAOpen(false)}
          aria-label="Select Player A"
        />
        <Select
          value={playerOptions.find((opt) => opt.value === b) || null}
          onChange={(selectedOption) => {
            const newPlayerId = selectedOption?.value || "";
            setB(newPlayerId);
            if (selectedOption) {
              const player = players.find((p) => p.id === selectedOption.value);
              if (player) {
                trackPlayerSelection(player.name, player.position, "B");
              }
            }
          }}
          options={playerOptions}
          styles={customSelectStyles}
          components={{ DropdownIndicator }}
          placeholder={
            status === "loading" ? "Loading players..." : "Search players..."
          }
          isDisabled={status !== "success"}
          isSearchable={true}
          isClearable={false}
          controlShouldRenderValue={!menuBOpen}
          onMenuOpen={() => setMenuBOpen(true)}
          onMenuClose={() => setMenuBOpen(false)}
          aria-label="Select Player B"
        />

        {/* Scoring Format Selector */}
        <div className="scoring-selector">
          <label>Scoring Format:</label>
          <Select
            value={scoringOptions.find((opt) => opt.value === scoringFormat)}
            onChange={(selectedOption) => {
              const newFormat = selectedOption.value;
              trackScoringFormatChange(scoringFormat, newFormat);
              setScoringFormat(newFormat);
            }}
            options={scoringOptions}
            styles={customSelectStyles}
            isSearchable={false}
            isClearable={false}
            className="scoring-select"
          />
        </div>
      </div>

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
                    <FragmentRow
                      key={rowLabel}
                      title={rowLabel}
                      a={aVal}
                      b={bVal}
                    />
                  ))}
                </div>
              )}
              {projErr && (
                <div className="banner error" style={{ marginTop: 8 }}>
                  {projErr}
                </div>
              )}
            </div>

            {/* RIGHT: chart */}
            <div className="card chart-card">
              <div className="card-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                Score Distribution
                <div
                  className="chart-info-icon"
                  onMouseEnter={() => setShowChartTooltip(true)}
                  onMouseLeave={() => setShowChartTooltip(false)}
                  onClick={() => setShowChartTooltip(!showChartTooltip)}
                  style={{ position: "relative", cursor: "help" }}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    style={{ color: "#94a3b8" }}
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                    <path
                      d="M12 16v-4m0-4h.01"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                  {showChartTooltip && (
                    <div className="chart-tooltip">
                      <strong>How to read this chart:</strong>
                      <ul>
                        <li><strong>Higher curve</strong> = more likely score</li>
                        <li><strong>Dashed lines</strong> = median projections</li>
                        <li><strong>Wider shape</strong> = more variance/risk</li>
                        <li><strong>Narrower shape</strong> = consistent scoring</li>
                      </ul>
                      <p style={{ marginTop: "8px", fontSize: "13px", color: "#94a3b8" }}>
                        Shows probability of each score using Monte Carlo simulations.
                      </p>
                    </div>
                  )}
                </div>
              </div>
              {!aSeries && !bSeries ? (
                <div className="muted">No distribution available.</div>
              ) : (
                <div className="chart-wrap">
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
                        domain={[0, maxXValue]}
                        ticks={xAxisTicks}
                        allowDecimals={false}
                        allowDataOverflow={false}
                        tickMargin={10}
                        tick={{ fill: "#e5e7eb", fontSize: 14 }}
                        axisLine={{ stroke: "rgba(148,163,184,0.4)" }}
                        tickLine={{ stroke: "rgba(148,163,184,0.4)" }}
                        label={{
                          value: scoringMeta.chartTitle,
                          position: "insideBottom",
                          offset: -20,
                          fill: "#e5e7eb",
                        }}
                      />
                      <YAxis
                        domain={[0, maxYValue]}
                        ticks={yAxisTicks}
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
                      {Number.isFinite(aMedian) && aMedian <= maxXValue && (
                        <ReferenceLine
                          x={aMedian}
                          stroke={strokeA}
                          strokeDasharray="4 4"
                        />
                      )}
                      {Number.isFinite(bMedian) && bMedian <= maxXValue && (
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
