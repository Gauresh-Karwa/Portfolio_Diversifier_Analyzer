import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { handleSuccess } from "../utils";
import { ToastContainer, toast } from "react-toastify";
import SectorIntelligencePage from "./SectorIntelligence";
import RiskLab from "./RiskLab";

import { suggestTickers, isValidNseTicker, isVerifiedTicker } from "../data/nse_stocks";



// ─── Icons ────────────────────────────────────────────────────────────────────
const Icon = ({ d, size = 20, color = "currentColor", strokeWidth = 1.8 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const ICONS = {
  dashboard: "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10",
  upload: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M17 8l-5-5-5 5 M12 3v12",
  edit: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5 M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z",
  chart: "M18 20V10 M12 20V4 M6 20v-6",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  logout: "M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4 M16 17l5-5-5-5 M21 12H9",
  user: "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2 M12 11a4 4 0 100-8 4 4 0 000 8z",
  plus: "M12 5v14 M5 12h14",
  trash: "M3 6h18 M8 6V4h8v2 M19 6l-1 14H6L5 6",
  info: "M12 22a10 10 0 100-20 10 10 0 000 20z M12 8v4 M12 16h.01",
  check: "M20 6L9 17l-5-5",
  file: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8",
  star: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  menu: "M3 12h18 M3 6h18 M3 18h18",
  pie: "M21.21 15.89A10 10 0 118 2.83 M22 12A10 10 0 0012 2v10z",
  wave: "M2 6c.6 0 1.2.2 1.7.6.9.7 2.1.7 3 0 1.1-.8 2.4-.8 3.5 0 .9.7 2.1.7 3 0 1.1-.8 2.4-.8 3.5 0 .9.7 2.1.7 3 0 1.1-.8 2.4-.8 3.5 0 .5-.2 1-.6 1.4",
};

// ─── Equity-only categories (India NSE only) ──────────────────────────────────
const CATEGORIES = [
  "Large Cap",
  "Mid Cap",
  "Small Cap",
];

const CATEGORY_COLORS = {
  "Large Cap": "#3B82F6",
  "Mid Cap": "#8B5CF6",
  "Small Cap": "#EC4899",
};

// Ideal target allocation bands (%) within the equity portfolio
const IDEAL_BANDS = {
  "Large Cap": { min: 50, max: 75 },
  "Mid Cap": { min: 15, max: 35 },
  "Small Cap": { min: 5, max: 25 },
};

// ─── Sidebar nav ──────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard",         icon: "dashboard" },
  { key: "upload",    label: "Upload CSV",         icon: "upload" },
  { key: "manual",    label: "Manual Entry",       icon: "edit" },
  { key: "analysis",  label: "Analysis",           icon: "chart" },
  { key: "sectors",   label: "Sector Intelligence",icon: "pie" },
  { key: "risklab",   label: "Risk & Return Analytics", icon: "wave" },
  { key: "profile",   label: "Investor Profile",   icon: "user" },
];

// ─── CSV parser ───────────────────────────────────────────────────────────────
function parseCSV(text) {
  const delimiter = text.includes(";") ? ";" : (text.includes("\t") ? "\t" : ",");
  const lines = text.trim().split("\n");
  if (lines.length < 2) throw new Error("CSV must have a header row and at least one data row.");
  const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase().replace(/['"]/g, ""));

  const nameIdx = headers.findIndex(h => ["name", "investment", "stock", "fund", "symbol", "instrument", "ticker"].some(k => h.includes(k)));
  const amtIdx = headers.findIndex(h => ["amount", "value", "invested", "market value", "current value"].some(k => h.includes(k)));
  const qtyIdx = headers.findIndex(h => ["qty", "quantity", "shares"].some(k => h.includes(k)));
  const priceIdx = headers.findIndex(h => ["price", "buy", "avg", "cost"].some(k => h.includes(k)));
  const catIdx = headers.findIndex(h => ["category", "type", "cap"].some(k => h.includes(k)));

  if (nameIdx === -1) throw new Error("CSV must include an 'Investment' or 'Symbol' column.");
  if (amtIdx === -1 && (qtyIdx === -1 || priceIdx === -1))
    throw new Error("CSV must include an 'Amount' column OR 'Quantity' and 'Price' columns.");

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delimiter).map(c => c.trim().replace(/['"]/g, ""));
    if (cols.length < 2 || !cols[nameIdx]) continue;

    let amt = 0;
    if (amtIdx !== -1 && cols[amtIdx]) {
      amt = parseFloat(cols[amtIdx].replace(/[^0-9.]/g, ""));
    } else if (qtyIdx !== -1 && priceIdx !== -1) {
      const qty = parseFloat(cols[qtyIdx]?.replace(/[^0-9.]/g, "") || "0");
      const price = parseFloat(cols[priceIdx]?.replace(/[^0-9.]/g, "") || "0");
      amt = qty * price;
    }

    if (isNaN(amt) || amt <= 0) continue;
    rows.push({
      id: Date.now() + i, name: cols[nameIdx], amount: amt,
      category: catIdx !== -1 ? cols[catIdx] : ""
    });
  }
  if (rows.length === 0) throw new Error("No valid rows found. Check your CSV format.");
  return rows;
}

// Removed aiClassify and aiExplain as per user request to remove 'auto-detect AI'


// ─── Equity diversification analysis (rule-based) ────────────────────────────
function analyzePortfolio(investments) {
  const total = investments.reduce((s, i) => s + i.amount, 0);

  const alloc = { "Large Cap": 0, "Mid Cap": 0, "Small Cap": 0 };
  investments.forEach(inv => {
    const cat = CATEGORIES.includes(inv.category) ? inv.category : "Large Cap";
    alloc[cat] += inv.amount;
  });

  const pct = {};
  CATEGORIES.forEach(c => (pct[c] = total > 0 ? (alloc[c] / total) * 100 : 0));

  const activeBuckets = CATEGORIES.filter(c => alloc[c] > 0).length;
  const maxPct = Math.max(...Object.values(pct));

  // Diversified = all 3 NSE equity types present, no single type dominates > 75%
  const diversified = activeBuckets >= 3 && maxPct <= 75;

  // Risk level based on small-cap and mid-cap weight
  const smallPct = pct["Small Cap"];
  const midPct = pct["Mid Cap"];
  let riskLevel = "Medium";
  if (smallPct > 40 || (smallPct + midPct) > 65) riskLevel = "High";
  else if (pct["Large Cap"] >= 65) riskLevel = "Low";

  // Diversification score (0–100)
  // Base: ~33 pts per active bucket (max ~100)
  // Bonus: 15 pts per bucket within its ideal band
  // Penalty: -20 if any bucket > 80%, -10 if any > 65%
  let score = activeBuckets * 15;
  CATEGORIES.forEach(c => {
    const { min, max } = IDEAL_BANDS[c];
    if (pct[c] >= min && pct[c] <= max) score += 20;
  });
  if (maxPct > 80) score -= 20;
  else if (maxPct > 65) score -= 10;
  score = Math.max(0, Math.min(100, Math.round(score)));

  // Actionable warnings
  const warnings = [];
  if (alloc["Large Cap"] === 0) warnings.push("No Large Cap holdings — adds volatility to the portfolio.");
  if (alloc["Mid Cap"] === 0) warnings.push("No Mid Cap exposure — missing a key growth segment.");
  if (alloc["Small Cap"] === 0) warnings.push("No Small Cap — limited high-growth upside.");
  if (pct["Small Cap"] > 50) warnings.push("Small Cap exceeds 50% — very high concentration risk.");
  if (pct["Large Cap"] > 80) warnings.push("Large Cap exceeds 80% — portfolio may be overly conservative for equity.");

  return { total, alloc, pct, activeBuckets, diversified, riskLevel, score, warnings };
}

// ─── Equity recommendation engine (NSE only: Large/Mid/Small Cap) ────────────────
function getRecommendations(age, goal) {
  if (age < 30 && goal === "High returns") return [
    { category: "Small Cap", range: "30–40%", reason: "High growth potential; your young age means time to ride out volatility." },
    { category: "Mid Cap", range: "30–35%", reason: "Strong growth with moderate risk — a core growth driver." },
    { category: "Large Cap", range: "30–40%", reason: "Stability anchor; prevents extreme drawdowns." },
  ];
  if (age < 30 && goal === "Balanced growth") return [
    { category: "Large Cap", range: "45–55%", reason: "Stable core for long-term compounding." },
    { category: "Mid Cap", range: "25–35%", reason: "Growth driver with manageable risk." },
    { category: "Small Cap", range: "15–25%", reason: "Controlled high-upside exposure at a young age." },
  ];
  if (age < 30 && goal === "Capital safety") return [
    { category: "Large Cap", range: "65–75%", reason: "Blue-chip NSE stocks preserve capital best within equity." },
    { category: "Mid Cap", range: "15–25%", reason: "Moderate growth without excess risk." },
    { category: "Small Cap", range: "5–10%", reason: "Minimal exposure — volatility should be limited at this risk appetite." },
  ];
  if (age <= 45 && goal === "High returns") return [
    { category: "Large Cap", range: "40–50%", reason: "Core stability as financial responsibilities increase." },
    { category: "Mid Cap", range: "30–40%", reason: "Best risk-return trade-off for this age bracket." },
    { category: "Small Cap", range: "15–25%", reason: "Growth booster with a controlled allocation." },
  ];
  if (age <= 45 && goal === "Balanced growth") return [
    { category: "Large Cap", range: "50–60%", reason: "Reliable long-term NSE compounders form the backbone." },
    { category: "Mid Cap", range: "25–35%", reason: "Steady growth with moderate volatility." },
    { category: "Small Cap", range: "10–20%", reason: "Limited but meaningful high-growth exposure." },
  ];
  if (age <= 45 && goal === "Capital safety") return [
    { category: "Large Cap", range: "70–80%", reason: "Maximum equity stability with upside potential." },
    { category: "Mid Cap", range: "15–25%", reason: "Small growth push without high risk." },
    { category: "Small Cap", range: "0–5%", reason: "Avoid — too volatile for a capital safety goal." },
  ];
  if (age > 45 && goal === "High returns") return [
    { category: "Large Cap", range: "60–70%", reason: "Capital protection becomes more important now." },
    { category: "Mid Cap", range: "20–30%", reason: "Moderate growth within an acceptable risk range." },
    { category: "Small Cap", range: "5–10%", reason: "Very limited — volatility risk is high at this life stage." },
  ];
  // age > 45, capital safety (default)
  return [
    { category: "Large Cap", range: "75–85%", reason: "Focus on wealth preservation with blue-chip NSE equity." },
    { category: "Mid Cap", range: "10–20%", reason: "Small growth component with managed risk." },
    { category: "Small Cap", range: "0–5%", reason: "Avoid — capital safety is the priority." },
  ];
}

// ─── Donut chart ──────────────────────────────────────────────────────────────
function DonutChart({ pct, alloc }) {
  const entries = Object.entries(alloc).filter(([, v]) => v > 0);
  if (entries.length === 0) return <p className="text-xs text-gray-400 text-center py-6">No data</p>;
  const total = entries.reduce((s, [, v]) => s + v, 0);
  let cumAngle = -90;
  const cx = 80, cy = 80, r = 60, inner = 36;
  const slices = entries.map(([cat, val]) => {
    const angle = (val / total) * 360;
    const start = cumAngle;
    cumAngle += angle;
    const toRad = deg => (deg * Math.PI) / 180;
    const x1 = cx + r * Math.cos(toRad(start)), y1 = cy + r * Math.sin(toRad(start));
    const x2 = cx + r * Math.cos(toRad(start + angle)), y2 = cy + r * Math.sin(toRad(start + angle));
    const ix1 = cx + inner * Math.cos(toRad(start)), iy1 = cy + inner * Math.sin(toRad(start));
    const ix2 = cx + inner * Math.cos(toRad(start + angle)), iy2 = cy + inner * Math.sin(toRad(start + angle));
    const large = angle > 180 ? 1 : 0;
    return { cat, d: `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${inner} ${inner} 0 ${large} 0 ${ix1} ${iy1} Z` };
  });
  return (
    <div className="flex flex-col items-center gap-3">
      <svg width={160} height={160} viewBox="0 0 160 160">
        {slices.map(({ cat, d }) => (
          <path key={cat} d={d} fill={CATEGORY_COLORS[cat]} opacity={0.9}>
            <title>{cat}: {(pct[cat] || 0).toFixed(1)}%</title>
          </path>
        ))}
        <circle cx={cx} cy={cy} r={inner} fill="white" />
        <text x={cx} y={cy - 5} textAnchor="middle" fontSize="10" fill="#374151" fontWeight="600">Equity</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize="9" fill="#6B7280">{entries.length} types</text>
      </svg>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        {entries.map(([cat]) => (
          <div key={cat} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: CATEGORY_COLORS[cat] }} />
            <span style={{ color: '#4b5563' }}>{cat}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Bar chart with ideal band indicators ────────────────────────────────────
function BarChart({ pct }) {
  return (
    <div className="space-y-4">
      {CATEGORIES.map(cat => {
        const val = pct[cat] || 0;
        const { min, max } = IDEAL_BANDS[cat];
        const inBand = val >= min && val <= max && val > 0;
        const under = val > 0 && val < min;
        const over = val > max;
        return (
          <div key={cat}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-600 font-medium">{cat}</span>
              <span className="font-semibold" style={{ color: CATEGORY_COLORS[cat] }}>{val.toFixed(1)}%</span>
            </div>
            <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${Math.max(val, 0.5)}%`, background: CATEGORY_COLORS[cat] }} />
            </div>
            <div className="flex items-center gap-2 text-xs mt-0.5 text-gray-300">
              <span>Ideal: {min}–{max}%</span>
              {inBand && <span className="text-green-500 font-medium">✓ ideal range</span>}
              {under && <span className="text-amber-400 font-medium">↑ below ideal</span>}
              {over && <span className="text-red-400 font-medium">↑ above ideal</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Benchmark chart (Current vs Ideal) ──────────────────────────────────────
function BenchmarkChart({ pct, age, goal }) {
  const ideal = getRecommendations(parseInt(age), goal);

  return (
    <div className="space-y-4">
      {ideal.map(rec => {
        const current = pct[rec.category] || 0;
        const targetRange = rec.range.split("–").map(s => parseInt(s));
        const midTarget = (targetRange[0] + (targetRange[1] || targetRange[0])) / 2;

        return (
          <div key={rec.category} className="group">
            <div className="flex justify-between items-end mb-1">
              <span className="text-xs font-bold" style={{ color: '#374151' }}>{rec.category}</span>
              <div className="text-[10px] font-bold uppercase" style={{ color: '#9ca3af' }}>
                Now: {current.toFixed(1)}% | Plan: {rec.range}
              </div>
            </div>
            <div className="relative h-6 rounded-lg overflow-hidden border" style={{ backgroundColor: '#f3f4f6', borderColor: '#f3f4f6' }}>
              {/* Target Band Highlight */}
              <div
                className="absolute h-full border-x"
                style={{
                  left: `${targetRange[0]}%`,
                  width: `${(targetRange[1] || targetRange[0]) - targetRange[0]}%`,
                  backgroundColor: '#eff6ff',
                  borderColor: 'rgba(191, 219, 254, 0.3)'
                }}
              />
              {/* Current Progress Bar */}
              <div
                className="absolute h-full rounded-lg transition-all duration-1000 shadow-sm"
                style={{
                  width: `${Math.min(current, 100)}%`,
                  background: CATEGORY_COLORS[rec.category],
                  opacity: 0.85
                }}
              />
              {/* Mid-point Marker */}
              <div
                className="absolute h-full w-0.5"
                style={{ left: `${midTarget}%`, backgroundColor: 'rgba(96, 165, 250, 0.5)' }}
              />
            </div>
            <p className="text-[9px] mt-1 leading-tight" style={{ color: '#9ca3af' }}>{rec.reason}</p>
          </div>
        );
      })}
    </div>
  );
}

// ─── Score ring ───────────────────────────────────────────────────────────────
function ScoreRing({ score }) {
  const r = 44, c = 2 * Math.PI * r;
  const color = score >= 70 ? "#10B981" : score >= 40 ? "#F59E0B" : "#EF4444";
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={110} height={110} viewBox="0 0 110 110">
        <circle cx={55} cy={55} r={r} fill="none" stroke="#E5E7EB" strokeWidth={10} />
        <circle cx={55} cy={55} r={r} fill="none" stroke={color} strokeWidth={10}
          strokeDasharray={`${(score / 100) * c} ${c}`} strokeLinecap="round"
          transform="rotate(-90 55 55)" style={{ transition: "stroke-dasharray 1s ease" }} />
        <text x={55} y={52} textAnchor="middle" fontSize="22" fontWeight="700" fill={color}>{score}</text>
        <text x={55} y={68} textAnchor="middle" fontSize="10" fill="#6B7280">/100</text>
      </svg>
      <span className="text-xs font-semibold" style={{ color }}>
        {score >= 70 ? "Well Diversified" : score >= 40 ? "Moderate" : "Needs Work"}
      </span>
    </div>
  );
}

// ─── Backtest Chart ───────────────────────────────────────────────────────────
function BacktestChart({ dates, current, optimized, benchmark }) {
  const [hoverIdx, setHoverIdx] = React.useState(null);
  const svgRef = React.useRef(null);
  const W = 760, H = 300;
  const PAD = { top: 24, right: 24, bottom: 48, left: 64 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;
  const N = dates.length;
  if (!N) return null;

  const allVals = [...current, ...optimized, ...benchmark];
  const minV = Math.min(...allVals) * 0.985;
  const maxV = Math.max(...allVals) * 1.015;
  const vRange = maxV - minV || 1;

  const step = Math.max(1, Math.floor(N / 200));
  const idxArr = Array.from({ length: Math.ceil(N / step) }, (_, i) => Math.min(i * step, N - 1));

  const xS = i => (i / (N - 1)) * cW;
  const yS = v => cH - ((v - minV) / vRange) * cH;
  const toPath = arr => idxArr.map((i, k) => `${k === 0 ? 'M' : 'L'} ${xS(i).toFixed(1)} ${yS(arr[i]).toFixed(1)}`).join(' ');

  const yTickVals = Array.from({ length: 5 }, (_, i) => minV + (i / 4) * vRange);
  const xLabelIdxs = Array.from({ length: 6 }, (_, i) => Math.round(i * (N - 1) / 5));
  const series = [
    { key: 'current',   data: current,   color: '#F59E0B', label: 'Current Portfolio' },
    { key: 'optimized', data: optimized, color: '#6366F1', label: 'Optimised Portfolio' },
    { key: 'benchmark', data: benchmark, color: '#94A3B8', label: 'Nifty 50' },
  ];

  const pct = v => `${v >= 1 ? '+' : ''}${((v - 1) * 100).toFixed(2)}%`;
  const lastC = current[N - 1], lastO = optimized[N - 1], lastB = benchmark[N - 1];
  const edge = ((lastO / lastC) - 1) * 100;

  const handleMouseMove = (e) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const relX = (e.clientX - rect.left) * (W / rect.width) - PAD.left;
    setHoverIdx(Math.max(0, Math.min(N - 1, Math.round((relX / cW) * (N - 1)))));
  };

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Current Portfolio',   val: pct(lastC), color: '#D97706', bg: '#FFFBEB' },
          { label: 'Optimised Portfolio', val: pct(lastO), color: '#4F46E5', bg: '#EEF2FF' },
          { label: 'Nifty 50',            val: pct(lastB), color: '#64748B', bg: '#F8FAFC' },
          { label: 'AI Edge', val: `${edge >= 0 ? '+' : ''}${edge.toFixed(2)}%`, color: edge >= 0 ? '#059669' : '#DC2626', bg: edge >= 0 ? '#F0FDF4' : '#FEF2F2' },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-4 text-center" style={{ background: s.bg }}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">{s.label}</p>
            <p className="text-xl font-bold" style={{ color: s.color }}>{s.val}</p>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-6 mb-3">
        {series.map(s => (
          <div key={s.key} className="flex items-center gap-2">
            <div className="w-6 h-2 rounded-full" style={{ background: s.color }} />
            <span className="text-xs font-medium text-gray-500">{s.label}</span>
          </div>
        ))}
      </div>
      <div className="relative">
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: '300px', cursor: 'crosshair' }}
          onMouseMove={handleMouseMove} onMouseLeave={() => setHoverIdx(null)}>
          <defs>
            {series.map(s => (
              <linearGradient key={s.key} id={`bt-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity="0.12" />
                <stop offset="100%" stopColor={s.color} stopOpacity="0.01" />
              </linearGradient>
            ))}
          </defs>
          <g transform={`translate(${PAD.left},${PAD.top})`}>
            {yTickVals.map((v, i) => (
              <g key={i}>
                <line x1={0} y1={yS(v)} x2={cW} y2={yS(v)} stroke="#F1F5F9" strokeWidth={1} />
                <text x={-10} y={yS(v) + 4} textAnchor="end" fontSize="10" fill="#94A3B8">
                  {((v - 1) * 100).toFixed(0)}%
                </text>
              </g>
            ))}
            {minV <= 1 && maxV >= 1 && (
              <line x1={0} y1={yS(1)} x2={cW} y2={yS(1)} stroke="#CBD5E1" strokeWidth={1} strokeDasharray="4,4" />
            )}
            {series.map(s => (
              <path key={`a-${s.key}`} d={`${toPath(s.data)} L ${xS(N-1)} ${cH} L ${xS(0)} ${cH} Z`} fill={`url(#bt-${s.key})`} />
            ))}
            {series.map(s => (
              <path key={`l-${s.key}`} d={toPath(s.data)} fill="none" stroke={s.color} strokeWidth={2.5} strokeLinejoin="round" />
            ))}
            {xLabelIdxs.map(i => (
              <text key={i} x={xS(i)} y={cH + 18} textAnchor="middle" fontSize="10" fill="#94A3B8">{dates[i]?.slice(0, 7)}</text>
            ))}
            {hoverIdx !== null && (
              <>
                <line x1={xS(hoverIdx)} y1={0} x2={xS(hoverIdx)} y2={cH} stroke="#CBD5E1" strokeWidth={1} strokeDasharray="3,3" />
                {series.map(s => (
                  <circle key={s.key} cx={xS(hoverIdx)} cy={yS(s.data[hoverIdx])} r={4} fill={s.color} stroke="white" strokeWidth={2} />
                ))}
              </>
            )}
          </g>
        </svg>
        {hoverIdx !== null && (
          <div className="absolute top-2 right-2 bg-white border border-gray-100 rounded-xl shadow-lg p-3 text-xs space-y-1.5 min-w-[180px]">
            <p className="font-bold text-gray-500 mb-1">{dates[hoverIdx]}</p>
            {series.map(s => (
              <div key={s.key} className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ background: s.color }} />
                  <span className="text-gray-500">{s.label}</span>
                </span>
                <span className="font-bold" style={{ color: s.color }}>{pct(s.data[hoverIdx])}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function Home() {
  const [loggedInUser, setLoggedInUser] = useState("");
  const navigate = useNavigate();

  const [activeNav, setActiveNav] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [investments, setInvestments] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [recommendations, setRecommendations] = useState([]);

  const [csvDragOver, setCsvDragOver] = useState(false);
  const [csvFileName, setCsvFileName] = useState("");
  const [csvError, setCsvError] = useState("");
  const [csvLoading, setCsvLoading] = useState(false);
  const [manualRow, setManualRow] = useState({ name: "", amount: "", category: "" });
  const [manualError, setManualError] = useState("");
  const [age, setAge] = useState("");
  const [goal, setGoal] = useState("");
  const [profileSaved, setProfileSaved] = useState(false);


  // ── ML Backend States ──
  const [mlData, setMlData] = useState(null);
  const [mlLoading, setMlLoading] = useState(false);
  const [mlError, setMlError] = useState("");
  const [rawFile, setRawFile] = useState(null);
  const [investmentCash, setInvestmentCash] = useState("");

  // ── Backtest state ──
  const [btData, setBtData] = useState(null);
  const [btLoading, setBtLoading] = useState(false);
  const [btError, setBtError] = useState("");
  const [btPeriod, setBtPeriod] = useState("1y");

  // ── Ticker autocomplete state ──
  const [tickerSuggestions, setTickerSuggestions] = useState([]);
  const [tickerInvalid, setTickerInvalid] = useState(false);


  const fileInputRef = useRef();

  const [isInitializing, setIsInitializing] = useState(true);
  const [initialLoadSpinner, setInitialLoadSpinner] = useState(true);

  // ── Auth & Data Fetch on Load ──
  useEffect(() => {
    const initData = async () => {
      const token = localStorage.getItem("token");
      const user = localStorage.getItem("loggedinuser");

      if (!token || !user) {
        navigate("/login");
        return;
      }
      setLoggedInUser(user);

      try {
        const res = await fetch("http://localhost:8080/auth/portfolio", {
          headers: { "Authorization": `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success && data.portfolio) {
          if (data.portfolio.investments && data.portfolio.investments.length > 0) {
            setInvestments(data.portfolio.investments);
            setAnalysis(analyzePortfolio(data.portfolio.investments));
          }
          if (data.portfolio.age) setAge(data.portfolio.age);
          if (data.portfolio.goal) setGoal(data.portfolio.goal);
        }
      } catch (err) {
        console.error("Failed to sync portfolio", err);
      } finally {
        setIsInitializing(false);
        setInitialLoadSpinner(false);
      }
    };
    initData();
  }, [navigate]);

  // ── Auto-save Portfolio on Change ──
  useEffect(() => {
    if (isInitializing) return; // don't auto-save while fetching initial state

    const savePortfolio = async () => {
      const token = localStorage.getItem("token");
      if (!token) return;
      try {
        await fetch("http://localhost:8080/auth/portfolio", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ investments, age, goal })
        });
      } catch (err) {
        console.error("Auto-save failed:", err);
      }
    };

    // 1-second debounce to prevent spamming the database
    const timeoutId = setTimeout(savePortfolio, 1000);
    return () => clearTimeout(timeoutId);
  }, [investments, age, goal, isInitializing]);

  // Auto-analysis when reaching Analysis tab
  useEffect(() => {
    if (activeNav === "analysis" && investments.length > 0 && age && goal && !mlData && !mlLoading && !mlError) {
      handleFullAnalysis();
    }
  }, [activeNav, investments.length, age, goal]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("loggedinuser");
    handleSuccess("Successfully logged out");
    setTimeout(() => navigate("/login"), 1000);
  };

  // ── CSV ───────────────────────────────────────────────────────────────────
  const processCSVFile = async (file) => {
    if (!file) return;
    if (!file.name.endsWith(".csv")) { setCsvError("Please upload a .csv file."); return; }
    setCsvLoading(true); setCsvError("");
    setRawFile(file); // Store for ML backend
    try {
      const rows = parseCSV(await file.text());
      // Auto-classify AI removed. Defaulting to Large Cap for unknown categories happens in analysis logic.
      setInvestments(rows);
      setCsvFileName(file.name);
      toast.success(`Loaded ${rows.length} investments from ${file.name}`);
      setAnalysis(analyzePortfolio(rows));
      setActiveNav("analysis");
    } catch (e) {
      setCsvError(e.message);
    } finally { setCsvLoading(false); }

  };

  const onFileInput = e => processCSVFile(e.target.files[0]);
  const onDrop = e => { e.preventDefault(); setCsvDragOver(false); processCSVFile(e.dataTransfer.files[0]); };

  // ── Manual entry ──────────────────────────────────────────────────────────
  const handleAddManual = async () => {
    if (!manualRow.name.trim()) { setManualError("Please enter a ticker"); return; }
    const amt = parseFloat(manualRow.amount);
    if (isNaN(amt) || amt <= 0) { setManualError("Please enter a valid positive amount."); return; }

    const sym = manualRow.name.trim().toUpperCase().replace(".NS", "");
    if (!/^[a-zA-Z0-9-]+$/.test(sym)) {
      setTickerInvalid(true);
      setManualError("Ticker should only contain letters and hyphens e.g. BAJAJ-AUTO");
      return;
    }

    setManualError("");
    setTickerInvalid(false);
    setTickerSuggestions([]);
    let cat = manualRow.category || "Large Cap";
    const updated = [...investments, { id: Date.now(), name: manualRow.name.trim(), amount: amt, category: cat }];
    setInvestments(updated);
    setMlData(null);
    setManualRow({ name: "", amount: "", category: "" });
    toast.success(`Added: ${manualRow.name.trim()} → ${cat}`);
    setAnalysis(analyzePortfolio(updated));

  };

  const handleDelete = id => {
    const updated = investments.filter(i => i.id !== id);
    setInvestments(updated);
    setMlData(null); // Force ML re-analysis
    setAnalysis(updated.length > 0 ? analyzePortfolio(updated) : null);
  };

  // ── Unified Analysis Helper ──────────────────────────────────────────────
  const generateCSVBlob = (data) => {
    if (data.length === 0) return null;
    const header = "Investment Name,Amount,Category\n";
    const rows = data.map(r => `"${r.name}",${r.amount},"${r.category}"`).join("\n");
    return new Blob([header + rows], { type: "text/csv" });
  };

  // ── Full analysis ─────────────────────────────────────────────────

  const handleFullAnalysis = async () => {
    if (investments.length === 0) { toast.error("Add investments first."); return; }
    if (!age || !goal) { toast.error("Set your investor profile first."); setActiveNav("profile"); return; }

    setActiveNav("analysis");
    setMlData(null);


    // JS side analysis (still used for internal scoring)
    const result = analyzePortfolio(investments);
    setAnalysis(result);

    // Generate a fresh CSV blob from ALL current investments (CSV + Manual)
    const combinedBlob = generateCSVBlob(investments);
    if (combinedBlob) {
      await runMLAnalysis(combinedBlob);
    }

    const recs = getRecommendations(parseInt(age), goal);
    setRecommendations(recs);
    setBtData(null); // reset backtest when re-analysing
    toast.success("Analysis complete!");

  };

  const runMLAnalysis = async (blob) => {
    setMlLoading(true);
    setMlError("");

    const form = new FormData();
    // We send it as "file" so the backend doesn't have to change its logic
    form.append("file", blob, "portfolio.csv");
    form.append("new_cash", investmentCash || 0);
    form.append("age", age);
    form.append("goal", goal);

    try {
      const res = await fetch("http://localhost:8000/analyze", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: form,
      });

      if (res.status === 401) {
        toast.error("Session expired. Please log in again.");
        localStorage.removeItem("token");
        localStorage.removeItem("loggedinuser");
        setTimeout(() => navigate("/login"), 1500);
        return;
      }

      const data = await res.json();
      if (data.error) {
        setMlError(data.error);
        toast.error(`ML Analysis: ${data.error}`);
      } else {
        setMlData(data);
        console.log("ML Analysis Success:", data);
      }
    } catch (e) {
      setMlError("Could not connect to ML analysis server.");
      toast.error("ML Server connection failed. Is it running on port 8000?");
    } finally {
      setMlLoading(false);
    }
  };

  const totalValue = investments.reduce((s, i) => s + i.amount, 0);

  const handleDownloadPDF = async () => {
    if (!mlData) {
      toast.error("Please run the analysis first.");
      return;
    }
    
    try {
      toast.info("Generating Premium Analysis Report...", { autoClose: 3000 });

      const res = await fetch("http://localhost:8000/generate-report", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(mlData)
      });

      if (!res.ok) {
        throw new Error("Report generation failed");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "portfolio_rebalancing_report.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      toast.success("Premium Report Generated!");
    } catch (e) {
      console.error("PDF Generation Error:", e);
      toast.error("Failed to generate PDF. Check console for details.");
    }
  };

  // ── Run Backtest ──────────────────────────────────────────────────────────
  const runBacktest = async (period) => {
    const p = period || btPeriod;
    if (!mlData) { toast.error("Run the main analysis first."); return; }
    setBtLoading(true);
    setBtError("");
    setBtData(null);

    const user_stocks = investments.map(inv => {
      const n = inv.name.trim().toUpperCase();
      return n.endsWith(".NS") ? n : n + ".NS";
    });
    const quantities = investments.map(() => 1.0);
    const buy_prices = investments.map(inv => inv.amount);

    const target_weights = {};
    (mlData.rebalance_actions || []).forEach(a => {
      if ((a.target_weight_pct || 0) > 0) {
        const t = a.ticker || (a.symbol.endsWith(".NS") ? a.symbol : a.symbol + ".NS");
        target_weights[t] = a.target_weight_pct / 100;
      }
    });

    try {
      const res = await fetch("http://localhost:8000/backtest", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ user_stocks, quantities, buy_prices, target_weights, period: p }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBtError(data.detail || "Backtest failed.");
        toast.error("Backtest failed.");
      } else {
        setBtData(data);
      }
    } catch {
      setBtError("Could not connect to ML server.");
      toast.error("Backtest connection error.");
    } finally {
      setBtLoading(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ fontFamily: "'DM Sans','Segoe UI',sans-serif" }} className="min-h-screen bg-gray-50 flex flex-col">
      {initialLoadSpinner && (
        <div className="fixed inset-0 bg-white/90 z-[9999] flex flex-col items-center justify-center">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          <p className="mt-4 text-sm font-semibold text-gray-600">Loading your portfolio...</p>
        </div>
      )}

      {/* ── NAVBAR (unchanged) ── */}
      <nav className="bg-white border-b border-gray-200 px-4 md:px-8 py-3 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => setSidebarOpen(o => !o)} className="p-2 rounded-lg hover:bg-gray-100 transition text-gray-600 md:hidden">
            <Icon d={ICONS.menu} size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <Icon d={ICONS.chart} size={16} color="white" strokeWidth={2.2} />
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900 leading-none">Portfolio Dashboard</h1>
              <p className="text-xs text-gray-400 leading-none mt-0.5">Equity Diversification Analyzer</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {investments.length > 0 && age && goal && (
            <button onClick={handleFullAnalysis}
              className="hidden md:flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg font-medium transition">
              <Icon d={ICONS.star} size={15} color="white" strokeWidth={2} /> Analyze
            </button>
          )}
          <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2">
            <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
              <Icon d={ICONS.user} size={14} color="#3B82F6" strokeWidth={2} />
            </div>
            <span className="text-sm font-medium text-gray-700 hidden sm:block">{loggedInUser}</span>
          </div>
          <button onClick={handleLogout}
            className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 text-sm px-3 py-2 rounded-lg font-medium transition">
            <Icon d={ICONS.logout} size={15} color="#DC2626" strokeWidth={2} />
            <span className="hidden sm:block">Logout</span>
          </button>
        </div>
      </nav>

      <div className="flex flex-1 overflow-hidden">

        {/* ── SIDEBAR ── */}
        <aside className={`${sidebarOpen ? "w-56" : "w-0 md:w-16"} bg-white border-r border-gray-200 flex-shrink-0 transition-all duration-300 overflow-hidden flex flex-col py-4`}>
          <nav className="flex-1 px-2 space-y-1">
            {NAV_ITEMS.map(item => (
              <button key={item.key} onClick={() => setActiveNav(item.key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                  ${activeNav === item.key ? "bg-blue-50 text-blue-700 border border-blue-100" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"}`}>
                <div className={`flex-shrink-0 ${activeNav === item.key ? "text-blue-600" : "text-gray-400"}`}>
                  <Icon d={ICONS[item.icon]} size={18} strokeWidth={2} />
                </div>
                <span className={`${sidebarOpen ? "block" : "hidden"} whitespace-nowrap`}>{item.label}</span>
              </button>
            ))}
          </nav>
          {sidebarOpen && (
            <div className="px-3 pt-4 border-t border-gray-100 mt-2">
              <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700 space-y-1">
                <div className="font-semibold">Equity Portfolio</div>
                <div>{investments.length} investments · ₹{totalValue.toLocaleString("en-IN")}</div>
                {analysis && (
                  <div className={`font-semibold ${analysis.diversified ? "text-green-600" : "text-amber-500"}`}>
                    {analysis.diversified ? " Diversified" : "Needs Balance"}
                  </div>
                )}
              </div>
            </div>
          )}
        </aside>

        {/* ── MAIN ── */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">

          {/* ════ DASHBOARD ════ */}
          {activeNav === "dashboard" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Welcome back, {loggedInUser} 👋</h2>
                <p className="text-sm text-gray-500 mt-1">Analyze how well your equity is spread across Large Cap, Mid Cap, and Small Cap NSE stocks.</p>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: "Total Value", val: `₹${totalValue.toLocaleString("en-IN")}`, sub: "Equity invested", color: "#3B82F6" },
                  { label: "Investments", val: investments.length, sub: "Stocks / Funds", color: "#8B5CF6" },
                  { label: "Equity Types", val: analysis ? `${analysis.activeBuckets} / 4` : "— / 4", sub: "Active categories", color: "#06B6D4" },
                  { label: "Divers. Score", val: analysis ? `${analysis.score}/100` : "—", sub: "Higher = better", color: "#10B981" },
                ].map(({ label, val, sub, color }) => (
                  <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</p>
                    <p className="text-2xl font-bold mt-1" style={{ color }}>{val}</p>
                    <p className="text-xs text-gray-400 mt-1">{sub}</p>
                  </div>
                ))}
              </div>

              {/* Cash to invest input */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
                    <Icon d={ICONS.plus} size={20} color="#10B981" strokeWidth={2} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-800">New Investment Capital</h4>
                    <p className="text-xs text-gray-400">Add cash to see buy recommendations</p>

                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                    <input
                      type="number"
                      placeholder="e.g. 50000"
                      value={investmentCash}
                      onChange={(e) => setInvestmentCash(e.target.value)}
                      className="pl-7 pr-3 py-2 border border-gray-200 rounded-lg text-sm w-full sm:w-40 focus:outline-none focus:border-blue-400"
                    />
                  </div>
                  {investments.length > 0 && (
                    <button
                      onClick={handleFullAnalysis}
                      disabled={mlLoading}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition disabled:opacity-50">
                      Run Analysis
                    </button>
                  )}
                </div>
              </div>

              {/* Equity type guide */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Equity Categories & Ideal Allocation Bands</h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  {CATEGORIES.map(cat => (
                    <div key={cat} className="flex items-start gap-3 p-3 rounded-xl border border-gray-100">
                      <div className="w-3 h-3 rounded-full mt-1 flex-shrink-0" style={{ background: CATEGORY_COLORS[cat] }} />
                      <div>
                        <div className="text-sm font-semibold text-gray-800">{cat}</div>
                        <div className="text-xs text-gray-400">Ideal: {IDEAL_BANDS[cat].min}–{IDEAL_BANDS[cat].max}% of your equity portfolio</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick actions */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Get Started</h3>
                <div className="grid sm:grid-cols-3 gap-3">
                  {[
                    { key: "upload", label: "Upload CSV", icon: "upload", desc: "Import 100+ equity investments", color: "#3B82F6" },
                    { key: "manual", label: "Manual Entry", icon: "edit", desc: "Add stocks/funds one by one", color: "#8B5CF6" },
                    { key: "analysis", label: "View Analysis", icon: "chart", desc: "Explore risk & diversification", color: "#10B981" },
                  ].map(a => (
                    <button key={a.key} onClick={() => setActiveNav(a.key)}
                      className="flex items-start gap-3 p-4 rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50 transition text-left group">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${a.color}18` }}>
                        <Icon d={ICONS[a.icon]} size={18} color={a.color} strokeWidth={2} />
                      </div>
                      <div>
                        <div className="font-semibold text-sm text-gray-800 group-hover:text-blue-700">{a.label}</div>
                        <div className="text-xs text-gray-400">{a.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {investments.length === 0 && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 text-center">
                  <Icon d={ICONS.file} size={32} color="#93C5FD" strokeWidth={1.5} />
                  <p className="mt-3 text-sm font-semibold text-blue-700">No equity investments yet</p>
                  <p className="text-xs text-blue-500 mt-1">Upload a CSV or add entries manually to begin your equity analysis.</p>
                </div>
              )}
            </div>
          )}

          {/* ════ UPLOAD CSV ════ */}
          {activeNav === "upload" && (
            <div className="space-y-6 max-w-2xl">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Upload CSV</h2>
                <p className="text-sm text-gray-500 mt-1">Import your equity investments. Ensure your CSV has stock names and amounts.</p>
              </div>


              <div
                onDragOver={e => { e.preventDefault(); setCsvDragOver(true); }}
                onDragLeave={() => setCsvDragOver(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all
                  ${csvDragOver ? "border-blue-400 bg-blue-50" : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"}`}>
                <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={onFileInput} />
                <div className="flex flex-col items-center gap-3">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${csvDragOver ? "bg-blue-100" : "bg-gray-100"}`}>
                    <Icon d={ICONS.upload} size={28} color={csvDragOver ? "#3B82F6" : "#9CA3AF"} strokeWidth={1.8} />
                  </div>
                  {csvLoading ? (
                    <div>
                      <div className="text-sm font-semibold text-blue-600">
                        Reading CSV…
                      </div>
                      <div className="mt-2 w-40 h-1.5 bg-gray-200 rounded-full overflow-hidden mx-auto">
                        <div className="h-full bg-blue-500 rounded-full animate-pulse" style={{ width: "60%" }} />
                      </div>
                    </div>
                  ) : (

                    <>
                      <p className="font-semibold text-gray-700">Drag & drop your CSV here</p>
                      <p className="text-sm text-gray-400">or <span className="text-blue-600 underline">browse files</span></p>
                      {csvFileName && (
                        <div className="flex items-center gap-2 bg-green-50 text-green-700 text-sm px-3 py-2 rounded-lg">
                          <Icon d={ICONS.check} size={14} color="#059669" strokeWidth={2.5} /> {csvFileName} loaded
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {csvError && (
                <div className="flex items-start gap-2 bg-red-50 text-red-700 text-sm p-3 rounded-xl border border-red-200">
                  <Icon d={ICONS.info} size={16} color="#DC2626" strokeWidth={2} /> {csvError}
                </div>
              )}

              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Expected CSV Format</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50">
                        {["Investment Name", "Amount", "Category (optional)"].map(h => (
                          <th key={h} className="px-3 py-2 text-left text-gray-500 font-semibold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {[
                        ["RELIANCE", "2", "3000", "Large Cap"],
                        ["TCS", "5", "4200", ""],
                        ["HDFC Bank", "10", "1600", ""],
                      ].map((row, i) => (
                        <tr key={i}>
                          {row.map((cell, j) => (
                            <td key={j} className="px-3 py-2 text-gray-600 font-mono">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-gray-400 mt-3">
                  💡 Works with common broker exports (Instrument, Qty, Avg Price, etc).
                </p>
              </div>
            </div>
          )}

          {/* ════ MANUAL ENTRY ════ */}
          {activeNav === "manual" && (
            <div className="space-y-6 max-w-2xl">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Manual Entry</h2>
                <p className="text-sm text-gray-500 mt-1">Add equity investments one by one. Select a type or it will default to Large Cap.</p>
              </div>


              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="grid sm:grid-cols-3 gap-3">
                  <div className="relative">
                    <label className="text-xs text-gray-500 font-medium mb-1 block">NSE Stock Symbol *</label>
                    <input
                      className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none transition
                        ${tickerInvalid ? "border-red-400 focus:border-red-500" : "border-gray-200 focus:border-blue-400"}`}
                      placeholder="e.g. RELIANCE, TCS"
                      value={manualRow.name}
                      onChange={e => {
                        const val = e.target.value.toUpperCase();
                        setManualRow(r => ({ ...r, name: val }));
                        setTickerSuggestions(suggestTickers(val));
                        if (val !== "" && !/^[a-zA-Z0-9-]+$/.test(val)) {
                          setTickerInvalid(true);
                        } else {
                          setTickerInvalid(false);
                        }
                      }}

                      onBlur={() => setTimeout(() => setTickerSuggestions([]), 150)}
                      onKeyDown={e => e.key === "Enter" && handleAddManual()}
                    />
                    {/* Autocomplete dropdown */}
                    {tickerSuggestions.length > 0 && (
                      <ul className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                        {tickerSuggestions.map(sym => (
                          <li key={sym}
                            className="px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 cursor-pointer font-mono"
                            onMouseDown={() => {
                              setManualRow(r => ({ ...r, name: sym }));
                              setTickerSuggestions([]);
                              setTickerInvalid(false);
                            }}>
                            {sym}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium mb-1 block">Amount (₹) *</label>
                    <input type="number" min={0}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 transition"
                      placeholder="e.g. 25000"
                      value={manualRow.amount}
                      onChange={e => setManualRow(r => ({ ...r, amount: e.target.value }))}
                      onKeyDown={e => e.key === "Enter" && handleAddManual()} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium mb-1 block">Equity Type</label>
                    <select className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 transition bg-white"
                      value={manualRow.category}
                      onChange={e => setManualRow(r => ({ ...r, category: e.target.value }))}>
                      <option value="">Select Type (Default: Large Cap)</option>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}

                    </select>
                  </div>
                </div>
                {(manualError || tickerInvalid) && (
                  <div className="space-y-1">
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <Icon d={ICONS.info} size={13} color="#EF4444" strokeWidth={2} /> {manualError}
                    </p>
                  </div>
                )}
                <button onClick={handleAddManual}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition">
                  <Icon d={ICONS.plus} size={15} color="white" strokeWidth={2.5} /> Add
                </button>

              </div>

              {investments.length > 0 && (
                <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-700">{investments.length} Investments</h3>
                    <span className="text-xs text-gray-400">Total: ₹{totalValue.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>{["Name", "Amount", "Equity Type", ""].map(h => (
                          <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-gray-500">{h}</th>
                        ))}</tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {investments.map(inv => (
                          <tr key={inv.id} className="hover:bg-gray-50">
                            <td className="px-4 py-2 font-medium text-gray-800 max-w-[150px] truncate">{inv.name}</td>
                            <td className="px-4 py-2 text-gray-600">₹{inv.amount.toLocaleString("en-IN")}</td>
                            <td className="px-4 py-2">
                              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                                style={{ background: `${CATEGORY_COLORS[inv.category]}18`, color: CATEGORY_COLORS[inv.category] }}>
                                <div className="w-1.5 h-1.5 rounded-full" style={{ background: CATEGORY_COLORS[inv.category] }} />
                                {inv.category}
                              </span>
                            </td>
                            <td className="px-4 py-2">
                              <button onClick={() => handleDelete(inv.id)} className="text-gray-300 hover:text-red-500 transition p-1 rounded">
                                <Icon d={ICONS.trash} size={14} strokeWidth={2} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════ INVESTOR PROFILE ════ */}
          {activeNav === "profile" && (
            <div className="space-y-6 max-w-lg">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Investor Profile</h2>
                <p className="text-sm text-gray-500 mt-1">Your age and goal determine the ideal equity mix (Large Cap vs Mid Cap vs Small Cap).</p>
              </div>
              <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-5">
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-2">Your Age</label>
                  <input type="number" min={18} max={100}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400 transition"
                    placeholder="e.g. 28" value={age}
                    onChange={e => { setAge(e.target.value); setProfileSaved(false); setMlData(null); }} />
                  {age && (
                    <p className="text-xs text-gray-400 mt-1">
                      {parseInt(age) < 30 ? "Young — can hold more Small/Mid Cap equity"
                        : parseInt(age) <= 45 ? "Mid-career — balanced equity mix recommended"
                          : "Senior — lean towards Large Cap for stability"}
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-2">Investment Goal</label>
                  <div className="space-y-2">
                    {[
                      { val: "High returns", desc: "Aggressive — higher Small & Mid Cap weight" },
                      { val: "Balanced growth", desc: "Balanced — spread across all equity types" },
                      { val: "Capital safety", desc: "Conservative — heavy Large Cap focus" },
                    ].map(g => (
                      <button key={g.val} onClick={() => { setGoal(g.val); setProfileSaved(false); setMlData(null); }}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition
                          ${goal === g.val ? "border-blue-400 bg-blue-50" : "border-gray-200 hover:bg-gray-50"}`}>
                        <span className="text-xl">{g.emoji}</span>
                        <div className="flex-1">
                          <div className={`text-sm font-semibold ${goal === g.val ? "text-blue-700" : "text-gray-700"}`}>{g.val}</div>
                          <div className="text-xs text-gray-400">{g.desc}</div>
                        </div>
                        {goal === g.val && <Icon d={ICONS.check} size={16} color="#3B82F6" strokeWidth={2.5} />}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => { if (!age || !goal) { toast.error("Fill in all fields."); return; } setProfileSaved(true); toast.success("Profile saved!"); }}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold text-sm transition">
                  Save Profile
                </button>
                {profileSaved && (
                  <div className="flex items-center gap-2 text-green-600 text-sm justify-center">
                    <Icon d={ICONS.check} size={15} color="#059669" strokeWidth={2.5} /> Profile saved!
                  </div>
                )}
              </div>
              {age && goal && investments.length > 0 && (
                <button onClick={handleFullAnalysis}
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-semibold text-sm transition flex items-center justify-center gap-2">
                  <Icon d={ICONS.star} size={16} color="white" strokeWidth={2} /> Run Full Equity Analysis
                </button>
              )}
            </div>
          )}

          {/* ════ ANALYSIS ════ */}
          {activeNav === "analysis" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Portfolio Health Report</h2>
                <p className="text-sm text-gray-500 mt-1">Deep analysis powered by Modern Portfolio Theory and Mean-Variance Optimization.</p>
              </div>

              {!mlData && !analysis && !mlLoading ? (
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-8 text-center">
                  <p className="text-blue-700 font-bold text-base">Ready to Analyze</p>
                  <p className="text-blue-500 text-sm mt-1 mb-4">Complete your investor profile and upload your portfolio to unlock high-fidelity financial analysis.</p>

                  <button onClick={handleFullAnalysis} className="bg-blue-600 text-white px-6 py-2 rounded-xl text-sm font-bold shadow-lg shadow-blue-200">Start Analysis</button>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Status cards */}
                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Diversification</p>
                      <p className={`text-xl font-bold mt-1 ${analysis?.diversified ? "text-emerald-600" : "text-amber-500"}`}>
                        {analysis?.diversified ? "OPTIMAL" : "IMBALANCED"}
                      </p>
                    </div>
                    {mlData && (
                      <>
                        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Exp. Annual Return</p>
                          <div className="flex items-baseline gap-2 mt-1">
                            <p className="text-xl font-bold text-blue-600">{mlData.metrics.expected_annual_return_pct}%</p>
                            {mlData.pro_forma?.expected_annual_return_pct && (
                              <p className="text-xs font-bold text-green-500">→ {mlData.pro_forma.expected_annual_return_pct}%</p>
                            )}
                          </div>
                        </div>
                        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Annual Volatility</p>
                          <div className="flex items-baseline gap-2 mt-1">
                            <p className="text-xl font-bold text-indigo-600">{mlData.metrics.annual_volatility_pct}%</p>
                            {mlData.pro_forma?.annual_volatility_pct && (
                              <p className="text-xs font-bold text-emerald-500">→ {mlData.pro_forma.annual_volatility_pct}%</p>
                            )}
                          </div>
                        </div>
                        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Sharpe Ratio</p>
                          <div className="flex items-baseline gap-2 mt-1">
                            <p className="text-xl font-bold text-emerald-600">{mlData.metrics.sharpe_ratio}</p>
                            {mlData.pro_forma?.sharpe_ratio && (
                              <p className="text-xs font-bold text-green-500">→ {mlData.pro_forma.sharpe_ratio}</p>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Invalid ticker warning banner */}
                  {mlData?.invalid_tickers?.length > 0 && (
                    <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
                      <Icon d={ICONS.info} size={18} color="#D97706" strokeWidth={2} />
                      <div className="text-sm">
                        <p className="font-semibold text-amber-800">⚠️ Tickers excluded from analysis</p>
                        <p className="text-amber-700 mt-1">
                          Yahoo Finance could not fetch data for:{" "}
                          <span className="font-mono font-bold">
                            {[...new Set(mlData.invalid_tickers)].map(t => t.replace(".NS", "")).join(", ")}
                          </span>.
                          {" "}This is usually temporary (newer IPO stocks, delisted, or Yahoo Finance outage).
                          Verify on{" "}
                          <a href="https://www.nseindia.com/" target="_blank" rel="noreferrer"
                            className="underline text-amber-800 hover:text-amber-900">NSE India</a>.
                        </p>
                      </div>
                    </div>
                  )}


                  {mlLoading ? (
                    <div className="bg-white border border-gray-100 rounded-2xl p-12 shadow-sm flex flex-col items-center justify-center text-center">
                      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
                      <h3 className="text-lg font-bold text-gray-900">Analysis Engine is Running...</h3>

                      <p className="text-sm text-gray-500 mt-2 max-w-xs mx-auto">Calculating covariance matrices and optimizing your Sharpe ratio for the best risk-adjusted performance.</p>
                    </div>
                  ) : (
                    <>
                      <div className="grid md:grid-cols-2 gap-6">
                        <div id="donut-chart" className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm" style={{ backgroundColor: '#ffffff', borderColor: '#f3f4f6' }}>
                          <h3 className="text-sm font-bold mb-6 flex items-center gap-2" style={{ color: '#1f2937' }}>
                            Current Distribution
                          </h3>
                          <DonutChart pct={analysis?.pct || {}} alloc={analysis?.alloc || {}} />
                        </div>
                        <div id="benchmark-chart" className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm" style={{ backgroundColor: '#ffffff', borderColor: '#f3f4f6' }}>
                          <h3 className="text-sm font-bold mb-6 flex items-center gap-2" style={{ color: '#1f2937' }}>
                            Diversification Benchmark
                          </h3>
                          <BenchmarkChart pct={analysis?.pct || {}} age={age} goal={goal} />
                        </div>
                      </div>

                      {mlData && (
                        <>
                          {/* ── Strategist Analysis Panel ── */}
                          <div id="strategist-report" className="bg-gradient-to-br from-indigo-900 via-blue-900 to-indigo-950 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
                            <div className="relative z-10">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                                <div className="flex items-center gap-3">
                                  <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20">
                                    <Icon d={ICONS.user} size={22} color="#93C5FD" strokeWidth={1.5} />
                                  </div>
                                  <div>
                                    <h3 className="text-xl font-bold text-white tracking-tight">Strategist Analysis</h3>
                                    <p className="text-[10px] text-blue-300 font-bold uppercase tracking-widest">{age}yr · {goal}</p>
                                  </div>
                                </div>
                                <button onClick={handleDownloadPDF} className="bg-white/10 hover:bg-white/20 text-white text-sm font-bold py-2 px-4 rounded-xl transition flex items-center gap-2 border border-white/20">
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                  Download PDF
                                </button>
                              </div>
                              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm hover:bg-white/10 transition-all">
                                <p className="text-base text-blue-50 leading-relaxed font-medium italic opacity-95 whitespace-pre-line">
                                  {mlData.llm_recommendation}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* ── Rebalancing Action Plan ── */}
                          {mlData.rebalance_actions && mlData.rebalance_actions.length > 0 && (
                            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                              <div className="px-6 py-4 border-b border-gray-100">
                                <h3 className="text-base font-bold text-gray-900">Rebalancing Action Plan</h3>
                                <p className="text-xs text-gray-400 mt-0.5">
                                  {investmentCash > 0
                                    ? `Using ₹${Number(investmentCash).toLocaleString('en-IN')} new cash + sell proceeds to optimally rebalance`
                                    : 'Rebalancing using existing portfolio only — no new cash added'}
                                </p>
                              </div>

                              {/* Table */}
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead className="bg-gray-50">
                                    <tr>
                                      {['Stock', 'Action', 'Current Value', 'Target Value', 'Amount', 'Weight Change'].map(h => (
                                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-50">
                                    {mlData.rebalance_actions.map((a, i) => {
                                      const badgeStyle = a.action === 'BUY'
                                        ? { bg: '#dcfce7', text: '#166534' }
                                        : a.action === 'SELL'
                                          ? { bg: '#fee2e2', text: '#991b1b' }
                                          : { bg: '#f3f4f6', text: '#374151' };
                                      const wtDelta = (a.target_weight_pct - a.current_weight_pct).toFixed(1);
                                      return (
                                        <tr key={i} className="hover:bg-gray-50 transition-colors">
                                          <td className="px-4 py-3 font-bold text-gray-800">{a.symbol}</td>
                                          <td className="px-4 py-3">
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold"
                                              style={{ background: badgeStyle.bg, color: badgeStyle.text }}>
                                              {a.action}
                                            </span>
                                          </td>
                                          <td className="px-4 py-3 text-gray-600">₹{a.current_value.toLocaleString('en-IN')}</td>
                                          <td className="px-4 py-3 text-gray-600">₹{a.target_value.toLocaleString('en-IN')}</td>
                                          <td className="px-4 py-3 font-bold"
                                            style={{ color: a.action === 'BUY' ? '#16a34a' : a.action === 'SELL' ? '#dc2626' : '#6b7280' }}>
                                            {a.action !== 'HOLD' ? `₹${a.delta_rupees.toLocaleString('en-IN')}` : '—'}
                                          </td>
                                          <td className="px-4 py-3">
                                            <span className="text-xs font-bold"
                                              style={{ color: Number(wtDelta) > 0 ? '#16a34a' : Number(wtDelta) < 0 ? '#dc2626' : '#6b7280' }}>
                                              {Number(wtDelta) > 0 ? '+' : ''}{wtDelta}%
                                            </span>
                                            <div className="text-[10px] text-gray-400">
                                              {a.current_weight_pct}% → {a.target_weight_pct}%
                                            </div>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>

                              {/* Summary Cards */}
                              <div className="grid grid-cols-3 gap-4 px-6 py-4 bg-gray-50 border-t border-gray-100">
                                <div className="text-center">
                                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Sell Proceeds</p>
                                  <p className="text-lg font-bold text-red-600 mt-1">₹{(mlData.total_sell_proceeds || 0).toLocaleString('en-IN')}</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">New Cash</p>
                                  <p className="text-lg font-bold text-blue-600 mt-1">₹{Number(investmentCash || 0).toLocaleString('en-IN')}</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Total to Invest</p>
                                  <p className="text-lg font-bold text-emerald-600 mt-1">₹{(mlData.total_buy_cost || 0).toLocaleString('en-IN')}</p>
                                </div>
                              </div>

                              {/* Disclaimer note */}
                              <div className="px-6 py-3 border-t border-gray-100 flex items-start gap-2">
                                <Icon d={ICONS.info} size={14} color="#F59E0B" strokeWidth={2} />
                                <p className="text-xs text-gray-500 leading-relaxed">
                                  <span className="font-semibold text-gray-600">Execution note:</span> Sell orders should be executed first to free up capital before placing buy orders. Units are approximate based on current market price and may vary at execution.
                                </p>
                              </div>
                            </div>
                          )}
                          {/* ── Backtesting "What If" Panel ── */}
                          <div id="backtest-panel" className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                            {/* Header */}
                            <div className="px-6 py-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                              style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)" }}>
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
                                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#93C5FD" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                                  </svg>
                                </div>
                                <div>
                                  <h3 className="text-base font-bold text-white">Portfolio Backtesting</h3>
                                  <p className="text-[10px] text-blue-300 font-semibold uppercase tracking-widest mt-0.5">
                                    "What If" Historical Performance Analysis
                                  </p>
                                </div>
                              </div>
                              {/* Period selector + run button */}
                              <div className="flex items-center gap-2 flex-wrap">
                                {["6mo", "1y", "2y"].map(p => (
                                  <button key={p} onClick={() => { setBtPeriod(p); setBtData(null); }}
                                    className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all border"
                                    style={{
                                      background: btPeriod === p ? "rgba(99,102,241,0.9)" : "rgba(255,255,255,0.08)",
                                      color: btPeriod === p ? "#fff" : "#93C5FD",
                                      borderColor: btPeriod === p ? "rgba(99,102,241,0.6)" : "rgba(255,255,255,0.15)"
                                    }}>
                                    {p === "6mo" ? "6 Months" : p === "1y" ? "1 Year" : "2 Years"}
                                  </button>
                                ))}
                                <button
                                  onClick={() => runBacktest(btPeriod)}
                                  disabled={btLoading}
                                  className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all border disabled:opacity-50"
                                  style={{ background: "rgba(99,102,241,0.9)", color: "#fff", borderColor: "rgba(99,102,241,0.5)" }}>
                                  {btLoading ? (
                                    <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> Running...</>
                                  ) : (
                                    <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="5 3 19 12 5 21 5 3" /></svg> Run Backtest</>
                                  )}
                                </button>
                              </div>
                            </div>

                            {/* Body */}
                            <div className="p-6">
                              {!btData && !btLoading && !btError && (
                                <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                                  <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center">
                                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                                    </svg>
                                  </div>
                                  <p className="text-sm font-bold text-gray-700">See how the AI-optimized portfolio would have performed</p>
                                  <p className="text-xs text-gray-400 max-w-xs">
                                    Choose a lookback period and click <span className="font-semibold text-indigo-600">Run Backtest</span> to compare your current allocation vs the AI-recommended portfolio vs the Nifty 50 index.
                                  </p>
                                </div>
                              )}

                              {btLoading && (
                                <div className="flex flex-col items-center justify-center py-14 gap-4">
                                  <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                                  <p className="text-sm font-semibold text-gray-600">Fetching historical prices & computing cumulative returns…</p>
                                  <p className="text-xs text-gray-400">This may take 10–20 seconds (downloading NSE data via yfinance)</p>
                                </div>
                              )}

                              {btError && !btLoading && (
                                <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
                                  <Icon d={ICONS.info} size={18} color="#DC2626" strokeWidth={2} />
                                  <div>
                                    <p className="text-sm font-bold text-red-700">Backtest Failed</p>
                                    <p className="text-xs text-red-600 mt-1">{btError}</p>
                                  </div>
                                </div>
                              )}

                              {btData && !btLoading && (
                                <>
                                  {/* Insight banner */}
                                  {(() => {
                                    const lastC = btData.current[btData.current.length - 1];
                                    const lastO = btData.optimized[btData.optimized.length - 1];
                                    const lastB = btData.benchmark[btData.benchmark.length - 1];
                                    const edge = ((lastO / lastC) - 1) * 100;
                                    const beatsBench = lastO > lastB;
                                    return (
                                      <div className="rounded-xl p-4 mb-6 flex items-start gap-3"
                                        style={{ background: edge >= 0 ? "#f0fdf4" : "#fef2f2", border: `1px solid ${edge >= 0 ? "#bbf7d0" : "#fecaca"}` }}>
                                        <div className="text-2xl"></div>
                                        <div>
                                          <p className="text-sm font-bold" style={{ color: edge >= 0 ? "#166534" : "#991b1b" }}>
                                            {edge >= 0
                                              ? `AI Optimised portfolio outperformed your current allocation by ${edge.toFixed(2)}% over this period`
                                              : `Current portfolio performed ${Math.abs(edge).toFixed(2)}% better than the optimised mix over this period`}
                                          </p>
                                          <p className="text-xs mt-1" style={{ color: edge >= 0 ? "#166534" : "#991b1b" }}>
                                            {beatsBench
                                              ? "✓ The optimised portfolio also beat the Nifty 50 benchmark."
                                              : "The optimised portfolio underperformed the Nifty 50 — consider market timing."}
                                            {" "}Past performance does not guarantee future results.
                                          </p>
                                        </div>
                                      </div>
                                    );
                                  })()}
                                  <BacktestChart
                                    dates={btData.dates}
                                    current={btData.current}
                                    optimized={btData.optimized}
                                    benchmark={btData.benchmark}
                                  />
                                  <p className="text-[10px] text-gray-400 mt-4 text-center">
                                    Chart shows normalised cumulative returns (base = 1.00 at period start). Nifty 50 (^NSEI) used as benchmark. Data sourced from Yahoo Finance.
                                  </p>
                                </>
                              )}
                            </div>
                          </div>

                        </>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ════ SECTOR INTELLIGENCE ════ */}
          {activeNav === "sectors" && (
            <SectorIntelligencePage investments={investments} />
          )}

          {/* ════ WEALTH LAB ════ */}
          {activeNav === "risklab" && (
            <RiskLab investments={investments} />
          )}

          {/* ── DISCLAIMER ── */}
          <div className="mt-8 bg-gray-100 border border-gray-200 rounded-xl p-4 flex items-start gap-3">
            <Icon d={ICONS.shield} size={18} color="#6B7280" strokeWidth={1.8} />
            <p className="text-xs text-gray-500 leading-relaxed">
              <span className="font-semibold text-gray-600">Disclaimer:</span> This tool is for educational purposes only and does not constitute financial advice.
              Always consult a SEBI-registered investment advisor before making financial decisions.
            </p>
          </div>
        </main>
      </div>

      <ToastContainer position="bottom-right" autoClose={3000} hideProgressBar />
    </div>
  );
}