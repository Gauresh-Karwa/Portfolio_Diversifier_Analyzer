import pandas as pd
import numpy as np
import yfinance as yf
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from pypfopt import expected_returns, risk_models
from pypfopt.efficient_frontier import EfficientFrontier
import warnings
warnings.filterwarnings("ignore")

# ─── Diversifier Pool — 40 stocks across all major NSE sectors ───────────────
DIVERSIFIER_POOL = [
    # FMCG
    "HINDUNILVR.NS", "NESTLEIND.NS", "DABUR.NS", "MARICO.NS", "BRITANNIA.NS",
    # Pharma
    "SUNPHARMA.NS", "DRREDDY.NS", "CIPLA.NS", "DIVISLAB.NS",
    # Banking & Finance
    "HDFCBANK.NS", "ICICIBANK.NS", "KOTAKBANK.NS", "AXISBANK.NS",
    "BAJFINANCE.NS", "SBICARD.NS",
    # Energy & PSU
    "ONGC.NS", "NTPC.NS", "POWERGRID.NS", "COALINDIA.NS", "BPCL.NS",
    # Metals & Mining
    "TATASTEEL.NS", "JSWSTEEL.NS", "HINDALCO.NS", "VEDL.NS",
    # Auto
    "MARUTI.NS", "TATAMOTORS.NS", "BAJAJ-AUTO.NS", "EICHERMOT.NS",
    # Consumer & Retail
    "ASIANPAINT.NS", "TITAN.NS", "PIDILITIND.NS",
    # Telecom & Media
    "BHARTIARTL.NS", "ZEEL.NS",
    # Infrastructure & Real Estate
    "ULTRACEMCO.NS", "GRASIM.NS", "DLF.NS",
    # Healthcare
    "APOLLOHOSP.NS", "MAXHEALTH.NS",
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
    # Filter out invalid symbols (placeholders like NSE_xxx), then deduplicate
    cleaned_user_stocks = list(dict.fromkeys(
        s for s in user_stocks if not s.startswith("NSE_")
    ))
    all_symbols = list(set(cleaned_user_stocks) | set(DIVERSIFIER_POOL))

    try:
        raw = yf.download(all_symbols, period="2y", auto_adjust=True, progress=False)["Close"]
    except Exception:
        return {
            "portfolio_value": round(total_invested, 2),
            "allocation": allocation,
            "metrics": {"expected_annual_return_pct": 0, "annual_volatility_pct": 0, "sharpe_ratio": 0},
            "recommendations": {},
            "cluster_info": {},
            "missing_clusters": False,
            "error": "Market data currently unavailable.",
            "invalid_tickers": []
        }

    # Handle single column edge case
    if isinstance(raw, pd.Series):
        raw = raw.to_frame(name=all_symbols[0] if all_symbols else "UNKNOWN")

    # Keep only columns that downloaded successfully
    raw = raw.dropna(axis=1, how="all")

    # ── Retry failed symbols with 1y period (handles newer IPO stocks: ZOMATO, etc.) ──
    failed_first_pass = [s for s in all_symbols if s not in raw.columns]
    if failed_first_pass:
        try:
            raw_retry = yf.download(failed_first_pass, period="1y", auto_adjust=True, progress=False)["Close"]
            if isinstance(raw_retry, pd.Series):
                raw_retry = raw_retry.to_frame(name=failed_first_pass[0])
            raw_retry = raw_retry.dropna(axis=1, how="all")
            # Align date index and merge — use inner join on dates present in both
            if not raw_retry.empty:
                raw = pd.concat([raw, raw_retry], axis=1, join="inner")
        except Exception:
            pass  # Retry failed — treat them as truly invalid

    # ── Detect invalid user tickers (still no data after retry) ──────────────────
    invalid_tickers = list(dict.fromkeys(
        s for s in cleaned_user_stocks if s not in raw.columns
    ))

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
        features["cluster"] = 0
    else:
        scaler = StandardScaler()
        scaled = scaler.fit_transform(features)
        n_clusters = min(4, len(features))
        kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        features["cluster"] = kmeans.fit_predict(scaled)

    # ── 6. Build cluster → pool stocks mapping ────────────────────────────────
    cluster_to_pool_stocks = {}
    for sym in DIVERSIFIER_POOL:
        if sym in features.index:
            c = int(features.loc[sym, "cluster"])
            cluster_to_pool_stocks.setdefault(c, []).append(sym)

    # ── 7. Find missing clusters in user portfolio ─────────────────────────────
    # Only consider valid user stocks (those that downloaded and are in features)
    valid_user_stocks = [s for s in cleaned_user_stocks if s in features.index]

    # Enforce: need at least 2 user stocks clustered to do meaningful analysis
    if len(valid_user_stocks) < 2:
        return {
            "portfolio_value": round(total_invested, 2),
            "allocation": allocation,
            "metrics": {"expected_annual_return_pct": 0, "annual_volatility_pct": 0, "sharpe_ratio": 0},
            "recommendations": {},
            "cluster_info": {},
            "missing_clusters": False,
            "error": "Could not cluster enough of your stocks. Please check that your tickers are valid NSE symbols."
        }

    user_clusters = set(int(features.loc[s, "cluster"]) for s in valid_user_stocks)
    all_clusters = set(int(c) for c in features["cluster"].unique())
    missing_clusters = all_clusters - user_clusters

    # ── 8. Candidate stocks from missing clusters ──────────────────────────────
    if missing_clusters:
        # Pick pool stocks that belong to clusters the user is missing
        candidates = []
        for c in missing_clusters:
            candidates.extend(cluster_to_pool_stocks.get(c, []))
        # De-duplicate and exclude any that are already held by the user
        candidates = list(dict.fromkeys(
            s for s in candidates if s not in cleaned_user_stocks
        ))
    else:
        # All clusters covered — recommend least correlated diversifiers
        candidates = [
            s for s in DIVERSIFIER_POOL
            if s in features.index and s not in cleaned_user_stocks
        ]

    # Need at least 2 candidates for optimization
    if len(candidates) < 2:
        candidates = [
            s for s in DIVERSIFIER_POOL
            if s in features.index and s not in cleaned_user_stocks
        ][:6]

    # ── 9. Portfolio Optimization (Sharpe) ────────────────────────────────────
    rec_allocation = {}
    optimization_note = ""

    if new_cash > 0 and len(candidates) >= 2:
        try:
            mu = expected_returns.mean_historical_return(raw[candidates], frequency=252).clip(lower=0)
            S = risk_models.sample_cov(raw[candidates], frequency=252)

            # Per-stock weight bounds: max 40% to prevent single-stock concentration
            ef = EfficientFrontier(mu, S, weight_bounds=(0.0, 0.40))

            # Add minimum weight constraint only when we have enough candidates
            # (avoids infeasibility with fewer stocks)
            if len(candidates) >= 4:
                ef.add_constraint(lambda w: w >= 0.05)

            ef.max_sharpe(risk_free_rate=RISK_FREE_RATE)
            weights = ef.clean_weights()

            rec_allocation = {
                sym: round(weight * new_cash, 2)
                for sym, weight in weights.items()
                if weight > 0.01
            }

            # ── 1d. Seed-variety fallback: if optimizer converges to < 3 stocks ──
            if len(rec_allocation) < 3:
                optimization_note = "Optimizer concentrated — applied equal-weight fallback across top candidates."
                # Pick top 5 candidates by individual Sharpe ratio
                individual_sharpe = (
                    (annual_return[candidates] - RISK_FREE_RATE) /
                    annual_volatility[candidates]
                ).replace([np.inf, -np.inf], np.nan).dropna()
                top_candidates = individual_sharpe.sort_values(ascending=False).head(5).index.tolist()
                per_stock = round(new_cash / len(top_candidates), 2)
                rec_allocation = {sym: per_stock for sym in top_candidates}

        except Exception as e:
            # Fallback: equal weight across top 4 by annual return
            optimization_note = f"Optimization failed ({str(e)}). Using equal-weight fallback."
            top_candidates = (
                annual_return[candidates]
                .sort_values(ascending=False)
                .head(4)
                .index.tolist()
            )
            per_stock = round(new_cash / len(top_candidates), 2)
            rec_allocation = {sym: per_stock for sym in top_candidates}

    # ── 10. Current Portfolio Risk/Return metrics ──────────────────────────────
    valid_held = [s for s in valid_user_stocks if s in returns.columns]
    if valid_held:
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

    # ── 11. Pro-forma (Projected) Metrics ─────────────────────────────────────
    pro_forma_metrics = {}
    if rec_allocation:
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

    # ── 12. Cluster labels per stock (for LLM context) ────────────────────────
    cluster_map = {}
    for sym in valid_user_stocks:
        if sym in features.index:
            c = int(features.loc[sym, "cluster"])
            r = round(float(features.loc[sym, "return"]) * 100, 2)
            v = round(float(features.loc[sym, "volatility"]) * 100, 2)
            cluster_map[sym] = {"cluster": c, "annual_return_pct": r, "annual_volatility_pct": v}

    return {
        "portfolio_value": round(total_invested, 2),
        "allocation": allocation,
        "metrics": {
            "expected_annual_return_pct": round(port_return, 2),
            "annual_volatility_pct": round(port_vol, 2),
            "sharpe_ratio": sharpe
        },
        "pro_forma": pro_forma_metrics,
        "cluster_info": cluster_map,
        "missing_clusters": len(missing_clusters) > 0,
        "recommendations": rec_allocation,
        "candidates": candidates,
        "optimization_note": optimization_note,
        "invalid_tickers": invalid_tickers
    }