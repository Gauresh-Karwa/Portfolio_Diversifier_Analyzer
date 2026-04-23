import pandas as pd
import numpy as np
import yfinance as yf
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from pypfopt import expected_returns, risk_models
from pypfopt.efficient_frontier import EfficientFrontier
import warnings
import concurrent.futures
warnings.filterwarnings("ignore")

# ─── Diversifier Pool — ~180 major NSE stocks across all sectors ─────────────
DIVERSIFIER_POOL = [
    "RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS", "ICICIBANK.NS", "HINDUNILVR.NS", "ITC.NS",
    "SBIN.NS", "BAJFINANCE.NS", "BHARTIARTL.NS", "KOTAKBANK.NS", "LT.NS", "AXISBANK.NS",
    "ASIANPAINT.NS", "MARUTI.NS", "TITAN.NS", "SUNPHARMA.NS", "WIPRO.NS", "HCLTECH.NS",
    "ULTRACEMCO.NS", "NESTLEIND.NS", "TATAMOTORS.NS", "NTPC.NS", "POWERGRID.NS", "ONGC.NS",
    "JSWSTEEL.NS", "TATASTEEL.NS", "M&M.NS", "TECHM.NS", "COALINDIA.NS", "BPCL.NS",
    "GRASIM.NS", "DRREDDY.NS", "ADANIENT.NS", "ADANIPORTS.NS", "CIPLA.NS", "EICHERMOT.NS",
    "BRITANNIA.NS", "BAJAJ-AUTO.NS", "DIVISLAB.NS", "HINDALCO.NS", "INDUSINDBK.NS",
    "APOLLOHOSP.NS", "TATACONSUM.NS", "SBILIFE.NS", "HDFCLIFE.NS", "BAJAJFINSV.NS",
    "HEROMOTOCO.NS", "VEDL.NS", "PIDILITIND.NS", "SIEMENS.NS", "HAVELLS.NS", "BERGEPAINT.NS",
    "DABUR.NS", "COLPAL.NS", "MARICO.NS", "GODREJCP.NS", "MUTHOOTFIN.NS", "PAGEIND.NS",
    "TORNTPHARM.NS", "LUPIN.NS", "BIOCON.NS", "AUROPHARMA.NS", "ALKEM.NS", "IPCALAB.NS",
    "GLENMARK.NS", "ABBOTINDIA.NS", "PFIZER.NS", "SANOFI.NS", "GLAXO.NS", "HDFCAMC.NS",
    "NIPPONLIFE.NS", "ICICIGI.NS", "ICICIPRULI.NS", "SBICARD.NS", "AUBANKIND.NS",
    "FEDERALBNK.NS", "BANDHANBNK.NS", "IDFCFIRSTB.NS", "PNB.NS", "CANBK.NS", "UNIONBANK.NS",
    "BANKBARODA.NS", "MAHABANK.NS", "ADANIGREEN.NS", "ADANIPOWER.NS", "TATAPOWER.NS",
    "TORNTPOWER.NS", "CESC.NS", "DLF.NS", "GODREJPROP.NS", "PRESTIGE.NS", "OBEROIREAL.NS",
    "PHOENIXLTD.NS", "CHOLAFIN.NS", "BAJAJHLDNG.NS", "RECLTD.NS", "PFC.NS", "RVNL.NS",
    "IRCTC.NS", "IRFC.NS", "CONCOR.NS", "ZOMATO.NS", "NYKAA.NS", "POLICYBZR.NS", "PAYTM.NS",
    "DELHIVERY.NS", "MAXHEALTH.NS", "FORTIS.NS", "NARAYANA.NS", "RAINBOW.NS", "MFSL.NS",
    "STARHEALTH.NS", "TRENT.NS", "DMART.NS", "ABFRL.NS", "RAYMOND.NS", "JUBLFOOD.NS",
    "DEVYANI.NS", "SAPPHIRE.NS", "WESTLIFE.NS", "TATACHEM.NS", "AARTIIND.NS", "DEEPAKNTR.NS",
    "GNFC.NS", "CUMMINSIND.NS", "THERMAX.NS", "BEL.NS", "HAL.NS", "BHEL.NS", "BEML.NS",
    "CGPOWER.NS", "ABB.NS", "VOLTAS.NS", "WHIRLPOOL.NS", "BLUESTARCO.NS", "MPHASIS.NS",
    "PERSISTENT.NS", "LTIM.NS", "COFORGE.NS", "OFSS.NS", "ZEEL.NS", "SUNTV.NS", "PVRINOX.NS",
    "LALPATHLAB.NS", "METROPOLIS.NS", "THYROCARE.NS", "ASTRAL.NS", "SUPREMEIND.NS",
    "POLYPLEX.NS", "GHCL.NS", "KALYANKJIL.NS", "SENCO.NS", "RAJESHEXPO.NS", "SAIL.NS",
    "NMDC.NS", "MOIL.NS", "NATIONALUM.NS", "KIMS.NS", "YATHARTH.NS", "MEDANTA.NS",
    "HOMEFIRST.NS", "AAVAS.NS", "CREDITACC.NS", "MANAPPURAM.NS", "IREDA.NS", "NHPC.NS",
    "SJVN.NS", "HUDCO.NS", "RAILTEL.NS", "MAZDOCK.NS", "GRSE.NS", "BIKAJI.NS", "CAMPUS.NS",
    "LATENTVIEW.NS", "RATEGAIN.NS", "INTELLECT.NS", "MEDPLUS.NS", "VIJAYA.NS", "JKCEMENT.NS",
    "DALBHARAT.NS", "RAMCOCEM.NS", "PRISMCANN.NS", "MOTILALOFS.NS", "SWSOLAR.NS",
    "SHYAMMETL.NS", "VGUARD.NS", "AEGISLOG.NS", "RITES.NS", "HFCL.NS", "IRCON.NS",
    "IDBI.NS", "UCOBANK.NS", "IOB.NS", "CENTRALBK.NS", "HINDZINC.NS", "TATAELXSI.NS",
    "KPITTECH.NS", "JSL.NS", "JINDALSTEL.NS", "IDEA.NS", "YESBANK.NS", "SUZLON.NS",
    "JPPOWER.NS", "SOUTHBANK.NS", "KARURVYSYA.NS", "IEX.NS", "MCX.NS", "CDSL.NS",
    "TRIDENT.NS", "ALOKINDS.NS", "RENUKA.NS",
]


# ─── Sector Mapping for Intelligence ──────────────────────────────────────────
SECTOR_MAPPING = {
    "FMCG": ["HINDUNILVR.NS", "NESTLEIND.NS", "DABUR.NS", "MARICO.NS", "BRITANNIA.NS", "COLPAL.NS", "GODREJCP.NS", "TATACONSUM.NS", "VBL.NS"],
    "IT": ["TCS.NS", "INFY.NS", "HCLTECH.NS", "WIPRO.NS", "TECHM.NS", "LTIM.NS", "PERSISTENT.NS", "COFORGE.NS", "MPHASIS.NS"],
    "Banking": ["HDFCBANK.NS", "ICICIBANK.NS", "SBIN.NS", "KOTAKBANK.NS", "AXISBANK.NS", "INDUSINDBK.NS", "BANKBARODA.NS", "PNB.NS", "FEDERALBNK.NS"],
    "Finance": ["BAJFINANCE.NS", "BAJAJFINSV.NS", "CHOLAFIN.NS", "SBICARD.NS", "MUTHOOTFIN.NS", "HDFCLIFE.NS", "SBILIFE.NS", "RECLTD.NS", "PFC.NS"],
    "Energy": ["RELIANCE.NS", "ONGC.NS", "NTPC.NS", "POWERGRID.NS", "BPCL.NS", "COALINDIA.NS", "TATAPOWER.NS", "ADANIGREEN.NS", "ADANIPOWER.NS"],
    "Auto": ["MARUTI.NS", "TATAMOTORS.NS", "M&M.NS", "BAJAJ-AUTO.NS", "EICHERMOT.NS", "HEROMOTOCO.NS", "ASHOKLEY.NS", "TVSMOTOR.NS"],
    "Pharma": ["SUNPHARMA.NS", "DRREDDY.NS", "CIPLA.NS", "DIVISLAB.NS", "TORNTPHARM.NS", "LUPIN.NS", "AUROPHARMA.NS", "ALKEM.NS", "MAXHEALTH.NS"],
    "Metals": ["TATASTEEL.NS", "JSWSTEEL.NS", "HINDALCO.NS", "VEDL.NS", "SAIL.NS", "NMDC.NS", "NATIONALUM.NS", "JINDALSTEL.NS"],
    "Retail": ["TITAN.NS", "TRENT.NS", "DMART.NS", "ABFRL.NS", "NYKAA.NS", "ZOMATO.NS", "PAGEIND.NS"],
    "Infra": ["LT.NS", "ULTRACEMCO.NS", "GRASIM.NS", "DLF.NS", "GODREJPROP.NS", "ADANIPORTS.NS", "SIEMENS.NS", "ABB.NS", "CUMMINSIND.NS"],
}

RISK_FREE_RATE = 0.07  # India SBI FD rate
HOLD_THRESHOLD = 0.02  # Weight delta < 2% → HOLD (avoid trivial trades)
MAX_SELL_FRACTION = 0.30  # Max 30% of any existing holding can be sold


def run_analysis(user_stocks: list[str], quantities: list[float], buy_prices: list[float], new_cash: float):
    """
    Core analysis pipeline with full portfolio rebalancing (Buy + Sell + Hold).
    """

    # ── 1. Build current portfolio cost basis ─────────────────────────────────
    invested = [q * p for q, p in zip(quantities, buy_prices)]
    total_invested = sum(invested)
    allocation = {sym: val for sym, val in zip(user_stocks, invested)}

    # ── 2. Smart Diversifier Selection ────────────────────────────────────────
    # We download data for user stocks + a smart subset of the diversifier pool
    # to keep performance fast while having access to "all" major stocks.
    cleaned_user_stocks = list(dict.fromkeys(
        s for s in user_stocks if not s.startswith("NSE_")
    ))
    
    # Pick 3 leaders from every sector to form a high-impact universe of ~40 stocks
    smart_diversifiers = []
    for sector, stocks in SECTOR_MAPPING.items():
        smart_diversifiers.extend(stocks[:4]) # Pick top 4 from each sector
        
    all_symbols = list(set(cleaned_user_stocks) | set(smart_diversifiers))

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

def run_backtest(user_stocks, quantities, buy_prices, target_weights, period="1y"):
    """
    Computes historical cumulative returns for:
    1. Current Portfolio (weighted by cost basis)
    2. Optimized Portfolio (weighted by target weights)
    3. Benchmark (Nifty 50)
    """
    bench_ticker = "^NSEI"
    all_tickers = list(set(user_stocks) | set(target_weights.keys()))
    
    try:
        raw = yf.download(all_tickers + [bench_ticker], period=period, auto_adjust=True, progress=False, threads=True)["Close"]
    except Exception as e:
        return {"error": f"Price download failed: {str(e)}"}
        
    if isinstance(raw, pd.Series):
        raw = raw.to_frame(name=(all_tickers + [bench_ticker])[0])
        
    raw = raw.dropna(axis=1, how="all").ffill().dropna()
    if raw.empty:
        return {"error": "No price data returned for backtest."}
        
    bench_prices = raw[bench_ticker] if bench_ticker in raw.columns else None
    stock_prices = raw.drop(columns=[bench_ticker], errors="ignore")
    
    daily_returns = stock_prices.pct_change().fillna(0)
    
    # Current portfolio returns
    cost_basis = {sym: qty * bp for sym, qty, bp in zip(user_stocks, quantities, buy_prices)}
    total_cost = sum(cost_basis.values())
    valid_current = [s for s in user_stocks if s in daily_returns.columns and cost_basis.get(s, 0) > 0]
    
    if valid_current and total_cost > 0:
        curr_w = np.array([cost_basis.get(s, 0) for s in valid_current])
        curr_w = curr_w / curr_w.sum()
        current_daily = daily_returns[valid_current].values @ curr_w
    else:
        current_daily = np.zeros(len(daily_returns))
        
    # Optimized portfolio returns
    valid_opt = [t for t in target_weights if t in daily_returns.columns and target_weights.get(t, 0) > 0]
    if valid_opt:
        opt_w_raw = np.array([target_weights[t] for t in valid_opt], dtype=float)
        total_opt = opt_w_raw.sum()
        opt_w = opt_w_raw / total_opt if total_opt > 0 else opt_w_raw
        optimized_daily = daily_returns[valid_opt].values @ opt_w
    else:
        optimized_daily = np.zeros(len(daily_returns))
        
    # Benchmark returns
    if bench_prices is not None and not bench_prices.empty:
        bench_daily = bench_prices.pct_change().fillna(0).reindex(daily_returns.index).fillna(0).values
    else:
        bench_daily = np.zeros(len(daily_returns))
        
    cum_current = (1 + current_daily).cumprod()
    cum_optimized = (1 + optimized_daily).cumprod()
    cum_bench = (1 + bench_daily).cumprod()
    
    dates = [d.strftime("%Y-%m-%d") for d in daily_returns.index]
    
    return {
        "dates": dates,
        "current": [round(float(v), 4) for v in cum_current],
        "optimized": [round(float(v), 4) for v in cum_optimized],
        "benchmark": [round(float(v), 4) for v in cum_bench]
    }


def run_sector_analysis(user_stocks: list, quantities: list, buy_prices: list):
    """
    Fetch sector & industry classification for each ticker via yfinance and
    compute sector-level concentration metrics for the portfolio.
    """
    # Build portfolio value map
    portfolio = {}
    for sym, qty, bp in zip(user_stocks, quantities, buy_prices):
        portfolio[sym] = portfolio.get(sym, 0) + (qty * bp)
    total_value = sum(portfolio.values())

    # Fetch info in parallel (8 workers to stay polite to Yahoo)
    def fetch_info(ticker):
        try:
            info = yf.Ticker(ticker).info
            return {
                "ticker": ticker,
                "sector":   info.get("sector")   or "Unknown",
                "industry": info.get("industry") or "Unknown",
                "name":     info.get("longName") or ticker.replace(".NS", ""),
            }
        except Exception:
            return {"ticker": ticker, "sector": "Unknown", "industry": "Unknown",
                    "name": ticker.replace(".NS", "")}

    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
        infos = list(ex.map(fetch_info, user_stocks))

    # Aggregate by sector and industry
    sector_alloc:   dict = {}
    industry_alloc: dict = {}
    stock_details = []

    for info in infos:
        val = portfolio.get(info["ticker"], 0)
        sec = info["sector"]
        ind = info["industry"]
        sector_alloc[sec]   = sector_alloc.get(sec, 0)   + val
        industry_alloc[ind] = industry_alloc.get(ind, 0) + val
        stock_details.append({
            "symbol":     info["ticker"].replace(".NS", ""),
            "ticker":     info["ticker"],
            "sector":     sec,
            "industry":   ind,
            "name":       info["name"],
            "value":      round(val, 2),
            "weight_pct": round((val / total_value * 100) if total_value > 0 else 0, 2),
        })

    # Build sorted lists
    sector_data = sorted(
        [{"sector": s, "value": round(v, 2),
          "weight_pct": round((v / total_value * 100) if total_value > 0 else 0, 2)}
         for s, v in sector_alloc.items()],
        key=lambda x: x["value"], reverse=True
    )
    industry_data = sorted(
        [{"industry": i, "value": round(v, 2),
          "weight_pct": round((v / total_value * 100) if total_value > 0 else 0, 2)}
         for i, v in industry_alloc.items()],
        key=lambda x: x["value"], reverse=True
    )[:12]

    # Risk scoring
    n_sectors      = len([s for s in sector_data if s["weight_pct"] > 0.5])
    top_pct        = sector_data[0]["weight_pct"] if sector_data else 0
    herfindahl     = sum((s["weight_pct"] / 100) ** 2 for s in sector_data)  # HHI index

    if top_pct > 50 or herfindahl > 0.35:
        risk_level = "HIGH"
        risk_score = max(10, int(100 - top_pct))
    elif top_pct > 30 or herfindahl > 0.20:
        risk_level = "MEDIUM"
        risk_score = 55 + max(0, int((35 - top_pct)))
    else:
        risk_level = "LOW"
        risk_score = min(100, 65 + n_sectors * 5)

    warnings_list = []
    for s in sector_data:
        if s["weight_pct"] > 50:
            warnings_list.append(
                f"{s['sector']} dominates at {s['weight_pct']:.1f}% — extreme concentration risk.")
        elif s["weight_pct"] > 35:
            warnings_list.append(
                f"{s['sector']} is overweight at {s['weight_pct']:.1f}% — consider diversifying.")
    if n_sectors < 3:
        warnings_list.append(
            f"Portfolio only spans {n_sectors} sector(s). Target at least 4–6 for healthy diversification.")
    unknown_pct = sector_alloc.get("Unknown", 0) / total_value * 100 if total_value else 0
    if unknown_pct > 20:
        warnings_list.append(
            f"{unknown_pct:.1f}% of your portfolio has unclassified sector data — verify tickers on NSE.")

    return {
        "total_value":      round(total_value, 2),
        "n_sectors":        n_sectors,
        "herfindahl_index": round(herfindahl, 4),
        "concentration_risk": risk_level,
        "risk_score":       risk_score,
        "top_sector":       sector_data[0]["sector"] if sector_data else "N/A",
        "top_sector_pct":   round(top_pct, 2),
        "sector_data":      sector_data,
        "industry_data":    industry_data,
        "stock_details":    sorted(stock_details, key=lambda x: x["value"], reverse=True),
        "warnings":         warnings_list,
    }


def run_risk_analysis(user_stocks: list, quantities: list, buy_prices: list):
    """
    Computes Risk/Return Quadrant data and normalized stock movements for the portfolio.
    """
    if not user_stocks:
        return {"error": "No stocks provided"}

    # 1. Fetch 1 year of data for recent movements and risk/return analysis
    data = yf.download(user_stocks, period="1y", interval="1d", auto_adjust=True)["Close"]
    if data.empty:
        return {"error": "No data found for risk analysis"}

    # Handle single stock
    if isinstance(data, pd.Series):
        data = data.to_frame(name=user_stocks[0])

    data = data.ffill().dropna()
    if data.empty:
        return {"error": "Insufficient valid data after cleaning"}

    returns = data.pct_change().dropna()

    # Recalculate weights based ONLY on valid downloaded stocks to prevent dot product shape mismatch
    valid_stocks = list(data.columns)
    valid_weights_map = {}
    for i, stock in enumerate(user_stocks):
        # YFinance may strip .NS or return it differently, but here user_stocks should match data.columns usually
        # But wait, user_stocks has .NS, yfinance columns might keep .NS
        # We will match by exact string
        if stock in valid_stocks:
            valid_weights_map[stock] = (quantities[i] * buy_prices[i])

    total_valid_invested = sum(valid_weights_map.values())
    if total_valid_invested == 0:
        weights = [1/len(valid_stocks)] * len(valid_stocks)
    else:
        weights = [valid_weights_map[s] / total_valid_invested for s in valid_stocks]

    # 2. Risk/Return Quadrant Data (Annualized)
    # Annualized Return = (Cumulative Return + 1)^(252 / N) - 1, but for 1 year, simple cumulative works well, or mean return * 252
    ann_returns = returns.mean() * 252 * 100
    ann_volatility = returns.std() * np.sqrt(252) * 100

    quadrant_data = []
    for i, stock in enumerate(data.columns):
        quadrant_data.append({
            "ticker": stock.replace(".NS", ""),
            "return": round(float(ann_returns[stock]), 2),
            "risk": round(float(ann_volatility[stock]), 2),
            "weight": round(weights[i] * 100, 2)
        })

    # Calculate Portfolio Average
    port_returns = returns.dot(weights)
    port_ann_return = port_returns.mean() * 252 * 100
    port_ann_vol = port_returns.std() * np.sqrt(252) * 100

    portfolio_avg = {
        "return": round(float(port_ann_return), 2),
        "risk": round(float(port_ann_vol), 2)
    }

    # 3. Stock Movements (Normalized to 100 at start)
    normalized_data = (data / data.iloc[0]) * 100
    
    # Format for frontend chart
    dates = [d.strftime('%Y-%m-%d') for d in normalized_data.index]
    movements = {}
    for stock in normalized_data.columns:
        movements[stock.replace(".NS", "")] = [round(float(v), 2) for v in normalized_data[stock]]

    return {
        "quadrant_data": quadrant_data,
        "portfolio_avg": portfolio_avg,
        "movements": {
            "dates": dates,
            "series": movements
        }
    }