from fastapi import FastAPI, File, UploadFile, Form, Depends, HTTPException, Header
from fastapi.responses import StreamingResponse
from jose import jwt, JWTError
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import io
import os
import google.generativeai as genai
from dotenv import load_dotenv
from analyzer import run_analysis
from generate_report import create_pdf

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")
if api_key:
    print(f"DEBUG: GEMINI_API_KEY loaded, starts with: {api_key[:8]}...")
else:
    print("DEBUG: GEMINI_API_KEY NOT FOUND!")
genai.configure(api_key=api_key, transport='rest')

JWT_SECRET = os.getenv("JWT_SECRET", "secret123")
JWT_ALGORITHM = "HS256"


def verify_jwt(authorization: str = Header(None)):
    """Dependency that validates the Bearer JWT from auth_backend."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = authorization[len("Bearer "):]
    try:
        jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")




app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten this in production
    allow_methods=["*"],
    allow_headers=["*"],
)

def build_gemini_prompt(result: dict, new_cash: float, age: int, goal: str) -> str:
    metrics = result["metrics"]
    cluster_info = result["cluster_info"]
    pro = result.get("pro_forma", {})
    rebalance_actions = result.get("rebalance_actions", [])

    system_context = """You are a friendly SEBI-registered financial
advisor for Indian retail investors. You must give specific,
personalized advice based ONLY on the numbers provided. Never give
generic advice. Always mention specific stock names. Always mention
specific rupee amounts. Keep it under 200 words. Use simple English.
Do not use jargon. Do not repeat the same sentence structure for
every paragraph."""

    user_clusters = set(v["cluster"] for v in cluster_info.values())
    is_concentrated = "yes" if len(user_clusters) <= 1 and len(cluster_info) > 0 else "no"

    stock_lines = "\n".join(
        f"- {sym}: annual return {v['annual_return_pct']}%, volatility {v['annual_volatility_pct']}%, cluster ID {v['cluster']}"
        for sym, v in cluster_info.items()
    ) if cluster_info else "No existing stocks or missing data."

    sell_actions = [a for a in rebalance_actions if a["action"] == "SELL"]
    buy_actions  = [a for a in rebalance_actions if a["action"] == "BUY"]

    sell_lines = "\n".join(
        f"- SELL {a['symbol']}: reduce by Rs.{a['delta_rupees']:,.0f} (over-represented or same cluster as other holdings)"
        for a in sell_actions
    ) if sell_actions else "No sell actions required."

    buy_lines = "\n".join(
        f"- BUY {a['symbol']}: invest Rs.{a['delta_rupees']:,.0f} (adds missing cluster diversification)"
        for a in buy_actions
    ) if buy_actions else "No buy actions required."

    old_sharpe  = metrics.get('sharpe_ratio', 'N/A')
    new_sharpe  = pro.get('sharpe_ratio', 'N/A')
    new_return  = pro.get('expected_annual_return_pct', 'N/A')
    new_vol     = pro.get('annual_volatility_pct', 'N/A')
    sell_total  = result.get('total_sell_proceeds', 0)
    net_needed  = result.get('net_cash_needed', 0)

    data_block = f"""--- DATA BLOCK ---
User Stocks:
{stock_lines}

Concentrated (all in same cluster) = {is_concentrated}

REBALANCING PLAN:
Sell Orders:
{sell_lines}

Buy Orders:
{buy_lines}

Cash Flow Summary:
- New Cash Added: Rs.{new_cash:,.0f}
- Sell Proceeds: Rs.{sell_total:,.0f}
- Net Cash Still Needed: Rs.{max(0, net_needed):,.0f} (0 means self-funded)

Performance Impact:
- Current Sharpe: {old_sharpe}
- Projected Sharpe: {new_sharpe}
- Projected Return: {new_return}%
- Projected Volatility: {new_vol}%

Investor Profile:
- Age: {age}
- Goal: {goal}
- New Cash to Invest: Rs.{new_cash:,.0f}
------------------"""

    prompt_instruction = """Write 3 short paragraphs:
Paragraph 1: Tell the user specifically what is wrong with their current portfolio using their actual stock names and numbers — which stocks are over-concentrated and which behavioral clusters are missing.
Paragraph 2: Explain the rebalancing plan — which stocks to sell and why (they are over-represented or in the same cluster), and which stocks to buy and why (they fill missing behavioral clusters). Mention specific stock names and rupee amounts.
Paragraph 3: Tell them what their portfolio will look like after rebalancing — mention the projected return, volatility, and improvement in Sharpe Ratio."""

    return f"{system_context}\n\n{data_block}\n\n{prompt_instruction}"


@app.post("/analyze", dependencies=[Depends(verify_jwt)])
async def analyze(
    file: UploadFile = File(...),
    new_cash: float = Form(0.0),
    age: int = Form(30),
    goal: str = Form("Balanced growth")
):
    # ── Parse CSV ──────────────────────────────────────────────────────────────
    contents_bytes = await file.read()
    df = None
    
    # Try different encodings
    for encoding in ["utf-8", "latin1", "cp1252"]:
        try:
            # Try different delimiters
            for sep in [",", ";", "\t"]:
                try:
                    df = pd.read_csv(io.BytesIO(contents_bytes), sep=sep, encoding=encoding)
                    # Simple heuristic: we need at least 2 columns
                    if len(df.columns) >= 2:
                        break
                except Exception:
                    continue
            if df is not None and len(df.columns) >= 2:
                break
        except Exception:
            continue
            
    if df is None or len(df.columns) < 2:
        return {"error": "Could not read CSV. Please ensure it is a valid CSV file."}

    # Normalize column names
    df.columns = [c.strip().lower() for c in df.columns]

    # Accept flexible column names
    symbol_col = next((c for c in df.columns if any(k in c for k in ["symbol", "stock", "ticker", "instrument", "investment", "name"])), None)
    qty_col = next((c for c in df.columns if any(k in c for k in ["qty", "quantity", "shares", "units"])), None)
    price_col = next((c for c in df.columns if any(k in c for k in ["price", "buy", "avg", "cost", "rate"])), None)
    amt_col = next((c for c in df.columns if any(k in c for k in ["amount", "value", "invested", "market value", "current value"])), None)

    if not symbol_col:
        return {"error": "CSV must have a column named Symbol/Stock/Investment"}
    
    if not (qty_col and price_col) and not amt_col:
        return {"error": "CSV must have (Quantity AND Price) OR an Amount/Value column"}

    def clean_numeric(val):
        if pd.isna(val): return 0.0
        if isinstance(val, (int, float)): return float(val)
        # Remove currency symbols, commas, and whitespace
        s = str(val).replace('₹', '').replace(',', '').strip()
        try:
            return float(s)
        except ValueError:
            return 0.0

    # If we have amount but no qty/price, we can't do per-unit math, but we can still use the total
    if amt_col and not (qty_col and price_col):
        # Fake qty and price for the analyzer if missing
        df["quantity"] = 1.0
        df["buy_price"] = df[amt_col].apply(clean_numeric)
        qty_col = "quantity"
        price_col = "buy_price"
    elif qty_col and price_col:
        df["quantity"] = df[qty_col].apply(clean_numeric)
        df["buy_price"] = df[price_col].apply(clean_numeric)
    
    df = df[[symbol_col, "quantity", "buy_price"]].dropna()
    df.columns = ["symbol", "quantity", "buy_price"]
    
    # Filter out rows where buy_price is 0
    df = df[df["buy_price"] > 0]

    if df.empty:
        return {"error": "No valid numeric investment data found in CSV."}

    # Append .NS if not already present
    df["symbol"] = df["symbol"].str.strip().str.upper().apply(
        lambda s: s if s.endswith(".NS") else s + ".NS"
    )

    symbols = df["symbol"].tolist()
    quantities = df["quantity"].astype(float).tolist()
    buy_prices = df["buy_price"].astype(float).tolist()

    # ── Run Analysis ───────────────────────────────────────────────────────────
    try:
        result = run_analysis(symbols, quantities, buy_prices, new_cash)
    except Exception as e:
        return {"error": f"Analysis failed: {str(e)}"}

    # ── Gemini LLM Recommendation ──────────────────────────────────────────────
    llm_text = ""
    # Try multiple variants for better compatibility (targeting Gemini 2.5 and 3.1)
    for model_name in [
        "models/gemini-2.5-flash",
        "gemini-2.5-flash",
        "models/gemini-2.5-flash-latest",
        "models/gemini-3.1-flash-live-preview",
        "models/gemini-2.0-flash",
        "gemini-2.0-flash",
        "models/gemini-1.5-flash-latest", 
        "models/gemini-1.5-flash", 
        "models/gemini-1.5-pro", 
        "models/gemini-pro"
    ]:
        try:
            model = genai.GenerativeModel(model_name)
            prompt = build_gemini_prompt(result, new_cash, age, goal)
            response = model.generate_content(prompt)
            llm_text = response.text
            if llm_text: break
        except Exception as e:
            llm_text = f"AI Strategist logic error: {str(e)}"
            continue

    if not llm_text or "AI Strategist logic error" in llm_text:
        llm_text = "AI Strategist is temporarily unavailable. This is likely due to the Google AI Studio project not having the Gemini API enabled, or using an incompatible model string for your region. Check your API key at https://aistudio.google.com/"

    return {
        **result,
        "llm_recommendation": llm_text
    }


@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/generate-report", dependencies=[Depends(verify_jwt)])
async def generate_report(data: dict):
    pdf_bytes = create_pdf(data)
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=portfolio_rebalancing_report.pdf"}
    )