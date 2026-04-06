import pandas as pd
import numpy as np
import yfinance as yf
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from pypfopt import expected_returns, risk_models
from pypfopt.efficient_frontier import EfficientFrontier
import warnings
warnings.filterwarnings("ignore")

# ─── Diversifier Pool (High-performing Indian Sectors) ──────────────────────
DIVERSIFIER_POOL = [
    "HINDUNILVR.NS",  # FMCG
    "SUNPHARMA.NS",   # Pharma
    "BAJFINANCE.NS",  # Finance
    "HDFCBANK.NS",    # Banking
    "ONGC.NS",        # Energy
    "TATASTEEL.NS",   # Metals
    "JSWSTEEL.NS",    # Metals
    "TATAMOTORS.NS",  # Auto
    "MARUTI.NS",      # Auto
    "ASIANPAINT.NS",  # Consumer
    "TITAN.NS",       # Lifestyle
    "ITC.NS",         # Diversified
    "LT.NS",          # Infra
    "BEL.NS",         # Defense
    "HAL.NS",         # Defense
    "RVNL.NS",        # Railways
    "IREDA.NS",       # Renewable
    "ADANIENT.NS",    # Conglomerate
]

RISK_FREE_RATE = 0.07  # India SBI FD rate

def run_analysis(user_stocks: list[str], quantities: list[float], buy_prices: list[float], new_cash: float):
    """
    Core analysis pipeline.
    user_stocks: list of NSE symbols e.g. ['TCS.NS', 'INFY.NS']
    quantities:  number of shares held
    buy_prices:  price at which they were bought
    new_cash:    amount user wants to invest (can be 0)
    """

    # ── 1. Build current portfolio value ──────────────────────────────────────
    invested = [q * p for q, p in zip(quantities, buy_prices)]
    total_invested = sum(invested)
    allocation = {sym: val for sym, val in zip(user_stocks, invested)}

    # ── 2. Fetch live price data ───────────────────────────────────────────────
    # Filter out invalid symbols (placeholders like NSE_xxx)
    cleaned_user_stocks = [s for s in user_stocks if not s.startswith("NSE_")]
    all_symbols = list(set(cleaned_user_stocks) | set(DIVERSIFIER_POOL))

    try:
        raw = yf.download(all_symbols, period="2y", auto_adjust=True, progress=False)["Close"]
    except Exception:
        # Emergency fallback if Yahoo is totally down
        return {
            "portfolio_value": round(total_invested, 2),
            "allocation": allocation,
            "metrics": {"expected_annual_return_pct": 0, "annual_volatility_pct": 0, "sharpe_ratio": 0},
            "recommendations": {},
            "cluster_info": {},
            "missing_clusters": False,
            "error": "Market data currently unavailable."
        }

    # Handle single column edge case
    if isinstance(raw, pd.Series):
        raw = raw.to_frame(name=all_symbols[0] if all_symbols else "UNKNOWN")

    # Keep only columns that downloaded successfully
    raw = raw.dropna(axis=1, how="all")
    valid_symbols = list(raw.columns)

    # Forward fill missing days (Indian market holidays)
    raw = raw.ffill().dropna()

    # ── 3. Daily returns ───────────────────────────────────────────────────────
    returns = raw.pct_change().dropna()

    # ── 4. Feature Engineering for ML ─────────────────────────────────────────
    annual_return = returns.mean() * 252
    annual_volatility = returns.std() * np.sqrt(252)

    features = pd.DataFrame({
        "return": annual_return,
        "volatility": annual_volatility
    }).dropna()

    # ── 5. K-Means Clustering ─────────────────────────────────────────────────
    if len(features) < 2:
        # Not enough data for clustering
        features["cluster"] = 0
    else:
        scaler = StandardScaler()
        scaled = scaler.fit_transform(features)
        n_clusters = min(4, len(features))
        kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        features["cluster"] = kmeans.fit_predict(scaled)

    # ── 6. Find missing clusters in user portfolio ─────────────────────────────
    # Only consider valid user stocks (those that downloaded)
    valid_user_stocks = [s for s in user_stocks if s in features.index]
    user_clusters = set(features.loc[valid_user_stocks, "cluster"].tolist())
    all_clusters = set(features["cluster"].tolist())
    missing_clusters = all_clusters - user_clusters

    # ── 7. Candidate stocks from missing clusters ──────────────────────────────
    if missing_clusters:
        candidates = features[
            (features.index.isin(DIVERSIFIER_POOL)) &
            (features["cluster"].isin(missing_clusters))
        ].index.tolist()
    else:
        # All clusters covered — still recommend least correlated diversifiers
        candidates = features[features.index.isin(DIVERSIFIER_POOL)].index.tolist()

    # Need at least 2 candidates for optimization
    if len(candidates) < 2:
        candidates = [s for s in DIVERSIFIER_POOL if s in features.index][:4]

    # ── 8. Portfolio Optimization (Sharpe) ────────────────────────────────────
    rec_allocation = {}
    optimization_note = ""

    if new_cash > 0 and len(candidates) >= 2:
        try:
            # Shift extreme outliers clip to zero for stability
            mu = expected_returns.mean_historical_return(raw[candidates], frequency=252).clip(lower=0)
            S = risk_models.sample_cov(raw[candidates], frequency=252)

            # Constraint: No more than 40% in any one stock to ensure multiple options
            ef = EfficientFrontier(mu, S, weight_bounds=(0.0, 0.4))
            ef.max_sharpe(risk_free_rate=RISK_FREE_RATE)
            weights = ef.clean_weights()

            rec_allocation = {
                sym: round(weight * new_cash, 2)
                for sym, weight in weights.items()
                if weight > 0.05
            }
        except Exception as e:
            # Fallback: Top 3 by annual return
            optimization_note = f"Fallback optimization. Detail: {str(e)}"
            top_3 = annual_return[candidates].sort_values(ascending=False).head(3).index.tolist()
            per_stock = round(new_cash / len(top_3), 2)
            rec_allocation = {sym: per_stock for sym in top_3}

    # ── 9. Current Portfolio Risk/Return metrics ───────────────────────────────
    valid_held = [s for s in valid_user_stocks if s in returns.columns]
    if valid_held:
        held_returns = returns[valid_held]
        weights_held = np.array([allocation.get(s, 0) for s in valid_held])
        if weights_held.sum() > 0:
            weights_held = weights_held / weights_held.sum()

        port_return = float(np.dot(weights_held, annual_return[valid_held]) * 100)
        port_vol = float(np.sqrt(
            np.dot(weights_held, np.dot(returns[valid_held].cov() * 252, weights_held))
        ) * 100)
        sharpe = round((port_return / 100 - RISK_FREE_RATE) / (port_vol / 100), 2) if port_vol > 0 else 0
    else:
        port_return, port_vol, sharpe = 0, 0, 0

    # ── 10. Pro-forma (Projected) Metrics ──────────────────────────────────────
    pro_forma_metrics = {}
    if rec_allocation:
        # Build hypothetical allocation
        hypo_alloc = allocation.copy()
        for sym, amt in rec_allocation.items():
            hypo_alloc[sym] = hypo_alloc.get(sym, 0) + amt
        
        valid_hypo = [s for s in hypo_alloc.keys() if s in returns.columns]
        if valid_hypo:
            weights_hypo = np.array([hypo_alloc.get(s, 0) for s in valid_hypo])
            weights_hypo = weights_hypo / weights_hypo.sum()
            
            hypo_return = float(np.dot(weights_hypo, annual_return[valid_hypo]) * 100)
            hypo_vol = float(np.sqrt(
                np.dot(weights_hypo, np.dot(returns[valid_hypo].cov() * 252, weights_hypo))
            ) * 100)
            hypo_sharpe = round((hypo_return / 100 - RISK_FREE_RATE) / (hypo_vol / 100), 2) if hypo_vol > 0 else 0
            
            pro_forma_metrics = {
                "expected_annual_return_pct": round(hypo_return, 2),
                "annual_volatility_pct": round(hypo_vol, 2),
                "sharpe_ratio": hypo_sharpe
            }

    # ── 11. Cluster labels per stock (for internal use / LLM context) ──────────
    cluster_map = {}
    for sym in valid_user_stocks:
        if sym in features.index:
            c = int(features.loc[sym, "cluster"])
            r = round(float(features.loc[sym, "return"]) * 100, 2)
            v = round(float(features.loc[sym, "volatility"]) * 100, 2)
            cluster_map[sym] = {"cluster": c, "annual_return_pct": r, "annual_volatility_pct": v}

    return {
        "portfolio_value": round(total_invested, 2),
        "allocation": allocation,  # {symbol: rupee value}
        "metrics": {
            "expected_annual_return_pct": round(port_return, 2),
            "annual_volatility_pct": round(port_vol, 2),
            "sharpe_ratio": sharpe
        },
        "pro_forma": pro_forma_metrics,
        "cluster_info": cluster_map,
        "missing_clusters": len(missing_clusters) > 0,
        "recommendations": rec_allocation,  # {symbol: rupee amount to buy}
        "candidates": candidates,
        "optimization_note": optimization_note
    }