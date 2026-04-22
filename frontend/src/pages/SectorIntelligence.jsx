import React, { useState } from "react";
import { toast } from "react-toastify";

// ─── Sector colour palette ───────────────────────────────────────────────────
const SECTOR_COLORS = {
  "Financial Services": "#3B82F6",
  "Technology":         "#8B5CF6",
  "Healthcare":         "#10B981",
  "Energy":             "#F59E0B",
  "Consumer Defensive": "#EC4899",
  "Consumer Cyclical":  "#F97316",
  "Industrials":        "#06B6D4",
  "Basic Materials":    "#84CC16",
  "Real Estate":        "#A78BFA",
  "Utilities":          "#FB7185",
  "Communication Services": "#34D399",
  "Unknown":            "#94A3B8",
};

const RISK_COLORS = { LOW: "#10B981", MEDIUM: "#F59E0B", HIGH: "#EF4444" };

function getSectorColor(sector) {
  return SECTOR_COLORS[sector] ?? "#94A3B8";
}

// ─── Squarified Treemap ──────────────────────────────────────────────────────
function squarify(items, x, y, w, h, result = []) {
  if (!items.length || w <= 0 || h <= 0) return result;
  const total = items.reduce((s, i) => s + i.value, 0);
  if (total === 0) return result;

  const isH = w >= h;
  let row = [], worst = Infinity;

  for (let i = 0; i < items.length; i++) {
    const candidate = [...row, items[i]];
    const rTotal = candidate.reduce((s, it) => s + it.value, 0);
    const rFrac  = rTotal / total;
    const rLen   = (isH ? w : h) * rFrac;
    const cross  = isH ? h : w;
    let maxR = 0;
    for (const it of candidate) {
      const itLen = cross * (it.value / rTotal);
      maxR = Math.max(maxR, Math.max(rLen / itLen, itLen / rLen));
    }
    if (maxR <= worst) { row = candidate; worst = maxR; }
    else break;
  }

  const rTotal = row.reduce((s, it) => s + it.value, 0);
  const rFrac  = rTotal / total;
  const rLen   = (isH ? w : h) * rFrac;
  let pos = isH ? y : x;

  for (const it of row) {
    const cross = (isH ? h : w) * (it.value / rTotal);
    result.push({
      ...it,
      x: isH ? x   : pos,
      y: isH ? pos : y,
      w: isH ? rLen : cross,
      h: isH ? cross : rLen,
    });
    pos += cross;
  }

  const remaining = items.slice(row.length);
  if (remaining.length) {
    if (isH) squarify(remaining, x + rLen, y, w - rLen, h, result);
    else     squarify(remaining, x, y + rLen, w, h - rLen, result);
  }
  return result;
}

// ─── Treemap component ───────────────────────────────────────────────────────
function SectorTreemap({ sectorData }) {
  const [hovered, setHovered] = useState(null);
  const W = 800, H = 380, PAD = 3;

  const items = sectorData
    .filter(s => s.value > 0)
    .map(s => ({ label: s.sector, value: s.value, pct: s.weight_pct }));

  const cells = squarify([...items].sort((a, b) => b.value - a.value), 0, 0, W, H);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-2xl" style={{ height: 380 }}>
        {cells.map((cell, i) => {
          const color = getSectorColor(cell.label);
          const minD  = Math.min(cell.w, cell.h);
          const isHov = hovered === i;
          return (
            <g key={i} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
              <rect
                x={cell.x + PAD} y={cell.y + PAD}
                width={Math.max(0, cell.w - PAD * 2)} height={Math.max(0, cell.h - PAD * 2)}
                rx={8} fill={color} opacity={isHov ? 1 : 0.84}
                style={{ transition: "opacity .18s, filter .18s", cursor: "pointer",
                  filter: isHov ? "brightness(1.18) drop-shadow(0 4px 12px rgba(0,0,0,.25))" : "none" }}
              />
              {minD > 55 && (
                <text x={cell.x + cell.w / 2} y={cell.y + cell.h / 2 - (minD > 80 ? 8 : 0)}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize={Math.min(13, Math.max(8, minD / 7))} fontWeight="700" fill="white"
                  style={{ pointerEvents: "none", textShadow: "0 1px 4px rgba(0,0,0,.5)" }}>
                  {cell.label.length > 15 ? cell.label.slice(0, 13) + "…" : cell.label}
                </text>
              )}
              {minD > 85 && (
                <text x={cell.x + cell.w / 2} y={cell.y + cell.h / 2 + 13}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize={Math.min(12, Math.max(8, minD / 9))} fontWeight="600"
                  fill="rgba(255,255,255,.82)" style={{ pointerEvents: "none" }}>
                  {cell.pct}%
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {hovered !== null && cells[hovered] && (
        <div className="absolute bottom-3 left-3 bg-white border border-gray-100 rounded-xl shadow-xl p-3 text-xs min-w-[160px] pointer-events-none z-10">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: getSectorColor(cells[hovered].label) }} />
            <span className="font-bold text-gray-800">{cells[hovered].label}</span>
          </div>
          <div className="text-gray-500">₹{cells[hovered].value.toLocaleString("en-IN")}</div>
          <div className="font-bold mt-0.5" style={{ color: getSectorColor(cells[hovered].label) }}>
            {cells[hovered].pct}% of portfolio
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sector Ring (Donut) ─────────────────────────────────────────────────────
function SectorRing({ sectorData }) {
  const [hovered, setHovered] = useState(null);
  const cx = 110, cy = 110, r = 85, inner = 52;
  const total = sectorData.reduce((s, d) => s + d.value, 0);
  let cumAngle = -90;

  const slices = sectorData.filter(d => d.value > 0).map(d => {
    const angle = (d.value / total) * 360;
    const start = cumAngle;
    cumAngle += angle;
    const toR = deg => (deg * Math.PI) / 180;
    const x1 = cx + r * Math.cos(toR(start)), y1 = cy + r * Math.sin(toR(start));
    const x2 = cx + r * Math.cos(toR(start + angle)), y2 = cy + r * Math.sin(toR(start + angle));
    const ix1 = cx + inner * Math.cos(toR(start)), iy1 = cy + inner * Math.sin(toR(start));
    const ix2 = cx + inner * Math.cos(toR(start + angle)), iy2 = cy + inner * Math.sin(toR(start + angle));
    const large = angle > 180 ? 1 : 0;
    return { ...d, d: `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${inner} ${inner} 0 ${large} 0 ${ix1} ${iy1} Z` };
  });

  const hov = hovered !== null ? slices[hovered] : null;

  return (
    <div className="flex flex-col items-center gap-4">
      <svg width={220} height={220} viewBox="0 0 220 220">
        {slices.map((s, i) => (
          <path key={i} d={s.d} fill={getSectorColor(s.sector)}
            opacity={hovered === null || hovered === i ? (hovered === i ? 1 : 0.85) : 0.4}
            style={{ transition: "opacity .2s", cursor: "pointer" }}
            onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
            <title>{s.sector}: {s.weight_pct}%</title>
          </path>
        ))}
        <circle cx={cx} cy={cy} r={inner} fill="white" />
        {hov ? (
          <>
            <text x={cx} y={cy - 8} textAnchor="middle" fontSize="13" fontWeight="700" fill={getSectorColor(hov.sector)}>
              {hov.weight_pct}%
            </text>
            <text x={cx} y={cy + 8} textAnchor="middle" fontSize="8" fill="#6B7280">
              {hov.sector.length > 14 ? hov.sector.slice(0, 12) + "…" : hov.sector}
            </text>
          </>
        ) : (
          <>
            <text x={cx} y={cy - 5} textAnchor="middle" fontSize="11" fontWeight="700" fill="#374151">Sectors</text>
            <text x={cx} y={cy + 10} textAnchor="middle" fontSize="10" fill="#9CA3AF">{slices.length}</text>
          </>
        )}
      </svg>

      <div className="grid grid-cols-2 gap-x-5 gap-y-1.5 text-xs w-full max-w-[260px]">
        {slices.slice(0, 8).map((s, i) => (
          <div key={i} className="flex items-center gap-1.5 truncate">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: getSectorColor(s.sector) }} />
            <span className="text-gray-600 truncate">{s.sector}</span>
            <span className="ml-auto font-bold text-gray-800 flex-shrink-0">{s.weight_pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Risk Gauge ──────────────────────────────────────────────────────────────
function RiskGauge({ score, level }) {
  const color = RISK_COLORS[level] ?? "#94A3B8";
  const r = 52, circ = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={130} height={130} viewBox="0 0 130 130">
        <circle cx={65} cy={65} r={r} fill="none" stroke="#E5E7EB" strokeWidth={11} />
        <circle cx={65} cy={65} r={r} fill="none" stroke={color} strokeWidth={11}
          strokeDasharray={`${(score / 100) * circ} ${circ}`} strokeLinecap="round"
          transform="rotate(-90 65 65)" style={{ transition: "stroke-dasharray 1.2s ease" }} />
        <text x={65} y={60} textAnchor="middle" fontSize="24" fontWeight="800" fill={color}>{score}</text>
        <text x={65} y={76} textAnchor="middle" fontSize="10" fill="#9CA3AF">/100</text>
      </svg>
      <span className="text-xs font-bold px-3 py-1 rounded-full"
        style={{ background: `${color}18`, color }}>
        {level} CONCENTRATION RISK
      </span>
    </div>
  );
}

// ─── Industry Bar ────────────────────────────────────────────────────────────
function IndustryBars({ industryData }) {
  const max = industryData[0]?.weight_pct ?? 1;
  return (
    <div className="space-y-3">
      {industryData.slice(0, 8).map((ind, i) => (
        <div key={i}>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-600 font-medium truncate max-w-[70%]">{ind.industry}</span>
            <span className="font-bold text-gray-800 flex-shrink-0">{ind.weight_pct}%</span>
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${(ind.weight_pct / max) * 100}%`,
                background: `linear-gradient(90deg, #6366F1, #8B5CF6)` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function SectorIntelligencePage({ investments }) {
  const [sectorData, setSectorData] = useState(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");

  const runAnalysis = async () => {
    if (!investments?.length) { toast.error("Add investments first."); return; }
    setLoading(true); setError(""); setSectorData(null);

    const user_stocks = investments.map(inv => {
      const n = inv.name.trim().toUpperCase();
      return n.endsWith(".NS") ? n : n + ".NS";
    });
    const quantities  = investments.map(() => 1.0);
    const buy_prices  = investments.map(inv => inv.amount);

    try {
      const res  = await fetch("http://localhost:8000/sector-analysis", {
        method: "POST",
        headers: {
          Authorization:  `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ user_stocks, quantities, buy_prices }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.detail ?? "Sector analysis failed."); toast.error("Sector analysis failed."); }
      else { setSectorData(data); toast.success("Sector analysis complete!"); }
    } catch {
      setError("Could not connect to ML server."); toast.error("Connection error.");
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Sector Intelligence</h2>
          <p className="text-sm text-gray-500 mt-1">
            Detect hidden sector concentration risks that market-cap analysis misses.
          </p>
        </div>
        <button onClick={runAnalysis} disabled={loading}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition disabled:opacity-50 shadow-lg shadow-indigo-100 flex-shrink-0">
          {loading ? (
            <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Analysing…</>
          ) : (
            <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>Run Sector Analysis</>
          )}
        </button>
      </div>

      {/* ── Empty state ── */}
      {!sectorData && !loading && !error && (
        <div className="bg-gradient-to-br from-indigo-50 via-purple-50 to-blue-50 border border-indigo-100 rounded-2xl p-14 text-center">
          <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-white shadow-md flex items-center justify-center">
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="1.5" strokeLinecap="round">
              <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
          </div>
          <p className="text-lg font-bold text-indigo-800">Sector Intelligence Ready</p>
          <p className="text-sm text-indigo-500 mt-2 max-w-sm mx-auto">
            Map your portfolio across NSE industry sectors and detect hidden concentration risks in seconds.
          </p>
          <p className="text-xs text-indigo-400 mt-3">⏱ ~15–30 s — fetches live sector data from Yahoo Finance</p>
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="bg-white border border-gray-100 rounded-2xl p-16 flex flex-col items-center text-center shadow-sm gap-4">
          <div className="w-14 h-14 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-base font-bold text-gray-700">Fetching Sector Data…</p>
          <p className="text-sm text-gray-400 max-w-xs">
            Querying Yahoo Finance for sector & industry classification of each stock. This may take 15–30 seconds.
          </p>
        </div>
      )}

      {/* ── Error ── */}
      {error && !loading && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r=".5" fill="#DC2626"/></svg>
          <div>
            <p className="text-sm font-bold text-red-700">Analysis Failed</p>
            <p className="text-xs text-red-600 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* ── Results ── */}
      {sectorData && !loading && (
        <>
          {/* Risk Warnings */}
          {sectorData.warnings?.length > 0 && (
            <div className="rounded-2xl p-4 space-y-2"
              style={{ background: RISK_COLORS[sectorData.concentration_risk] + "12",
                border: `1.5px solid ${RISK_COLORS[sectorData.concentration_risk]}30` }}>
              <p className="text-xs font-bold uppercase tracking-widest"
                style={{ color: RISK_COLORS[sectorData.concentration_risk] }}>
                ⚠ Concentration Alerts
              </p>
              {sectorData.warnings.map((w, i) => (
                <p key={i} className="text-sm text-gray-700 flex items-start gap-2">
                  <span className="flex-shrink-0 mt-0.5">•</span>{w}
                </p>
              ))}
            </div>
          )}

          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Active Sectors",   val: sectorData.n_sectors,                    sub: "distinct sectors",        color: "#6366F1" },
              { label: "Top Sector",       val: sectorData.top_sector,                   sub: `${sectorData.top_sector_pct}% weight`, color: "#F59E0B" },
              { label: "HHI Index",        val: sectorData.herfindahl_index?.toFixed(3), sub: "<0.15 well diversified",  color: "#06B6D4" },
              { label: "Concentration",    val: sectorData.concentration_risk,           sub: "risk level",              color: RISK_COLORS[sectorData.concentration_risk] },
            ].map(({ label, val, sub, color }) => (
              <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
                <p className="text-xl font-bold mt-1 truncate" style={{ color }}>{val}</p>
                <p className="text-xs text-gray-400 mt-1">{sub}</p>
              </div>
            ))}
          </div>

          {/* Treemap + Ring */}
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Treemap */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Sector Treemap</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Box size proportional to portfolio weight</p>
                </div>
              </div>
              <SectorTreemap sectorData={sectorData.sector_data} />
            </div>

            {/* Risk Gauge + Ring */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col items-center gap-6">
              <div>
                <h3 className="text-sm font-bold text-gray-900 text-center mb-4">Diversification Score</h3>
                <RiskGauge score={sectorData.risk_score} level={sectorData.concentration_risk} />
              </div>
              <div className="w-full border-t border-gray-100 pt-4">
                <h3 className="text-sm font-bold text-gray-900 text-center mb-4">Sector Breakdown</h3>
                <SectorRing sectorData={sectorData.sector_data} />
              </div>
            </div>
          </div>

          {/* Industry Bars + Stock Table */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Industry bars */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h3 className="text-sm font-bold text-gray-900 mb-1">Top Industries</h3>
              <p className="text-xs text-gray-400 mb-4">Granular breakdown within sectors</p>
              <IndustryBars industryData={sectorData.industry_data} />
            </div>

            {/* Stock-level table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="text-sm font-bold text-gray-900">Holdings by Sector</h3>
                <p className="text-xs text-gray-400 mt-0.5">Each stock mapped to its sector & industry</p>
              </div>
              <div className="overflow-x-auto max-h-72 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      {["Stock", "Sector", "Industry", "Weight"].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {sectorData.stock_details.map((s, i) => (
                      <tr key={i} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-2.5 font-bold text-gray-800">{s.symbol}</td>
                        <td className="px-4 py-2.5">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                            style={{ background: getSectorColor(s.sector) + "18", color: getSectorColor(s.sector) }}>
                            <span className="w-1.5 h-1.5 rounded-full inline-block flex-shrink-0"
                              style={{ background: getSectorColor(s.sector) }} />
                            {s.sector === "Unknown" ? "—" : s.sector}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-gray-500 max-w-[140px] truncate">{s.industry === "Unknown" ? "—" : s.industry}</td>
                        <td className="px-4 py-2.5 font-bold text-gray-700">{s.weight_pct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* HHI explanation */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-xs text-blue-700 flex items-start gap-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" className="flex-shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r=".5" fill="#3B82F6"/></svg>
            <div>
              <span className="font-bold">Herfindahl-Hirschman Index (HHI):</span> Measures portfolio concentration.
              {" "}<strong>HHI &lt; 0.15</strong> = well diversified · <strong>0.15–0.25</strong> = moderate concentration · <strong>&gt; 0.25</strong> = highly concentrated.
              {" "}Your HHI is <strong>{sectorData.herfindahl_index?.toFixed(3)}</strong>.
            </div>
          </div>
        </>
      )}
    </div>
  );
}
