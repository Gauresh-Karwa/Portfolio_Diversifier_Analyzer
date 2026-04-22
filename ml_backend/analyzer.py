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
HOLD_THRESHOLD = 0.02  # Weight delta < 2% → HOLD (avoid trivial trades)
MAX_SELL_FRACTION = 0.30  # Max 30% of any existing holding can be sold


def run_analysis(user_stocks: list[str], quantities: list[float], buy_prices: list[float], new_cash: float):
    """
    Core analysis pipeline with full portfolio rebalancing (Buy + Sell + Hold).
    user_stocks: list of NSE symbols e.g. ['TCS.NS', 'INFY.NS']
    quantities:  number of shares held
    buy_prices:  price at which they were bought
    new_cash:    amount user wants to invest (can be 0)
    """

    # ── 1. Build current portfolio cost basis ─────────────────────────────────
    invested = [q * p for q, p in zip(quantities, buy_prices)]
    total_invested = sum(invested)
    allocation = {sym: val for sym, val in zip(user_stocks, invested)}

    # ── 2. Fetch live price data ───────────────────────────────────────────────
    cleaned_user_stocks = list(dict.fromkeys(
        s for s in user_stocks if not s.startswith("NSE_")
    ))
    all_symbols = list(set(cleaned_user_stocks) | set(DIVERSIFIER_POOL))

    try:
        raw = yf.download(all_symbols, period="2y", auto_adjust=True, progress=False, threads=True)["Close"]
    except Exception:
        return {
            "portfolio_value": round(total_invested, 2),
            "allocation": allocation,
            "metrics": {"expected_annual_return_pct": 0, "annual_volatility_pct": 0, "sharpe_ratio": 0},
            "pro_forma": {"expected_annual_return_pct": 0, "annual_volatility_pct": 0, "sharpe_ratio": 0},
            "recommendations": {},
            "rebalance_actions": [],
            "cluster_info": {},
            "missing_clusters": False,
            "error": "Market data currently unavailable.",
            "invalid_tickers": []
        }

    # Handle single column edge case
    if isinstance(raw, pd.Series):
        raw = raw.to_frame(name=all_symbols[0] if all_symbols else "UNKNOWN")

    raw = raw.dropna(axis=1, how="all")



    invalid_tickers = list(dict.fromkeys(
        s for s in cleaned_user_stocks if s not in raw.columns
    ))

    raw = raw.ffill().dropna()

    # ── Extract live prices (last available close) ────────────────────────────
    live_prices = {}
    for sym in cleaned_user_stocks:
        if sym in raw.columns:
            live_prices[sym] = float(raw[sym].iloc[-1])

    # ── Compute live portfolio value using latest prices ──────────────────────
    current_values = {}  # ticker → live market value
    for sym, qty, bp in zip(user_stocks, quantities, buy_prices):
        if sym in live_prices:
            current_values[sym] = qty * live_prices[sym]
        else:
            current_values[sym] = qty * bp  # fallback to cost basis

    live_portfolio_value = sum(current_values.values())
    total_capital = live_portfolio_value + new_cash  # total deployable capital

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
    valid_user_stocks = [s for s in cleaned_user_stocks if s in features.index]

    if len(valid_user_stocks) < 2:
        return {
            "portfolio_value": round(total_invested, 2),
            "allocation": allocation,
            "metrics": {"expected_annual_return_pct": 0, "annual_volatility_pct": 0, "sharpe_ratio": 0},
            "pro_forma": {"expected_annual_return_pct": 0, "annual_volatility_pct": 0, "sharpe_ratio": 0},
            "recommendations": {},
            "rebalance_actions": [],
            "cluster_info": {},
            "missing_clusters": False,
            "error": "Could not cluster enough of your stocks. Please check that your tickers are valid NSE symbols."
        }

    user_clusters = set(int(features.loc[s, "cluster"]) for s in valid_user_stocks)
    all_clusters = set(int(c) for c in features["cluster"].unique())
    missing_clusters = all_clusters - user_clusters

    # ── 8. Candidate stocks from missing clusters ──────────────────────────────
    if missing_clusters:
        candidates = []
        for c in missing_clusters:
            candidates.extend(cluster_to_pool_stocks.get(c, []))
        candidates = list(dict.fromkeys(
            s for s in candidates if s not in cleaned_user_stocks
        ))
    else:
        candidates = [
            s for s in DIVERSIFIER_POOL
            if s in features.index and s not in cleaned_user_stocks
        ]

    if len(candidates) < 2:
        candidates = [
            s for s in DIVERSIFIER_POOL
            if s in features.index and s not in cleaned_user_stocks
        ][:6]

    # ── 9. Current portfolio metrics (before rebalancing) ─────────────────────
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

    # ── 10. FULL REBALANCING OPTIMIZATION ─────────────────────────────────────
    # Universe = valid user stocks + best candidates (capped to keep tractable)
    top_candidates = candidates[:8]  # limit to 8 new stocks to avoid over-dilution
    universe_tickers = list(dict.fromkeys(valid_user_stocks + top_candidates))
    # Filter to only tickers with price history
    universe_tickers = [t for t in universe_tickers if t in raw.columns]

    rebalance_actions = []
    rec_allocation = {}   # backward-compat: only BUY actions in old format
    optimization_note = ""
    pro_forma_metrics = {
        "expected_annual_return_pct": round(port_return, 2),
        "annual_volatility_pct": round(port_vol, 2),
        "sharpe_ratio": sharpe
    }
    total_sell_proceeds = 0.0
    total_buy_cost = 0.0
    net_cash_needed = 0.0

    if len(universe_tickers) >= 2 and total_capital > 0:
        try:
            mu = expected_returns.mean_historical_return(
                raw[universe_tickers], frequency=252
            )
            S = risk_models.sample_cov(raw[universe_tickers], frequency=252)

            # Weight bounds: 0% min, 40% max (global)
            ef = EfficientFrontier(mu, S, weight_bounds=(0.0, 0.40))

            # Add min weight: 5% for each candidate if candidates >= 4
            if len(top_candidates) >= 4:
                start_idx = len(valid_user_stocks)
                for i in range(start_idx, len(universe_tickers)):
                    ef.add_constraint(lambda w, idx=i: w[idx] >= 0.05)

            # Per-asset max-sell constraint: can't drop below 70% of current weight
            for i, ticker in enumerate(universe_tickers):
                if ticker in current_values and total_capital > 0:
                    current_w = current_values[ticker] / total_capital
                    min_allowed_w = current_w * (1 - MAX_SELL_FRACTION)
                    if min_allowed_w > 0.001:  # only add if meaningful
                        ef.add_constraint(
                            lambda w, idx=i, lb=min_allowed_w: w[idx] >= lb
                        )

            ef.max_sharpe(risk_free_rate=RISK_FREE_RATE)
            target_weights = ef.clean_weights()

            # ── 1d. SEED VARIETY ──────────────────────────────────────────────
            # If fewer than 3 stocks recommended, fall back to equal weight across top 5 candidates
            rec_count = sum(1 for w in target_weights.values() if w > 0.01)
            if rec_count < 3:
                candidate_sharpes = []
                for t in top_candidates:
                    if t in features.index:
                        r = features.loc[t, "return"]
                        v = features.loc[t, "volatility"]
                        # Simple Sharpe for ranking
                        s_rank = (r - RISK_FREE_RATE) / v if v > 0 else 0
                        candidate_sharpes.append((t, s_rank))
                
                candidate_sharpes.sort(key=lambda x: x[1], reverse=True)
                top_5_candidates = [x[0] for x in candidate_sharpes[:5]]
                
                if top_5_candidates:
                    eq_w = 1.0 / len(top_5_candidates)
                    target_weights = {t: 0.0 for t in universe_tickers}
                    for t in top_5_candidates:
                        target_weights[t] = eq_w
                    optimization_note += " Low diversity in optimal portfolio; using equal-weight candidate fallback."

        except Exception as e:
            optimization_note = f"Full rebalance optimization failed ({str(e)[:80]}). Using equal-weight fallback."
            # Fallback: equal weights across universe
            eq_w = 1.0 / len(universe_tickers)
            target_weights = {t: eq_w for t in universe_tickers}

        # ── Compute current weights across universe ────────────────────────────
        current_weights = {}
        for ticker in universe_tickers:
            if ticker in current_values:
                current_weights[ticker] = current_values[ticker] / total_capital
            else:
                current_weights[ticker] = 0.0

        # ── Step 5: Compute delta → BUY / SELL / HOLD ─────────────────────────
        raw_actions = []
        for ticker in universe_tickers:
            target_w  = target_weights.get(ticker, 0.0)
            current_w = current_weights.get(ticker, 0.0)
            delta_w   = target_w - current_w

            target_value_rupees   = target_w * total_capital
            current_value_rupees  = current_w * total_capital
            delta_rupees          = target_value_rupees - current_value_rupees

            live_px = live_prices.get(ticker, None)
            units = None
            if live_px and live_px > 0:
                units = abs(int(delta_rupees / live_px))

            if abs(delta_w) < HOLD_THRESHOLD:
                action = "HOLD"
                delta_rupees = 0.0
                units = 0
            elif delta_w > 0:
                action = "BUY"
            else:
                action = "SELL"
                delta_rupees = abs(delta_rupees)

            raw_actions.append({
                "symbol":               ticker.replace(".NS", ""),
                "ticker":               ticker,
                "action":               action,
                "current_value":        round(current_value_rupees, 2),
                "target_value":         round(target_value_rupees, 2),
                "delta_rupees":         round(abs(delta_rupees), 2),
                "units":                units,
                "live_price":           round(live_px, 2) if live_px else None,
                "current_weight_pct":   round(current_w * 100, 2),
                "target_weight_pct":    round(target_w * 100, 2),
            })

        # ── Step 6: Cash flow check & scale-down BUYs if needed ───────────────
        sell_actions = [a for a in raw_actions if a["action"] == "SELL"]
        buy_actions  = [a for a in raw_actions if a["action"] == "BUY"]
        hold_actions = [a for a in raw_actions if a["action"] == "HOLD"]

        total_sell_proceeds = sum(a["delta_rupees"] for a in sell_actions)
        total_buy_cost      = sum(a["delta_rupees"] for a in buy_actions)
        available_cash      = total_sell_proceeds + new_cash
        net_cash_needed     = total_buy_cost - available_cash

        if net_cash_needed > 0 and total_buy_cost > 0:
            scale_factor = available_cash / total_buy_cost
            optimization_note += f" Buy amounts scaled by {scale_factor:.0%} to fit available cash."
            for a in buy_actions:
                a["delta_rupees"] = round(a["delta_rupees"] * scale_factor, 2)
                if a["live_price"] and a["live_price"] > 0:
                    a["units"] = int(a["delta_rupees"] / a["live_price"])
            total_buy_cost = sum(a["delta_rupees"] for a in buy_actions)
            net_cash_needed = total_buy_cost - available_cash

        # ── Sort: SELL first, then BUY, then HOLD ─────────────────────────────
        rebalance_actions = sell_actions + buy_actions + hold_actions

        # ── Build backward-compat recommendations dict (BUY only) ─────────────
        rec_allocation = {
            a["ticker"]: a["delta_rupees"]
            for a in buy_actions
            if a["delta_rupees"] > 0
        }

        # ── Pro-forma metrics using target weights ─────────────────────────────
        valid_universe = [t for t in universe_tickers if t in returns.columns]
        if valid_universe:
            tw_arr = np.array([target_weights.get(t, 0.0) for t in valid_universe])
            total_tw = tw_arr.sum()
            if total_tw > 0:
                tw_arr = tw_arr / total_tw
            pf_return = float(np.dot(tw_arr, annual_return[valid_universe]) * 100)
            pf_vol = float(np.sqrt(
                np.dot(tw_arr, np.dot(returns[valid_universe].cov() * 252, tw_arr))
            ) * 100)
            pf_sharpe = round((pf_return / 100 - RISK_FREE_RATE) / (pf_vol / 100), 2) if pf_vol > 0 else 0
            pro_forma_metrics = {
                "expected_annual_return_pct": round(pf_return, 2),
                "annual_volatility_pct": round(pf_vol, 2),
                "sharpe_ratio": pf_sharpe
            }

    # ── 11. Cluster labels per stock (for LLM context) ────────────────────────
    cluster_map = {}
    for sym in valid_user_stocks:
        if sym in features.index:
            c = int(features.loc[sym, "cluster"])
            r = round(float(features.loc[sym, "return"]) * 100, 2)
            v = round(float(features.loc[sym, "volatility"]) * 100, 2)
            cluster_map[sym] = {"cluster": c, "annual_return_pct": r, "annual_volatility_pct": v}

    return {
        "portfolio_value":       round(live_portfolio_value, 2),
        "total_capital":         round(total_capital, 2),
        "allocation":            allocation,
        "metrics": {
            "expected_annual_return_pct": round(port_return, 2),
            "annual_volatility_pct":      round(port_vol, 2),
            "sharpe_ratio":               sharpe
        },
        "pro_forma":             pro_forma_metrics,
        "cluster_info":          cluster_map,
        "missing_clusters":      len(missing_clusters) > 0,
        "recommendations":       rec_allocation,          # backward compat
        "rebalance_actions":     rebalance_actions,
        "total_sell_proceeds":   round(total_sell_proceeds, 2),
        "total_buy_cost":        round(total_buy_cost, 2),
        "net_cash_needed":       round(net_cash_needed, 2),
        "candidates":            top_candidates,
        "optimization_note":     optimization_note.strip(),
        "invalid_tickers":       invalid_tickers
    }