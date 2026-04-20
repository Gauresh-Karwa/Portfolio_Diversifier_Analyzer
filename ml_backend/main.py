from fastapi import FastAPI, File, UploadFile, Form, Depends, HTTPException, Header
from jose import jwt, JWTError
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import io
import os
import google.generativeai as genai
from dotenv import load_dotenv
from analyzer import run_analysis

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
    recs = result["recommendations"]
    cluster_info = result["cluster_info"]

    stock_lines = "\n".join(
        f"- {sym}: annual return {v['annual_return_pct']}%, volatility {v['annual_volatility_pct']}%"
        for sym, v in cluster_info.items()
    )

    rec_lines = "\n".join(
        f"- Buy {sym}: ₹{amt}"
        for sym, amt in recs.items()
    ) if recs else "No new investment specified."

    pro = result.get("pro_forma", {})
    prompt = f"""
You are an expert Indian Stock Market Advisor. Start with "Namaste!". 
Provide a balanced and structured analysis for a {age}-year-old investor aiming for "{goal}".

Rules for the response:
1. DO NOT use markdown bolding (no double asterisks **).
2. USE THE BULLET CHARACTER "•" for each point.
3. Keep the layout clean with clear uppercase headings.
4. Keep the length moderate: write 2 to 3 informative sentences per section. Do not make it too brief, but absolutely avoid walls of text.

Please structure your response STRICTLY with these headings:

📊 PORTFOLIO DIAGNOSIS
• Analyze the current Return ({metrics['expected_annual_return_pct']}%) vs Risk ({metrics['annual_volatility_pct']}%).

🎯 RISK & SUITABILITY
• Evaluate if this profile aligns with a {age}-year-old pursuing "{goal}". Note any vulnerabilities.

💡 ACTIONABLE OPTIMIZATION
• Provide strong justification for why we are investing ₹{new_cash} across these recommended additions: {', '.join(recs.keys()) if recs else "No new trades"}.

🔮 FINANCIAL OUTLOOK
• Discuss the implications of the projected Return jump to {pro.get('expected_annual_return_pct')}% and Sharpe Ratio of {pro.get('sharpe_ratio')}.
"""
    return prompt


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