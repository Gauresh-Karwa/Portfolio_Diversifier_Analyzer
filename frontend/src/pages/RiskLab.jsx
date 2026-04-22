import React, { useState, useMemo } from "react";
import { toast } from "react-toastify";

// ─── Helper to generate distinct colors ───────────────────────────────────────
const COLORS = [
  "#3B82F6", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6", 
  "#EC4899", "#06B6D4", "#84CC16", "#6366F1", "#F97316"
];

function getColor(index) {
  return COLORS[index % COLORS.length];
}

// ─── Stock Movement Line Chart ────────────────────────────────────────────────
function MovementChart({ data }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  
  if (!data || !data.dates || data.dates.length === 0) return null;

  const { dates, series } = data;
  const tickers = Object.keys(series);
  
  const W = 800;
  const H = 350;
  const PAD_T = 20, PAD_B = 40, PAD_L = 50, PAD_R = 120; // Extra right pad for labels
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  // Find global min/max for Y axis
  let minVal = Infinity;
  let maxVal = -Infinity;
  tickers.forEach(ticker => {
    series[ticker].forEach(val => {
      if (val < minVal) minVal = val;
      if (val > maxVal) maxVal = val;
    });
  });

  // Add some padding to Y axis bounds
  minVal = Math.max(0, Math.floor(minVal * 0.9));
  maxVal = Math.ceil(maxVal * 1.1);
  const yRange = maxVal - minVal;

  const getX = (idx) => PAD_L + (idx / (dates.length - 1)) * innerW;
  const getY = (val) => PAD_T + innerH - ((val - minVal) / yRange) * innerH;

  const buildPath = (values) => {
    return values.map((val, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(val)}`).join(" ");
  };

  return (
    <div className="relative w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-white rounded-xl">
        {/* Grid Lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((f, i) => {
          const y = PAD_T + innerH * f;
          const val = maxVal - (maxVal - minVal) * f;
          return (
            <g key={i}>
              <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="#f1f5f9" strokeWidth="1" />
              <text x={PAD_L - 10} y={y + 4} textAnchor="end" fontSize="10" fill="#94a3b8">
                {val.toFixed(0)}
              </text>
            </g>
          );
        })}

        {/* X Axis Labels (Start, Middle, End) */}
        <text x={PAD_L} y={H - 25} textAnchor="middle" fontSize="10" fill="#94a3b8">{dates[0]}</text>
        <text x={PAD_L + innerW / 2} y={H - 25} textAnchor="middle" fontSize="10" fill="#94a3b8">{dates[Math.floor(dates.length / 2)]}</text>
        <text x={PAD_L + innerW} y={H - 25} textAnchor="middle" fontSize="10" fill="#94a3b8">{dates[dates.length - 1]}</text>

        {/* Axis Titles */}
        <text x={PAD_L + innerW / 2} y={H - 5} textAnchor="middle" fontSize="12" fontWeight="bold" fill="#64748b">Timeline (1 Year)</text>
        <text x={15} y={H / 2} textAnchor="middle" fontSize="12" fontWeight="bold" fill="#64748b" transform={`rotate(-90, 15, ${H / 2})`}>Normalized Value (Base 100)</text>

        {/* Base 100 Line */}
        <line x1={PAD_L} y1={getY(100)} x2={W - PAD_R} y2={getY(100)} stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4 4" />

        {/* Lines */}
        {tickers.map((ticker, idx) => {
          const isHovered = hoveredIdx === idx;
          const isFaded = hoveredIdx !== null && !isHovered;
          const path = buildPath(series[ticker]);
          const lastVal = series[ticker][series[ticker].length - 1];
          const color = getColor(idx);
          
          return (
            <g key={ticker} 
               onMouseEnter={() => setHoveredIdx(idx)} 
               onMouseLeave={() => setHoveredIdx(null)}
               style={{ cursor: "pointer" }}>
              <path 
                d={path} 
                fill="none" 
                stroke={color} 
                strokeWidth={isHovered ? 3 : 1.5} 
                opacity={isFaded ? 0.2 : 0.9}
                style={{ transition: "all 0.2s" }}
              />
              {/* End Label */}
              <text 
                x={PAD_L + innerW + 10} 
                y={getY(lastVal) + 4} 
                fontSize="11" 
                fontWeight={isHovered ? "bold" : "normal"}
                fill={color}
                opacity={isFaded ? 0.2 : 1}
              >
                {ticker}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── Risk/Return Quadrant Scatter Plot ────────────────────────────────────────
function QuadrantChart({ data, avg }) {
  if (!data || data.length === 0 || !avg) return null;

  const [hovered, setHovered] = useState(null);

  const W = 600;
  const H = 450;
  const PAD = 50;
  const innerW = W - PAD * 2;
  const innerH = H - PAD * 2;

  // Determine axis bounds
  let minRisk = Infinity, maxRisk = -Infinity;
  let minRet = Infinity, maxRet = -Infinity;

  data.forEach(d => {
    if (d.risk < minRisk) minRisk = d.risk;
    if (d.risk > maxRisk) maxRisk = d.risk;
    if (d.return < minRet) minRet = d.return;
    if (d.return > maxRet) maxRet = d.return;
  });

  // Include portfolio average in bounds
  minRisk = Math.min(minRisk, avg.risk);
  maxRisk = Math.max(maxRisk, avg.risk);
  minRet = Math.min(minRet, avg.return);
  maxRet = Math.max(maxRet, avg.return);

  // Add padding to bounds
  minRisk = Math.max(0, minRisk * 0.8);
  maxRisk *= 1.2;
  minRet = minRet > 0 ? minRet * 0.5 : minRet * 1.5;
  maxRet *= 1.2;

  const riskRange = maxRisk - minRisk;
  const retRange = maxRet - minRet;

  const getX = (risk) => PAD + ((risk - minRisk) / riskRange) * innerW;
  const getY = (ret) => PAD + innerH - ((ret - minRet) / retRange) * innerH;

  const crossX = getX(avg.risk);
  const crossY = getY(avg.return);

  return (
    <div className="relative w-full overflow-hidden flex flex-col items-center">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-2xl bg-white rounded-xl shadow-sm border border-gray-100">
        
        {/* Quadrant Backgrounds */}
        <rect x={PAD} y={PAD} width={crossX - PAD} height={crossY - PAD} fill="#ecfdf5" opacity="0.5" /> {/* Top Left: Low Risk, High Ret */}
        <rect x={crossX} y={PAD} width={W - PAD - crossX} height={crossY - PAD} fill="#fef2f2" opacity="0.5" /> {/* Top Right: High Risk, High Ret */}
        <rect x={PAD} y={crossY} width={crossX - PAD} height={H - PAD - crossY} fill="#f8fafc" opacity="0.5" /> {/* Bottom Left: Low Risk, Low Ret */}
        <rect x={crossX} y={crossY} width={W - PAD - crossX} height={H - PAD - crossY} fill="#fffbeb" opacity="0.5" /> {/* Bottom Right: High Risk, Low Ret */}

        {/* Quadrant Labels */}
        <text x={PAD + 10} y={PAD + 20} fontSize="12" fontWeight="bold" fill="#10b981" opacity="0.6">Ideal (Low Risk, High Return)</text>
        <text x={W - PAD - 10} y={PAD + 20} fontSize="12" fontWeight="bold" fill="#ef4444" opacity="0.6" textAnchor="end">High Risk, High Return</text>
        <text x={PAD + 10} y={H - PAD - 10} fontSize="12" fontWeight="bold" fill="#64748b" opacity="0.6">Low Risk, Low Return</text>
        <text x={W - PAD - 10} y={H - PAD - 10} fontSize="12" fontWeight="bold" fill="#f59e0b" opacity="0.6" textAnchor="end">Worst (High Risk, Low Return)</text>

        {/* Axes */}
        <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="#94a3b8" strokeWidth="2" />
        <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="#94a3b8" strokeWidth="2" />
        <text x={W / 2} y={H - 10} textAnchor="middle" fontSize="12" fontWeight="bold" fill="#64748b">Annualized Volatility (Risk) %</text>
        <text x={15} y={H / 2} textAnchor="middle" fontSize="12" fontWeight="bold" fill="#64748b" transform={`rotate(-90, 15, ${H / 2})`}>Annualized Return %</text>

        {/* Zero Return Line if visible */}
        {minRet < 0 && maxRet > 0 && (
          <line x1={PAD} y1={getY(0)} x2={W - PAD} y2={getY(0)} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4 4" />
        )}

        {/* Crosshairs (Portfolio Average) */}
        <line x1={crossX} y1={PAD} x2={crossX} y2={H - PAD} stroke="#6366f1" strokeWidth="2" strokeDasharray="5 5" />
        <line x1={PAD} y1={crossY} x2={W - PAD} y2={crossY} stroke="#6366f1" strokeWidth="2" strokeDasharray="5 5" />
        
        {/* Points */}
        {data.map((d, i) => {
          const cx = getX(d.risk);
          const cy = getY(d.return);
          // Bubble size based on weight (min 5, max 20)
          const r = Math.max(5, Math.min(25, d.weight * 0.5));
          const color = getColor(i);
          const isHov = hovered === i;

          return (
            <g key={i} 
               onMouseEnter={() => setHovered(i)}
               onMouseLeave={() => setHovered(null)}
               style={{ cursor: "pointer" }}>
              <circle 
                cx={cx} 
                cy={cy} 
                r={isHov ? r + 2 : r} 
                fill={color} 
                opacity={isHov ? 0.9 : 0.6} 
                stroke={isHov ? "#1e293b" : "white"} 
                strokeWidth="2" 
                style={{ transition: "all 0.2s" }}
              />
              <text 
                x={cx} 
                y={cy - r - 5} 
                textAnchor="middle" 
                fontSize="10" 
                fontWeight={isHov ? "bold" : "normal"}
                fill={isHov ? "#1e293b" : "#64748b"}
              >
                {d.ticker}
              </text>
            </g>
          );
        })}

        {/* Portfolio Average Point */}
        <circle cx={crossX} cy={crossY} r="6" fill="#6366f1" stroke="white" strokeWidth="2" />
        <text x={crossX + 10} y={crossY - 10} fontSize="11" fontWeight="bold" fill="#6366f1">Portfolio Avg</text>
      </svg>

      {/* Tooltip Overlay */}
      {hovered !== null && (
        <div className="absolute top-4 right-4 bg-white border border-gray-200 rounded-lg p-3 shadow-lg pointer-events-none text-xs">
          <div className="font-bold text-gray-800 mb-1 flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getColor(hovered) }}></div>
            {data[hovered].ticker}
          </div>
          <div className="text-gray-600 grid grid-cols-2 gap-x-4 gap-y-1">
            <span>Return:</span> <span className="font-semibold text-right">{data[hovered].return}%</span>
            <span>Risk (Vol):</span> <span className="font-semibold text-right">{data[hovered].risk}%</span>
            <span>Weight:</span> <span className="font-semibold text-right">{data[hovered].weight}%</span>
          </div>
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function RiskLab({ investments }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const runRiskLab = async () => {
    if (!investments?.length) {
      toast.error("Add investments first.");
      return;
    }
    setLoading(true);
    
    // Ensure we send valid types to FastAPI (Pydantic strictly requires lists of strings and floats)
    const user_stocks = investments.map(inv => {
      const n = (inv.name || "").trim().toUpperCase();
      return n.endsWith(".NS") ? n : n + ".NS";
    });
    
    // investments[].amount stores the total invested value
    // We set qty to 1.0 and buy_prices to the total value to get proper weighting logic
    const qty = investments.map(() => 1.0);
    const bp = investments.map(inv => {
      const val = parseFloat(inv.amount);
      return isNaN(val) ? 0.0 : val;
    });

    try {
      const res = await fetch("http://localhost:8000/risk-analysis", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ user_stocks: user_stocks, quantities: qty, buy_prices: bp }),
      });
      const result = await res.json();
      
      if (!res.ok || result.error) {
        toast.error(result.error || result.detail || "Analysis failed.");
      } else {
        setData(result);
        toast.success("Risk & Return analysis complete!");
      }
    } catch {
      toast.error("Failed to run Risk & Return Analytics.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Risk & Return Analytics</h2>
          <p className="text-sm text-gray-500 mt-1">Advanced Exploratory Data Analysis for your portfolio.</p>
        </div>
        <button 
          onClick={runRiskLab} 
          disabled={loading}
          className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-indigo-700 transition flex items-center gap-2 shadow-lg shadow-indigo-100"
        >
          {loading ? (
            <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Analyzing...</>
          ) : (
            <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>Run EDA</>
          )}
        </button>
      </div>

      {/* Empty State */}
      {!data && !loading && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-3xl p-16 text-center">
            <div className="w-20 h-20 bg-white rounded-2xl shadow-sm flex items-center justify-center mx-auto mb-6">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>
            </div>
            <h3 className="text-xl font-bold text-indigo-900">Generate Visual Insights</h3>
            <p className="text-sm text-indigo-600 mt-2 max-w-md mx-auto">Click "Run EDA" to fetch the last 1 year of daily price data and visualize risk/return quadrants and stock movement trends.</p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="bg-white border border-gray-100 rounded-3xl p-16 text-center shadow-sm">
            <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mx-auto mb-6"></div>
            <h3 className="text-lg font-bold text-gray-800">Processing Data...</h3>
            <p className="text-sm text-gray-400 mt-2">Fetching live market data and calculating annualized metrics.</p>
        </div>
      )}

      {/* Data View */}
      {data && !loading && (
        <div className="space-y-8 animate-in fade-in duration-700">
          
          {/* Risk/Return Quadrant */}
          <div className="bg-white border border-gray-100 rounded-3xl p-6 md:p-8 shadow-sm">
            <div className="mb-6">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>
                Risk / Return Quadrant
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Visualizes the trade-off between risk (volatility) and reward (annualized return). The dashed lines represent your portfolio's weighted average. Bubble size indicates investment weight.
              </p>
            </div>
            <QuadrantChart data={data.quadrant_data} avg={data.portfolio_avg} />
          </div>

          {/* Stock Movements */}
          <div className="bg-white border border-gray-100 rounded-3xl p-6 md:p-8 shadow-sm">
            <div className="mb-6">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                Normalized Stock Movements (1Y)
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Compares how your individual holdings have trended over the past year. All stocks are rebased to 100 at the start of the period. Hover over a line to highlight it.
              </p>
            </div>
            <MovementChart data={data.movements} />
          </div>

        </div>
      )}
    </div>
  );
}
