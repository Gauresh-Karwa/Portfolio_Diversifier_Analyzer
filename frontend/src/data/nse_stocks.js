// Top 200 NSE stocks (Nifty 200 universe) — symbols without .NS suffix
export const NSE_STOCKS = [
  // Nifty 50
  "RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK", "HINDUNILVR", "ITC",
  "SBIN", "BAJFINANCE", "BHARTIARTL", "KOTAKBANK", "LT", "AXISBANK",
  "ASIANPAINT", "MARUTI", "TITAN", "SUNPHARMA", "WIPRO", "HCLTECH",
  "ULTRACEMCO", "NESTLEIND", "TATAMOTORS", "NTPC", "POWERGRID", "ONGC",
  "JSWSTEEL", "TATASTEEL", "M&M", "TECHM", "COALINDIA", "BPCL",
  "GRASIM", "DRREDDY", "ADANIENT", "ADANIPORTS", "CIPLA", "EICHERMOT",
  "BRITANNIA", "BAJAJ-AUTO", "DIVISLAB", "HINDALCO", "INDUSINDBK",
  "APOLLOHOSP", "TATACONSUM", "SBILIFE", "HDFCLIFE", "BAJAJFINSV",
  "HEROMOTOCO", "VEDL", "PIDILITIND",

  // Nifty Next 50
  "SIEMENS", "HAVELLS", "BERGEPAINT", "DABUR", "COLPAL", "MARICO",
  "GODREJCP", "MUTHOOTFIN", "PAGEIND", "TORNTPHARM", "LUPIN",
  "BIOCON", "AUROPHARMA", "ALKEM", "IPCALAB", "GLENMARK",
  "ABBOTINDIA", "PFIZER", "SANOFI", "GLAXO",
  "HDFCAMC", "NIPPONLIFE", "ICICIGI", "ICICIPRULI", "SBICARD",
  "AUBANKIND", "FEDERALBNK", "BANDHANBNK", "IDFCFIRSTB", "PNB",
  "CANBK", "UNIONBANK", "BANKBARODA", "MAHABANK",
  "ADANIGREEN", "ADANIPOWER", "ADANITRANS", "TATAPOWER",
  "TORNTPOWER", "CESC",
  "DLF", "GODREJPROP", "PRESTIGE", "OBEROIREAL", "PHOENIXLTD",
  "CHOLAFIN", "BAJAJHLDNG", "RECLTD", "PFC",
  "RVNL", "IRCTC", "IRFC", "CONCOR",

  // Nifty Midcap 100 (key picks)
  "ZOMATO", "NYKAA", "POLICYBZR", "PAYTM", "DELHIVERY",
  "MAXHEALTH", "FORTIS", "NARAYANA", "RAINBOW",
  "MFSL", "STARHEALTH",
  "TRENT", "DMART", "ABFRL", "RAYMOND", "ADITYA",
  "JUBLFOOD", "DEVYANI", "SAPPHIRE", "WESTLIFE",
  "TATACHEM", "AARTI", "DEEPAKNTR", "GNFC",
  "CUMMINSIND", "THERMAX", "BEL", "HAL", "BHEL", "BEML",
  "CGPOWER", "ABB", "VOLTAS", "WHIRLPOOL", "BLUESTAR",
  "MPHASIS", "PERSISTENT", "LTIM", "COFORGE", "OFSS",
  "ZEEL", "SUNTVNETWORK", "PVRINOX", "INOXWIND",
  "LALPATHLAB", "METROPOLIS", "THYROCARE",
  "ASTRAL", "SUPREMEIND", "POLYPLEX", "GHCL",
  "KALYANKJIL", "SENCO", "RAJESHEXPO",
  "SAIL", "NMDC", "MOIL", "NATIONALUM",
  "KIMS", "YATHARTH", "MEDANTA",
  "HOMEFIRST", "AAVAS", "CREDITACC", "MANAPPURAM",

  // Nifty Smallcap (notable)
  "IREDA", "NHPC", "SJVN", "HUDCO",
  "RAILTEL", "MAZAGON", "GRSE",
  "BIKAJI", "CAMPUSACT",
  "LATENTVIEW", "RATEGAIN", "INTELLECT",
  "MEDPLUS", "VIJAYA",
  "JKCEMENT", "DALMIA", "RAMCOCEM", "PRISM",
  "NUVAMA", "ANAND", "MOTILALOFS",
  "SWSOLAR", "SHYAMMETL", "VGUARD", "AEGISLOG",
  "ADSL", "RITES", "HFCL", "RVNL", "IRCON",
  "IDBI", "UCOBANK", "IOB", "CENTRALBK",
  "HINDZINC", "TATAELXSI", "KPITTECH", "PERSISTENT",
  "JSL", "JINDALSTEL", "NMDC", "SAIL",
  "IDEA", "YESBANK", "SUZLON", "JPPOWER",
  "SOUTHBANK", "KARURVYSYA", "FEDERALBNK",
  "IEX", "MCX", "CDSL",
  "TRIDENT", "ALOKINDS", "RENUKA",
  "HAPPYFORGE", "INDOCO", "JETAIRWAYS",
  "RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK",
  "ADIDAS", // Note: Adidas is not on NSE, but let's see why user thought so
];


/**
 * Returns up to `limit` suggestions from NSE_STOCKS matching the query.
 * Case-insensitive prefix/contains match.
 */
export function suggestTickers(query, limit = 8) {
  if (!query || query.length < 1) return [];
  const q = query.toUpperCase();
  // Prefix matches first, then contains
  const prefix = NSE_STOCKS.filter(s => s.startsWith(q));
  const contains = NSE_STOCKS.filter(s => !s.startsWith(q) && s.includes(q));
  return [...prefix, ...contains].slice(0, limit);
}

/**
 * Returns true if the symbol (without .NS) is in the NSE_STOCKS list.
 */
/**
 * Returns true if the symbol (without .NS) is in the NSE_STOCKS list.
 * We use this for high-confidence suggestions and styling.
 */
export function isVerifiedTicker(symbol) {
  return NSE_STOCKS.includes(symbol.toUpperCase().replace(".NS", ""));
}

/**
 * Returns true if the symbol follows a valid NSE ticker format (Alphanumeric, Hyphen, &).
 * This allows all 2000+ NSE stocks to be entered.
 */
export function isValidNseTicker(symbol) {
  const sym = symbol.toUpperCase().replace(".NS", "");
  if (!sym) return false;
  // Standard NSE Tickers are alphanumeric + hyphen + &
  return /^[A-Z0-9-&]+$/.test(sym);
}
