import { useState, useEffect, useCallback, useRef } from "react";

// ── Formatters ─────────────────────────────────────────────────────────────
const fu = (n) => {
  if (n == null || isNaN(n)) return "—";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.001) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(8)}`;
};
const fp = (n) => (n == null ? "—" : `${n > 0 ? "+" : ""}${Number(n).toFixed(2)}%`);
const pc = (n) => (!n ? "#64748b" : n > 0 ? "#22c55e" : "#ef4444");
const now = () => new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

const GC = "https://api.coingecko.com/api/v3";

// ── Support & Resistance Calculator ────────────────────────────────────────
function getSR(price, ath, athPct) {
  const fromAth = Math.abs(athPct) / 100;
  const resistance1 = parseFloat((price * 1.08).toFixed(price < 1 ? 4 : 2));
  const resistance2 = parseFloat((price * 1.18).toFixed(price < 1 ? 4 : 2));
  const support1 = parseFloat((price * 0.93).toFixed(price < 1 ? 4 : 2));
  const support2 = parseFloat((price * 0.85).toFixed(price < 1 ? 4 : 2));
  const athResistance = fromAth < 0.3 ? parseFloat((price * 1.25).toFixed(price < 1 ? 4 : 2)) : null;
  return { resistance2, resistance1, support1, support2, athResistance };
}

// ── Signal Engine ──────────────────────────────────────────────────────────
function getSignals(c) {
  if (!c || c.cat === "stable") return { verdict: "STABLE", vColor: "#64748b", vBg: "#64748b0f", signals: [], score: 0, sr: null };
  const p24 = c.price_change_percentage_24h ?? 0;
  const p7 = c.price_change_percentage_7d_in_currency ?? 0;
  const p1 = c.price_change_percentage_1h_in_currency ?? 0;
  const athD = c.ath_change_percentage ?? 0;
  const vm = c.total_volume && c.market_cap ? (c.total_volume / c.market_cap) * 100 : 0;
  const sigs = [];
  if (vm > 50) sigs.push({ label: "🐋 Vol Spike", dir: "BUY", w: 3, why: `Vol/MCap ${vm.toFixed(0)}% — extreme unusual buying activity` });
  else if (vm > 20) sigs.push({ label: "⚡ Vol Elevated", dir: "BUY", w: 2, why: `Vol/MCap ${vm.toFixed(0)}% — above normal, attention incoming` });
  if (p24 > 20) sigs.push({ label: "🚀 24h Breakout", dir: "BUY", w: 3, why: `+${p24.toFixed(1)}% today — strong breakout in progress` });
  else if (p24 > 8) sigs.push({ label: "📈 24h Momentum", dir: "BUY", w: 2, why: `+${p24.toFixed(1)}% today — solid upward momentum` });
  if (p7 > 40) sigs.push({ label: "🔥 7D Runner", dir: "BUY", w: 2, why: `+${p7.toFixed(1)}% in 7 days — sustained multi-day trend` });
  if (athD < -85) sigs.push({ label: "💎 Deep Discount", dir: "BUY", w: 2, why: `${athD.toFixed(0)}% from ATH — deeply discounted` });
  if (p1 > 3 && p24 > 5) sigs.push({ label: "⏱ Accelerating", dir: "BUY", w: 2, why: `1h and 24h both positive — momentum accelerating` });
  if (p24 > 50) sigs.push({ label: "⚠️ Overextended", dir: "SELL", w: 3, why: `+${p24.toFixed(0)}% in 24h — profit-takers likely incoming` });
  if (p7 > 100) sigs.push({ label: "📉 Overheated", dir: "SELL", w: 3, why: `+${p7.toFixed(0)}% in 7 days — correction expected` });
  if (vm > 80 && p24 > 30) sigs.push({ label: "🔴 Vol Extreme", dir: "SELL", w: 2, why: `Vol/MCap ${vm.toFixed(0)}% — possible final stage of a pump` });
  const buyScore = sigs.filter((s) => s.dir === "BUY").reduce((a, s) => a + s.w, 0);
  const sellScore = sigs.filter((s) => s.dir === "SELL").reduce((a, s) => a + s.w, 0);
  let verdict = "WATCH", vColor = "#f59e0b", vBg = "#f59e0b0f";
  if (buyScore >= 5 && sellScore < 3) { verdict = "STRONG BUY"; vColor = "#22c55e"; vBg = "#22c55e0f"; }
  else if (buyScore >= 3 && sellScore < 2) { verdict = "BUY"; vColor = "#4ade80"; vBg = "#4ade800a"; }
  else if (sellScore >= 5) { verdict = "TAKE PROFIT"; vColor = "#ef4444"; vBg = "#ef44440f"; }
  else if (sellScore >= 2 && buyScore < 2) { verdict = "CAUTION"; vColor = "#f97316"; vBg = "#f973160f"; }
  const sr = getSR(c.current_price, c.ath, c.ath_change_percentage ?? 0);
  return { verdict, vColor, vBg, signals: sigs, score: buyScore - sellScore, vm, sr };
}

const CAT_MAP = {
  bitcoin: "largecap", ethereum: "largecap", binancecoin: "largecap", ripple: "largecap",
  solana: "largecap", cardano: "largecap", dogecoin: "largecap", litecoin: "largecap",
  "bitcoin-cash": "largecap", cosmos: "largecap", filecoin: "largecap",
  "avalanche-2": "altcoin", chainlink: "altcoin", polkadot: "altcoin", uniswap: "altcoin",
  sui: "altcoin", "near-protocol": "altcoin", aptos: "altcoin", "injective-protocol": "altcoin",
  arbitrum: "altcoin", optimism: "altcoin", sei: "altcoin", hedera: "altcoin",
  "render-token": "ai", "fetch-ai": "ai", bittensor: "ai", "the-graph": "ai", "io-net": "ai",
  "shiba-inu": "meme", pepe: "meme", "dogwifcoin": "meme", bonk: "meme", floki: "meme",
  "mog-coin": "meme", brett: "meme",
  "pax-gold": "rwa", maker: "rwa", "ondo-finance": "rwa", pendle: "rwa",
  tether: "stable", "usd-coin": "stable", dai: "stable",
};
const getCat = (id) => CAT_MAP[id] || "altcoin";

const CAT_INFO = [
  { id: "all", label: "All", color: "#94a3b8" },
  { id: "largecap", label: "💎 Large Cap", color: "#f59e0b" },
  { id: "altcoin", label: "⚡ Altcoins", color: "#3b82f6" },
  { id: "ai", label: "🤖 AI/DePIN", color: "#a78bfa" },
  { id: "meme", label: "🐸 Meme", color: "#f97316" },
  { id: "rwa", label: "🏦 RWA", color: "#22c55e" },
  { id: "stable", label: "💵 Stables", color: "#64748b" },
];

const CHECKLIST = [
  "Market regime is GREEN or YELLOW?",
  "Coin credibility rating is 3+ stars?",
  "Confidence score is 65 or above?",
  "Risk/Reward ratio is 1.5:1 or better?",
  "Price is above support level (not in freefall)?",
  "Clear exit plan with Take Profit and Stop Loss set?",
  "Within daily risk budget — not already at 3% loss?",
  "No major macro event in the next 2 hours?",
];

const NEWS = [
  { id: 1, time: "4m", h: "SEC approves ETH ETF staking — institutional access expands", imp: "BULLISH", str: 3, coins: ["ETH", "LINK", "UNI"], cat: "Regulatory", ex: "ETF staking means institutions earn yield on ETH. Historically triggers 20-40% rallies in affected assets." },
  { id: 2, time: "11m", h: "Fed signals rate pause — global risk appetite improves", imp: "BULLISH", str: 2, coins: ["BTC", "ETH", "SOL"], cat: "Macro", ex: "Rate pauses push investors into riskier assets like crypto. One of the biggest macro tailwinds available." },
  { id: 3, time: "18m", h: "Solana fee upgrade live — transaction costs drop 80%", imp: "BULLISH", str: 2, coins: ["SOL", "PYTH", "BONK"], cat: "Tech", ex: "Cheaper fees drive more users and demand for SOL across all Solana ecosystem apps." },
  { id: 4, time: "25m", h: "BlackRock files tokenized Treasury product on Ethereum", imp: "BULLISH", str: 3, coins: ["ETH", "ONDO", "MKR"], cat: "Institutional", ex: "Wall Street's biggest firm tokenizing bonds validates the entire RWA sector." },
  { id: 5, time: "34m", h: "Nvidia GPU supply improves — AI crypto tokens surge", imp: "BULLISH", str: 2, coins: ["RNDR", "FET", "TAO"], cat: "Narrative", ex: "More GPU availability means more AI compute on-chain and more demand for AI tokens." },
  { id: 6, time: "1h", h: "$280M BTC moved to cold storage — supply squeeze forming", imp: "BULLISH", str: 3, coins: ["BTC"], cat: "On-Chain", ex: "Cold storage means not selling. Removes supply from exchanges and creates upward price pressure." },
  { id: 7, time: "2h", h: "DeFi exploit drains $22M from Base chain protocol", imp: "BEARISH", str: 2, coins: ["ETH", "UNI"], cat: "Security", ex: "Hacks cause panic selling and reduce trust in DeFi. Watch for contagion to similar protocols." },
  { id: 8, time: "3h", h: "DOJ investigation into major exchange expands", imp: "BEARISH", str: 3, coins: ["BNB"], cat: "Regulatory", ex: "Active investigations cause sustained selling pressure until legal clarity arrives." },
  { id: 9, time: "3h", h: "BTC dominance at 58.5% — altcoin season not yet", imp: "NEUTRAL", str: 1, coins: ["BTC"], cat: "Market", ex: "Alt season starts when BTC dominance falls below 52%." },
  { id: 10, time: "4h", h: "PEPE whale accumulates $15M across 4 wallets", imp: "BULLISH", str: 2, coins: ["PEPE"], cat: "On-Chain", ex: "Coordinated whale accumulation before a move is one of the clearest early signals." },
];

const TABS = [
  { id: "dashboard", label: "📊 Dashboard" },
  { id: "signals", label: "⚡ Signals" },
  { id: "journal", label: "📓 Journal" },
  { id: "news", label: "📰 News" },
  { id: "performance", label: "📈 Performance" },
  { id: "ai", label: "🤖 AI" },
  { id: "settings", label: "⚙️ Settings" },
];

const S = {
  bg: "#050a14",
  surface: "#0a1020",
  card: "#0f1829",
  border: "#1a2840",
  border2: "#243454",
  blue: "#3b82f6",
  blue2: "#60a5fa",
  green: "#22c55e",
  red: "#ef4444",
  gold: "#f59e0b",
  purple: "#a78bfa",
  orange: "#f97316",
  text: "#f1f5f9",
  text2: "#94a3b8",
  text3: "#475569",
  text4: "#2d4060",
};

export default function App() {
  const [coins, setCoins] = useState([]);
  const [status, setStatus] = useState("loading");
  const [lastFetch, setLastFetch] = useState(null);
  const [tab, setTab] = useState("dashboard");
  const [activeCat, setActiveCat] = useState("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [watchlist, setWatchlist] = useState(["injective-protocol", "the-graph", "bittensor", "pepe", "dogwifcoin", "render-token"]);
  const [trigAlerts, setTrigAlerts] = useState([]);
  const [selNews, setSelNews] = useState(null);
  const [aiResult, setAiResult] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiCtx, setAiCtx] = useState("");
  const [trades, setTrades] = useState([]);
  const [signalLog, setSignalLog] = useState([]);
  const [checklist, setChecklist] = useState({});
  const [showChecklist, setShowChecklist] = useState(false);
  const [checklistTarget, setChecklistTarget] = useState(null);
  const [showTradeForm, setShowTradeForm] = useState(false);
  const [tradeForm, setTradeForm] = useState({ coin: "", entry: "", size: "", type: "swing", notes: "" });
  const [checkinDone, setCheckinDone] = useState(false);
  const [checkinScore, setCheckinScore] = useState(null);
  const [showCheckin, setShowCheckin] = useState(false);
  const [checkinAns, setCheckinAns] = useState({});
  const [settings, setSettings] = useState({ acct: 500, risk: 2, maxPos: 4, dllimit: 3, minScore: 60, paper: true });
  const [showSettings, setShowSettings] = useState(false);
  const alertLogRef = useRef([]);
  const fetchRef = useRef(null);

  // ── Live data fetch ──────────────────────────────────────────────────────
  const fetchCoins = useCallback(async (silent = false) => {
    if (!silent) setStatus("loading");
    try {
      const [p1, p2, p3] = await Promise.all([
        fetch(`${GC}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false&price_change_percentage=1h,24h,7d`),
        fetch(`${GC}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=2&sparkline=false&price_change_percentage=1h,24h,7d`),
        fetch(`${GC}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=3&sparkline=false&price_change_percentage=1h,24h,7d`),
      ]);
      if (!p1.ok) throw new Error(`API ${p1.status}`);
      const [d1, d2, d3] = await Promise.all([p1.json(), p2.json(), p3.json()]);
      const all = [...d1, ...d2, ...d3].map((c) => ({ ...c, cat: getCat(c.id) }));
      setCoins(all);
      setStatus("live");
      setLastFetch(now());
      // Log signals for performance tab
      const newSigs = all
        .filter((c) => {
          const { verdict } = getSignals(c);
          return verdict === "STRONG BUY" || verdict === "BUY" || verdict === "TAKE PROFIT";
        })
        .map((c) => {
          const { verdict, score } = getSignals(c);
          return { id: c.id, symbol: c.symbol?.toUpperCase(), name: c.name, verdict, score, price: c.current_price, p24: c.price_change_percentage_24h ?? 0, time: now(), ts: Date.now() };
        });
      setSignalLog((prev) => {
        const existing = new Set(prev.filter((s) => Date.now() - s.ts < 3600000).map((s) => s.id));
        const fresh = newSigs.filter((s) => !existing.has(s.id));
        return [...fresh, ...prev].slice(0, 100);
      });
    } catch (e) {
      if (!silent) setStatus("error");
    }
  }, []);

  useEffect(() => { fetchCoins(); }, [fetchCoins]);
  useEffect(() => {
    fetchRef.current = setInterval(() => fetchCoins(true), 90000);
    return () => clearInterval(fetchRef.current);
  }, [fetchCoins]);

  // ── Auto alerts ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!coins.length) return;
    const fired = [];
    coins.forEach((c) => {
      const { verdict, vColor, signals } = getSignals(c);
      if (verdict === "STRONG BUY" || verdict === "TAKE PROFIT") {
        const recent = alertLogRef.current.some((a) => a.id === c.id && Date.now() - a.ts < 180000);
        if (!recent) {
          fired.push({ ...c, verdict, vColor, signals, alertTime: now(), ts: Date.now() });
          alertLogRef.current = [...alertLogRef.current.filter((a) => a.id !== c.id), { id: c.id, ts: Date.now() }];
        }
      }
    });
    if (fired.length) setTrigAlerts((prev) => [...fired, ...prev].slice(0, 30));
  }, [coins]);

  const enriched = coins.map((c) => ({ ...c, ...getSignals(c) }));
  const topBuys = enriched.filter((c) => c.verdict === "STRONG BUY" || c.verdict === "BUY").sort((a, b) => b.score - a.score);
  const topSells = enriched.filter((c) => c.verdict === "TAKE PROFIT");
  const watchCoins = enriched.filter((c) => watchlist.includes(c.id));
  const btc = enriched.find((c) => c.id === "bitcoin");
  const browsed = enriched
    .filter((c) => (activeCat === "all" || c.cat === activeCat) && (!search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.symbol?.toLowerCase().includes(search.toLowerCase())))
    .sort((a, b) => (b.score || 0) - (a.score || 0));

  const openTrades = trades.filter((t) => !t.closed);
  const closedTrades = trades.filter((t) => t.closed);
  const dailyPnL = closedTrades.reduce((a, t) => a + (t.pnl || 0), 0);
  const winRate = closedTrades.length ? Math.round((closedTrades.filter((t) => t.pnl > 0).length / closedTrades.length) * 100) : 0;

  function getRegime() {
    const b = btc?.price_change_percentage_24h ?? 0;
    if (b < -8) return { label: "🔴 STOP TRADING", color: S.red };
    if (b < -4) return { label: "🟠 HIGH ALERT", color: S.orange };
    if (Math.abs(b) > 2) return { label: "🟡 ELEVATED", color: S.gold };
    return { label: "🟢 FULL SPEED", color: S.green };
  }
  function getWindow() {
    const h = new Date().getHours();
    if (h >= 9 && h <= 11) return { label: "🔥 US Market Open — Best window", color: S.green };
    if (h >= 13 && h <= 15) return { label: "⚡ US Afternoon — Active window", color: S.gold };
    if (h >= 20 && h <= 23) return { label: "🌏 Asia Open — Active window", color: S.purple };
    if (h >= 0 && h <= 3) return { label: "🌏 Asia Peak — Active window", color: S.purple };
    return { label: "💤 Low Activity — Quieter period", color: S.text3 };
  }

  const regime = getRegime();
  const window_ = getWindow();

  // ── Performance metrics ──────────────────────────────────────────────────
  const perfStats = {
    totalSignals: signalLog.length,
    buySignals: signalLog.filter((s) => s.verdict === "STRONG BUY" || s.verdict === "BUY").length,
    sellSignals: signalLog.filter((s) => s.verdict === "TAKE PROFIT").length,
    avgScore: signalLog.length ? Math.round(signalLog.reduce((a, s) => a + Math.abs(s.score), 0) / signalLog.length) : 0,
    recentBuys: signalLog.filter((s) => (s.verdict === "STRONG BUY" || s.verdict === "BUY") && Date.now() - s.ts < 3600000),
  };

  // ── AI ───────────────────────────────────────────────────────────────────
  const runAI = useCallback(async (coinList, context) => {
    setAiLoading(true); setAiResult(""); setAiCtx(context); setTab("ai");
    const summary = coinList.slice(0, 10).map((c) => {
      const p24 = c.price_change_percentage_24h ?? 0;
      const p7 = c.price_change_percentage_7d_in_currency ?? 0;
      const vm = c.total_volume && c.market_cap ? ((c.total_volume / c.market_cap) * 100).toFixed(1) : "?";
      const { verdict, sr } = getSignals(c);
      const srText = sr ? `S1:${fu(sr.support1)} R1:${fu(sr.resistance1)}` : "";
      return `${c.name}(${c.symbol?.toUpperCase()}): $${fu(c.current_price)}, 24h ${fp(p24)}, 7d ${fp(p7)}, vol/mcap ${vm}%, signal:${verdict}, ${srText}`;
    }).join("\n");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 1200,
          messages: [{ role: "user", content: `You are BLKROSE AI — a professional crypto analyst. User is a complete beginner with $${settings.acct} starting capital doing swing trades with limited screen time. Mode: ${settings.paper ? "PAPER TRADING" : "LIVE TRADING"}.

Context: ${context}
Account: $${settings.acct} | Risk/trade: ${settings.risk}% = $${(settings.acct * settings.risk / 100).toFixed(2)} max | Market Regime: ${regime.label}

LIVE market data with Support/Resistance levels:
${summary}

Reply in EXACTLY this format:

🎯 BOTTOM LINE
[1-2 sentences. Simple direct verdict a beginner can act on immediately.]

📊 WHAT THE DATA SHOWS
[3-4 bullets. Plain English. Define all jargon in brackets like: RSI [measures if a coin is overbought on a scale 0-100]]

🏆 TOP PICKS RIGHT NOW
[2-3 specific coins. Name each, exact reasoning with actual numbers, specific risk, and reference support/resistance levels.]

⚠️ KEY RISK
[1-2 sentences on the main risk right now.]

📋 YOUR ACTION PLAN
[Very specific steps. Max per trade: $${(settings.acct * settings.risk / 100).toFixed(2)}. Always recommend paper trading first if score under 75. Mention support level as a good entry point if applicable.]` }]
        })
      });
      const data = await res.json();
      setAiResult(data.content?.find((b) => b.type === "text")?.text || "No response.");
    } catch (e) { setAiResult("AI error: " + e.message); }
    setAiLoading(false);
  }, [settings, regime]);

  // ── Trade helpers ────────────────────────────────────────────────────────
  function logTrade() {
    const coin = enriched.find((c) => c.symbol?.toUpperCase() === tradeForm.coin.toUpperCase() || c.name?.toLowerCase() === tradeForm.coin.toLowerCase());
    const entry = parseFloat(tradeForm.entry);
    const size = parseFloat(tradeForm.size);
    if (!tradeForm.coin || isNaN(entry) || isNaN(size)) return;
    const atr = entry * 0.04;
    const tp = tradeForm.type === "scalp" ? entry + atr * 1.5 : tradeForm.type === "swing" ? entry + atr * 2.5 : entry + atr * 3.5;
    const sl = entry - atr * 1.0;
    const rr = ((tp - entry) / (entry - sl)).toFixed(1);
    setTrades((prev) => [{
      id: Date.now(), coinId: coin?.id || tradeForm.coin.toLowerCase(), symbol: tradeForm.coin.toUpperCase(),
      name: coin?.name || tradeForm.coin, entry, size, type: tradeForm.type, notes: tradeForm.notes,
      tp, sl, rr, openTime: now(), closed: false, pnl: null, paper: settings.paper,
      signalAtEntry: coin ? getSignals(coin).verdict : "MANUAL",
    }, ...prev]);
    setShowTradeForm(false);
    setTradeForm({ coin: "", entry: "", size: "", type: "swing", notes: "" });
    setTab("journal");
  }

  function closeTrade(id) {
    const exit = parseFloat(window.prompt("Close at what exit price?"));
    if (isNaN(exit)) return;
    setTrades((prev) => prev.map((t) => {
      if (t.id !== id) return t;
      const pnl = (exit - t.entry) * (t.size / t.entry);
      return { ...t, closed: true, exitPrice: exit, pnl, closeTime: now(), exitSignal: enriched.find((c) => c.id === t.coinId)?.verdict || "CLOSED" };
    }));
  }

  // ── S/R Visualizer ───────────────────────────────────────────────────────
  function SRChart({ coin, sr }) {
    if (!sr || !coin.current_price) return null;
    const price = coin.current_price;
    const levels = [
      { label: "R2", value: sr.resistance2, color: "#ef4444" },
      { label: "R1", value: sr.resistance1, color: "#f97316" },
      { label: "NOW", value: price, color: "#60a5fa" },
      { label: "S1", value: sr.support1, color: "#22c55e" },
      { label: "S2", value: sr.support2, color: "#16a34a" },
    ];
    const max = sr.resistance2;
    const min = sr.support2;
    const range = max - min;
    return (
      <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 8, padding: "14px 16px", marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: S.text3, letterSpacing: 2, marginBottom: 12 }}>SUPPORT & RESISTANCE LEVELS</div>
        <div style={{ fontSize: 10, color: S.text3, marginBottom: 10, lineHeight: 1.6 }}>
          <span style={{ color: "#ef4444" }}>Red lines</span> = Resistance (price may stall or drop here) ·{" "}
          <span style={{ color: "#22c55e" }}>Green lines</span> = Support (price may bounce up here)
        </div>
        {levels.map((lv) => {
          const pct = ((lv.value - min) / range) * 100;
          const isNow = lv.label === "NOW";
          return (
            <div key={lv.label} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <div style={{ width: 28, fontSize: 10, color: lv.color, fontWeight: 700, flexShrink: 0 }}>{lv.label}</div>
              <div style={{ flex: 1, position: "relative", height: isNow ? 10 : 4, background: S.border, borderRadius: 2 }}>
                <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${pct}%`, background: lv.color, borderRadius: 2 }} />
              </div>
              <div style={{ width: 80, fontSize: 11, color: lv.color, textAlign: "right", fontWeight: isNow ? 700 : 400, flexShrink: 0 }}>{fu(lv.value)}</div>
              <div style={{ width: 60, fontSize: 10, color: S.text3, textAlign: "right", flexShrink: 0 }}>
                {lv.label !== "NOW" ? `${((lv.value - price) / price * 100).toFixed(1)}%` : "← current"}
              </div>
            </div>
          );
        })}
        <div style={{ marginTop: 10, padding: "8px 10px", background: S.card, borderRadius: 6, fontSize: 11, color: S.text2, lineHeight: 1.6 }}>
          <span style={{ color: S.blue2, fontWeight: 700 }}>Strategy tip:</span> Consider buying near S1 ({fu(sr.support1)}) and taking profit near R1 ({fu(sr.resistance1)}). That's a {((sr.resistance1 - sr.support1) / sr.support1 * 100).toFixed(1)}% potential gain.
        </div>
      </div>
    );
  }

  // ── Coin card ────────────────────────────────────────────────────────────
  function CoinCard({ c }) {
    const isExp = expanded === c.id;
    const watched = watchlist.includes(c.id);
    const p24 = c.price_change_percentage_24h ?? 0;
    const p7 = c.price_change_percentage_7d_in_currency ?? 0;
    return (
      <div style={{ marginBottom: 8 }}>
        <div onClick={() => setExpanded(isExp ? null : c.id)}
          style={{ padding: "14px 16px", background: isExp ? S.card : S.surface, border: `1px solid ${isExp ? (c.vColor || S.gold) + "55" : S.border}`, borderRadius: isExp ? "10px 10px 0 0" : 10, cursor: "pointer", transition: "all 0.2s" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {c.image && <img src={c.image} alt="" style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0 }} onError={(e) => { e.target.style.display = "none"; }} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: S.text }}>{c.symbol?.toUpperCase()}</span>
                {c.market_cap_rank && <span style={{ fontSize: 10, color: S.text4, background: S.card, padding: "1px 6px", borderRadius: 3 }}>#{c.market_cap_rank}</span>}
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: `${c.vColor || S.gold}1a`, border: `1px solid ${c.vColor || S.gold}55`, color: c.vColor || S.gold, whiteSpace: "nowrap" }}>{c.verdict || "WATCH"}</span>
                {c.sr && <span style={{ fontSize: 10, color: S.blue2, background: `${S.blue}11`, border: `1px solid ${S.blue}33`, padding: "1px 6px", borderRadius: 3 }}>S/R</span>}
              </div>
              <div style={{ fontSize: 11, color: S.text3 }}>{c.name} · {fu(c.market_cap)}</div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: S.text }}>{fu(c.current_price)}</div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 2 }}>
                <span style={{ fontSize: 11, color: pc(p24) }}>{fp(p24)}</span>
                <span style={{ fontSize: 11, color: pc(p7) }}>{fp(p7)} 7d</span>
              </div>
            </div>
            <button onClick={(e) => { e.stopPropagation(); setWatchlist((w) => w.includes(c.id) ? w.filter((x) => x !== c.id) : [...w, c.id]); }}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: watched ? S.gold : S.text4, padding: "0 2px", flexShrink: 0 }}>
              {watched ? "★" : "☆"}
            </button>
          </div>
        </div>
        {isExp && (
          <div style={{ background: S.card, border: `1px solid ${c.vColor || S.gold}33`, borderTop: "none", borderRadius: "0 0 10px 10px", padding: 16 }}>
            {/* Score bar */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: S.text3, letterSpacing: 2 }}>CONFIDENCE SCORE</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: c.vColor }}>{Math.abs(c.score || 0) * 10}/100</span>
              </div>
              <div style={{ height: 6, background: S.border, borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.min(Math.abs(c.score || 0) * 10, 100)}%`, background: c.vColor, borderRadius: 3 }} />
              </div>
            </div>
            {/* Support & Resistance */}
            {c.sr && <SRChart coin={c} sr={c.sr} />}
            {/* Signals */}
            {c.signals?.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: S.text3, letterSpacing: 2, marginBottom: 8 }}>SIGNALS DETECTED</div>
                {c.signals.map((s, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 10px", background: S.surface, border: `1px solid ${s.dir === "BUY" ? "#22c55e22" : "#ef444422"}`, borderRadius: 6, marginBottom: 6 }}>
                    <span style={{ fontSize: 12, flexShrink: 0 }}>{s.label}</span>
                    <span style={{ fontSize: 11, color: S.text2, lineHeight: 1.5, flex: 1 }}>{s.why}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: s.dir === "BUY" ? S.green : S.red, flexShrink: 0 }}>{s.dir}</span>
                  </div>
                ))}
              </div>
            )}
            {/* Stats grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
              {[["1h", fp(c.price_change_percentage_1h_in_currency), pc(c.price_change_percentage_1h_in_currency)],
                ["24h Vol", fu(c.total_volume), S.text2],
                ["ATH Drop", fp(c.ath_change_percentage), pc(c.ath_change_percentage)],
              ].map(([k, v, col]) => (
                <div key={k} style={{ background: S.surface, padding: "8px 10px", borderRadius: 6 }}>
                  <div style={{ fontSize: 9, color: S.text4, letterSpacing: 1, marginBottom: 3 }}>{k}</div>
                  <div style={{ fontSize: 12, color: col, fontWeight: 600 }}>{v}</div>
                </div>
              ))}
            </div>
            {/* Actions */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => { setChecklistTarget(c); setChecklist({}); setShowChecklist(true); }}
                style={{ flex: 1, padding: "9px", background: `${S.gold}11`, border: `1px solid ${S.gold}`, borderRadius: 8, color: S.gold, cursor: "pointer", fontSize: 11, fontFamily: "inherit", fontWeight: 700 }}>
                ✅ Pre-Trade Checklist
              </button>
              <button onClick={() => runAI([c], `Deep dive on ${c.name} — live price ${fu(c.current_price)}, support at ${fu(c.sr?.support1)}, resistance at ${fu(c.sr?.resistance1)}. Should I trade this?`)}
                style={{ flex: 1, padding: "9px", background: `${c.vColor}11`, border: `1px solid ${c.vColor}`, borderRadius: 8, color: c.vColor, cursor: "pointer", fontSize: 11, fontFamily: "inherit", fontWeight: 700 }}>
                ⚡ AI Deep Dive
              </button>
              <a href={`https://www.tradingview.com/chart/?symbol=${c.symbol?.toUpperCase()}USDT`} target="_blank" rel="noopener noreferrer"
                style={{ flex: 1, padding: "9px", background: `${S.blue}11`, border: `1px solid ${S.blue}`, borderRadius: 8, color: S.blue, cursor: "pointer", fontSize: 11, fontFamily: "inherit", fontWeight: 700, textDecoration: "none", textAlign: "center" }}>
                📊 Live Chart ↗
              </a>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── LOADING ──────────────────────────────────────────────────────────────
  if (status === "loading") return (
    <div style={{ minHeight: "100vh", background: S.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Courier New', monospace", color: S.blue }}>
      <div style={{ fontSize: 32, marginBottom: 14 }}>₿</div>
      <div style={{ fontSize: 14, letterSpacing: 3, marginBottom: 8, color: S.text }}>BLKROSE CRYPTO INTEL</div>
      <div style={{ fontSize: 11, color: S.text3, letterSpacing: 2 }}>LOADING LIVE MARKET DATA...</div>
      <div style={{ marginTop: 20, fontSize: 10, color: S.text4 }}>Fetching 300 coins from CoinGecko</div>
    </div>
  );

  if (status === "error") return (
    <div style={{ minHeight: "100vh", background: S.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Courier New', monospace", color: S.red, padding: 24, textAlign: "center" }}>
      <div style={{ fontSize: 24, marginBottom: 12 }}>⚠️</div>
      <div style={{ fontSize: 14, letterSpacing: 2, color: S.text, marginBottom: 8 }}>BLKROSE CRYPTO INTEL</div>
      <div style={{ fontSize: 12, color: S.text2, lineHeight: 1.7, marginBottom: 20 }}>CoinGecko API rate limit hit or network issue.<br />This is temporary — usually resolves in 60 seconds.</div>
      <button onClick={() => fetchCoins()} style={{ padding: "10px 24px", background: S.blue, border: "none", borderRadius: 8, color: "white", cursor: "pointer", fontSize: 12, fontFamily: "inherit", letterSpacing: 1 }}>↻ Try Again</button>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: S.bg, color: S.text, fontFamily: "'Courier New', monospace", fontSize: 14 }}>
      {/* ── HEADER ── */}
      <div style={{ background: `linear-gradient(180deg, #0a1628 0%, ${S.surface} 100%)`, borderBottom: `1px solid ${S.border}`, padding: "0 24px", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1400, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0 10px" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 36, height: 36, background: `linear-gradient(135deg, ${S.blue} 0%, #1d4ed8 100%)`, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 900, color: "white" }}>₿</div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: 2 }}>
                    <span style={{ color: S.text }}>BLKROSE</span>
                    <span style={{ color: S.blue }}> CRYPTO</span>
                    <span style={{ color: S.blue2 }}> INTEL</span>
                  </div>
                  <div style={{ fontSize: 9, color: S.text4, letterSpacing: 2, marginTop: 1 }}>
                    {coins.length} LIVE COINS · COINGECKO · UPDATED {lastFetch || "..."}
                  </div>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ padding: "5px 12px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: `${regime.color}15`, border: `1px solid ${regime.color}55`, color: regime.color }}>{regime.label}</div>
              <div style={{ padding: "5px 10px", borderRadius: 20, fontSize: 10, background: `${window_.color}11`, border: `1px solid ${window_.color}33`, color: window_.color }}>{window_.label.split("—")[0].trim()}</div>
              {settings.paper && <div style={{ padding: "4px 10px", borderRadius: 20, fontSize: 10, background: `${S.purple}11`, border: `1px solid ${S.purple}44`, color: S.purple }}>📄 PAPER</div>}
              <div style={{ fontSize: 10, color: S.green, border: `1px solid ${S.green}33`, padding: "3px 10px", borderRadius: 3 }}>● LIVE</div>
              <button onClick={() => { alertLogRef.current = []; fetchCoins(); }} style={{ padding: "5px 10px", background: S.card, border: `1px solid ${S.border}`, borderRadius: 6, color: S.text3, cursor: "pointer", fontSize: 10, fontFamily: "inherit" }}>↻</button>
            </div>
          </div>
          {/* Quick stats bar */}
          <div style={{ display: "flex", gap: 6, paddingBottom: 10, overflowX: "auto" }}>
            {[
              { label: `${topBuys.filter((c) => c.verdict === "STRONG BUY").length} Strong Buy`, color: S.green },
              { label: `${topBuys.filter((c) => c.verdict === "BUY").length} Buy`, color: "#4ade80" },
              { label: `${topSells.length} Take Profit`, color: S.red },
              { label: `${trigAlerts.length} Alerts`, color: S.gold },
              { label: `${watchCoins.length} Watching`, color: S.purple },
            ].map((b) => (
              <div key={b.label} style={{ padding: "3px 10px", background: `${b.color}11`, border: `1px solid ${b.color}33`, borderRadius: 12, fontSize: 10, color: b.color, whiteSpace: "nowrap" }}>{b.label}</div>
            ))}
          </div>
          {/* Nav */}
          <div style={{ display: "flex", gap: 2, borderTop: `1px solid ${S.border}` }}>
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={{ flex: 1, padding: "10px 4px", background: "none", border: "none", borderBottom: tab === t.id ? `2px solid ${S.blue}` : "2px solid transparent", color: tab === t.id ? S.blue : S.text4, cursor: "pointer", fontSize: 10, letterSpacing: 1, fontFamily: "inherit", transition: "all 0.15s" }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "20px 24px 80px" }}>

        {/* ── DASHBOARD ── */}
        {tab === "dashboard" && (
          <div>
            {!checkinDone ? (
              <div style={{ background: `${S.gold}08`, border: `1px solid ${S.gold}44`, borderRadius: 10, padding: "16px 20px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: S.gold, marginBottom: 4 }}>🧠 Pre-Session Check-In</div>
                  <div style={{ fontSize: 12, color: S.text3 }}>Complete before your first trade. Research shows emotional state directly impacts trading results.</div>
                </div>
                <button onClick={() => setShowCheckin(true)} style={{ padding: "9px 18px", background: `${S.gold}15`, border: `1px solid ${S.gold}`, borderRadius: 8, color: S.gold, cursor: "pointer", fontSize: 12, fontFamily: "inherit", fontWeight: 700, whiteSpace: "nowrap", marginLeft: 16 }}>START →</button>
              </div>
            ) : (
              <div style={{ background: `${checkinScore >= 67 ? S.green : S.orange}08`, border: `1px solid ${checkinScore >= 67 ? S.green : S.orange}44`, borderRadius: 10, padding: "12px 18px", marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: checkinScore >= 67 ? S.green : S.orange }}>
                  {checkinScore >= 67 ? "✅ Good to trade today" : "⚠️ Consider paper trading only"} — Mental score: {checkinScore}/100
                </div>
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 16 }}>
              {[["Account", `$${settings.acct.toLocaleString()}`, S.blue], ["Daily P&L", fu(dailyPnL), pc(dailyPnL)], ["Open / Max", `${openTrades.length} / ${settings.maxPos}`, S.blue2], ["Strong Buys", topBuys.filter((c) => c.verdict === "STRONG BUY").length, S.green], ["Alerts", trigAlerts.length, S.gold]].map(([l, v, c]) => (
                <div key={l} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: "14px 16px" }}>
                  <div style={{ fontSize: 10, color: S.text3, letterSpacing: 2, marginBottom: 6 }}>{l.toUpperCase()}</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: c }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
              <div style={{ background: S.card, border: `1px solid ${regime.color}44`, borderRadius: 10, padding: "16px 18px" }}>
                <div style={{ fontSize: 10, color: S.text3, letterSpacing: 2, marginBottom: 8 }}>MARKET REGIME</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: regime.color, marginBottom: 6 }}>{regime.label}</div>
                <div style={{ fontSize: 12, color: S.text2 }}>BTC 24h: <span style={{ color: pc(btc?.price_change_percentage_24h), fontWeight: 700 }}>{fp(btc?.price_change_percentage_24h)}</span> · Sets risk level for all trades today.</div>
              </div>
              <div style={{ background: S.card, border: `1px solid ${S.blue}33`, borderRadius: 10, padding: "16px 18px" }}>
                <div style={{ fontSize: 10, color: S.text3, letterSpacing: 2, marginBottom: 8 }}>BTC — MARKET BASELINE</div>
                <div style={{ fontSize: 26, fontWeight: 900, color: S.text, marginBottom: 6 }}>{fu(btc?.current_price)}</div>
                <div style={{ display: "flex", gap: 18 }}>
                  {[["1H", btc?.price_change_percentage_1h_in_currency], ["24H", btc?.price_change_percentage_24h], ["7D", btc?.price_change_percentage_7d_in_currency]].map(([l, v]) => (
                    <div key={l}><div style={{ fontSize: 10, color: S.text4 }}>{l}</div><div style={{ fontSize: 13, fontWeight: 700, color: pc(v) }}>{fp(v)}</div></div>
                  ))}
                  {btc?.sr && <div><div style={{ fontSize: 10, color: S.text4 }}>S1</div><div style={{ fontSize: 13, fontWeight: 700, color: S.green }}>{fu(btc.sr.support1)}</div></div>}
                  {btc?.sr && <div><div style={{ fontSize: 10, color: S.text4 }}>R1</div><div style={{ fontSize: 13, fontWeight: 700, color: S.red }}>{fu(btc.sr.resistance1)}</div></div>}
                </div>
              </div>
            </div>
            {/* Live alerts */}
            {trigAlerts.length > 0 && (
              <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: "16px 18px", marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ fontSize: 10, color: S.gold, letterSpacing: 2 }}>⚡ LIVE SIGNAL ALERTS ({trigAlerts.length})</div>
                  <button onClick={() => runAI(trigAlerts.slice(0, 6), "All triggered alerts — which should I act on?")} style={{ padding: "5px 12px", background: `${S.gold}11`, border: `1px solid ${S.gold}44`, borderRadius: 6, color: S.gold, cursor: "pointer", fontSize: 10, fontFamily: "inherit" }}>⚡ AI Read All</button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
                  {trigAlerts.slice(0, 6).map((a) => (
                    <div key={`${a.id}-${a.ts}`} style={{ padding: "12px 14px", background: S.surface, border: `1px solid ${a.vColor}44`, borderRadius: 8, cursor: "pointer" }} onClick={() => { setActiveCat("all"); setSearch(a.symbol || ""); setTab("signals"); }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {a.image && <img src={a.image} alt="" style={{ width: 22, height: 22, borderRadius: "50%" }} />}
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 900 }}>{a.symbol?.toUpperCase()}</div>
                            <div style={{ fontSize: 9, color: S.text4 }}>{a.alertTime}</div>
                          </div>
                          <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: `${a.vColor}1a`, border: `1px solid ${a.vColor}55`, color: a.vColor }}>{a.verdict}</span>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>{fu(a.current_price)}</div>
                          <div style={{ fontSize: 11, color: pc(a.price_change_percentage_24h) }}>{fp(a.price_change_percentage_24h)}</div>
                        </div>
                      </div>
                      {a.sr && <div style={{ fontSize: 10, color: S.text3 }}>S1: <span style={{ color: S.green }}>{fu(a.sr.support1)}</span> · R1: <span style={{ color: S.red }}>{fu(a.sr.resistance1)}</span></div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Watchlist */}
            {watchCoins.length > 0 && (
              <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: "16px 18px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ fontSize: 10, color: S.purple, letterSpacing: 2 }}>⭐ WATCHLIST ({watchCoins.length})</div>
                  <button onClick={() => runAI(watchCoins, "Review my watchlist — full read on each coin.")} style={{ padding: "5px 12px", background: `${S.purple}11`, border: `1px solid ${S.purple}44`, borderRadius: 6, color: S.purple, cursor: "pointer", fontSize: 10, fontFamily: "inherit" }}>⚡ AI Review</button>
                </div>
                {watchCoins.map((c) => <CoinCard key={c.id} c={c} />)}
              </div>
            )}
          </div>
        )}

        {/* ── SIGNALS ── */}
        {tab === "signals" && (
          <div>
            <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search ${coins.length} live coins...`}
                style={{ padding: "9px 14px", background: S.card, border: `1px solid ${S.border}`, borderRadius: 8, color: S.text, fontSize: 13, fontFamily: "inherit", outline: "none", minWidth: 220 }} />
              <button onClick={() => runAI(topBuys.slice(0, 10), "Best buy opportunities right now — plain English for a beginner.")} style={{ padding: "9px 16px", background: `${S.green}11`, border: `1px solid ${S.green}`, borderRadius: 8, color: S.green, cursor: "pointer", fontSize: 12, fontFamily: "inherit", fontWeight: 700 }}>⚡ AI Best Buys</button>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
              {CAT_INFO.map((cat) => (
                <button key={cat.id} onClick={() => setActiveCat(cat.id)} style={{ padding: "5px 12px", background: activeCat === cat.id ? `${cat.color}15` : "transparent", border: `1px solid ${activeCat === cat.id ? cat.color : S.border}`, borderRadius: 6, color: activeCat === cat.id ? cat.color : S.text3, cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>
                  {cat.label} ({cat.id === "all" ? enriched.length : enriched.filter((c) => c.cat === cat.id).length})
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14, alignItems: "center" }}>
              {["STRONG BUY", "BUY", "WATCH", "TAKE PROFIT", "CAUTION"].map((v) => {
                const cnt = browsed.filter((c) => c.verdict === v).length;
                const col = v === "STRONG BUY" ? S.green : v === "BUY" ? "#4ade80" : v === "TAKE PROFIT" ? S.red : v === "CAUTION" ? S.orange : S.gold;
                return cnt > 0 ? <span key={v} style={{ fontSize: 11, padding: "3px 10px", background: `${col}11`, border: `1px solid ${col}33`, borderRadius: 10, color: col }}>{v} ({cnt})</span> : null;
              })}
              <span style={{ fontSize: 11, color: S.text4 }}>{browsed.length} coins</span>
            </div>
            {browsed.map((c) => <CoinCard key={c.id} c={c} />)}
          </div>
        )}

        {/* ── JOURNAL ── */}
        {tab === "journal" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Trade Journal</div>
                <div style={{ fontSize: 12, color: S.text3 }}>{openTrades.length} open · {closedTrades.length} closed · {settings.paper ? "📄 PAPER" : "💵 LIVE"}</div>
              </div>
              <button onClick={() => setShowTradeForm(true)} style={{ padding: "9px 18px", background: `${S.green}11`, border: `1px solid ${S.green}`, borderRadius: 8, color: S.green, cursor: "pointer", fontSize: 12, fontFamily: "inherit", fontWeight: 700 }}>+ LOG NEW TRADE</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
              {[["Today P&L", fu(dailyPnL), pc(dailyPnL)], ["Win Rate", winRate + "%", S.blue], ["Trades", trades.length, S.text2], ["Open/Max", `${openTrades.length}/${settings.maxPos}`, S.gold]].map(([l, v, c]) => (
                <div key={l} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: "12px 14px" }}>
                  <div style={{ fontSize: 10, color: S.text3, letterSpacing: 2, marginBottom: 5 }}>{l.toUpperCase()}</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: c }}>{v}</div>
                </div>
              ))}
            </div>
            {openTrades.map((t) => {
              const coin = enriched.find((c) => c.id === t.coinId);
              const cur = coin?.current_price || t.entry;
              const unrealized = (cur - t.entry) * (t.size / t.entry);
              const pctE = ((cur - t.entry) / t.entry) * 100;
              let rec = "HOLD", rc = S.gold;
              if (cur >= t.tp * 0.97) { rec = "TAKE PROFIT NOW"; rc = S.green; }
              else if (cur <= t.sl * 1.03) { rec = "CUT LOSS NOW"; rc = S.red; }
              else if (coin && (coin.verdict === "TAKE PROFIT" || coin.verdict === "CAUTION")) { rec = "CONSIDER EXIT"; rc = S.orange; }
              return (
                <div key={t.id} style={{ background: S.card, border: `1px solid ${rc}33`, borderRadius: 10, padding: 16, marginBottom: 10 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 10 }}>
                    <div><div style={{ fontSize: 10, color: S.text4 }}>COIN</div><div style={{ fontSize: 18, fontWeight: 900 }}>{t.symbol}</div><div style={{ fontSize: 11, color: S.text3 }}>{t.type.toUpperCase()}</div></div>
                    <div><div style={{ fontSize: 10, color: S.text4 }}>ENTRY → NOW</div><div style={{ fontSize: 12, fontWeight: 600 }}>{fu(t.entry)} → {fu(cur)}</div><div style={{ fontSize: 12, color: pc(pctE) }}>{fp(pctE)}</div></div>
                    <div><div style={{ fontSize: 10, color: S.text4 }}>UNREALIZED</div><div style={{ fontSize: 14, fontWeight: 700, color: pc(unrealized) }}>{unrealized >= 0 ? "+" : ""}{fu(unrealized)}</div></div>
                    <div><div style={{ fontSize: 10, color: S.text4 }}>RECOMMENDATION</div><div style={{ fontSize: 13, fontWeight: 700, color: rc }}>{rec}</div></div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
                    {[["Take Profit", fu(t.tp), S.green], ["Stop Loss", fu(t.sl), S.red], ["R:R", t.rr + ":1", S.gold]].map(([k, v, c]) => (
                      <div key={k} style={{ background: S.surface, padding: "8px 10px", borderRadius: 6 }}>
                        <div style={{ fontSize: 9, color: S.text4, marginBottom: 3 }}>{k}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: c }}>{v}</div>
                      </div>
                    ))}
                  </div>
                  {t.notes && <div style={{ fontSize: 11, color: S.text3, marginBottom: 10, fontStyle: "italic" }}>"{t.notes}"</div>}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => closeTrade(t.id)} style={{ padding: "7px 14px", background: `${S.red}11`, border: `1px solid ${S.red}`, borderRadius: 6, color: S.red, cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>Close Trade</button>
                    <button onClick={() => runAI([coin || { name: t.symbol, symbol: t.symbol, current_price: cur, price_change_percentage_24h: 0, price_change_percentage_7d_in_currency: 0, total_volume: 0, market_cap: 0, ath_change_percentage: 0 }], `I hold ${t.symbol} entered at ${fu(t.entry)}, now ${fu(cur)}. Should I hold, take profit, or cut losses?`)}
                      style={{ padding: "7px 14px", background: `${S.gold}11`, border: `1px solid ${S.gold}44`, borderRadius: 6, color: S.gold, cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>⚡ AI Advice</button>
                  </div>
                </div>
              );
            })}
            {closedTrades.length > 0 && (
              <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 16 }}>
                <div style={{ fontSize: 10, color: S.text3, letterSpacing: 2, marginBottom: 12 }}>TRADE HISTORY</div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead><tr style={{ borderBottom: `1px solid ${S.border}` }}>
                      {["Coin", "Type", "Entry", "Exit", "P&L", "Result", "Signal at Entry"].map((h) => <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: 10, color: S.text3, fontWeight: 400, letterSpacing: 1 }}>{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {closedTrades.map((t) => (
                        <tr key={t.id} style={{ borderBottom: `1px solid ${S.surface}` }}>
                          <td style={{ padding: "10px 12px", fontWeight: 700 }}>{t.symbol}</td>
                          <td style={{ padding: "10px 12px", color: S.text3 }}>{t.type}</td>
                          <td style={{ padding: "10px 12px" }}>{fu(t.entry)}</td>
                          <td style={{ padding: "10px 12px" }}>{fu(t.exitPrice)}</td>
                          <td style={{ padding: "10px 12px", fontWeight: 700, color: pc(t.pnl) }}>{t.pnl >= 0 ? "+" : ""}{fu(t.pnl)}</td>
                          <td style={{ padding: "10px 12px" }}><span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: `${t.pnl > 0 ? S.green : S.red}1a`, border: `1px solid ${t.pnl > 0 ? S.green : S.red}55`, color: t.pnl > 0 ? S.green : S.red }}>{t.pnl > 0 ? "WIN" : "LOSS"}</span></td>
                          <td style={{ padding: "10px 12px", color: S.text3, fontSize: 11 }}>{t.signalAtEntry}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {trades.length === 0 && (
              <div style={{ textAlign: "center", padding: 48, background: S.card, borderRadius: 10, border: `1px solid ${S.border}` }}>
                <div style={{ fontSize: 36, marginBottom: 14 }}>📓</div>
                <div style={{ fontSize: 15, color: S.text2, marginBottom: 8 }}>No trades logged yet</div>
                <div style={{ fontSize: 12, color: S.text3, maxWidth: 400, margin: "0 auto" }}>Click + LOG NEW TRADE when you enter a position. The journal tracks your P&L, gives live hold/exit recommendations, and builds your personal edge over time.</div>
              </div>
            )}
          </div>
        )}

        {/* ── NEWS ── */}
        {tab === "news" && (
          <div>
            <div style={{ marginBottom: 14, padding: "10px 14px", background: `${S.blue}08`, border: `1px solid ${S.blue}22`, borderRadius: 8, fontSize: 12, color: S.text2, lineHeight: 1.6 }}>
              News and events move crypto prices fast. Tap any story for plain-English explanation and AI trade advice.
            </div>
            {[{ l: "📈 BULLISH CATALYSTS", items: NEWS.filter((n) => n.imp === "BULLISH"), c: S.green },
              { l: "📉 BEARISH RISKS", items: NEWS.filter((n) => n.imp === "BEARISH"), c: S.red },
              { l: "➡️ MARKET INFO", items: NEWS.filter((n) => n.imp === "NEUTRAL"), c: S.text3 }
            ].map((sec) => (
              <div key={sec.l} style={{ marginBottom: 22 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: sec.c, letterSpacing: 2, marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${sec.c}22` }}>{sec.l} ({sec.items.length})</div>
                {sec.items.map((item) => (
                  <div key={item.id} onClick={() => setSelNews(selNews?.id === item.id ? null : item)}
                    style={{ padding: "14px 16px", background: selNews?.id === item.id ? `${sec.c}08` : S.card, border: `1px solid ${selNews?.id === item.id ? sec.c + "55" : S.border}`, borderRadius: 10, cursor: "pointer", marginBottom: 8, transition: "all 0.15s" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
                      <div style={{ fontSize: 13, color: S.text, lineHeight: 1.5, flex: 1 }}>{item.h}</div>
                      <div style={{ flexShrink: 0, textAlign: "right" }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: `${sec.c}1a`, border: `1px solid ${sec.c}55`, color: sec.c }}>{"●".repeat(item.str)} {item.imp}</span>
                        <div style={{ fontSize: 10, color: S.text4, marginTop: 4 }}>{item.time} ago</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: selNews?.id === item.id ? 10 : 0 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 20, background: `${S.blue}11`, border: `1px solid ${S.blue}33`, color: S.blue }}>{item.cat}</span>
                      {item.coins.map((s) => <span key={s} style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 20, background: `${sec.c}11`, border: `1px solid ${sec.c}33`, color: sec.c }}>{s}</span>)}
                    </div>
                    {selNews?.id === item.id && (
                      <div style={{ paddingTop: 12, borderTop: `1px solid ${sec.c}22` }}>
                        <div style={{ fontSize: 12, color: S.text2, lineHeight: 1.7, marginBottom: 12 }}>{item.ex}</div>
                        <button onClick={(e) => { e.stopPropagation(); const coinList = enriched.filter((c) => item.coins.includes(c.symbol?.toUpperCase())); runAI(coinList.length ? coinList : enriched.slice(0, 5), `News: "${item.h}" — how should a beginner respond to this?`); }}
                          style={{ padding: "7px 14px", background: `${sec.c}11`, border: `1px solid ${sec.c}`, borderRadius: 6, color: sec.c, cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>
                          ⚡ AI — How do I trade this?
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* ── PERFORMANCE TAB ── */}
        {tab === "performance" && (
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>📈 Performance & Lessons Learned</div>
            <div style={{ fontSize: 12, color: S.text3, marginBottom: 18, lineHeight: 1.6 }}>This tab tracks every signal the tool generates and compares against outcomes. Over time it shows you what's working, what's not, and how to improve. Data accumulates as you use the app — the more you use it, the smarter this gets.</div>

            {/* Signal stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
              {[["Signals Today", perfStats.totalSignals, S.blue], ["Buy Signals", perfStats.buySignals, S.green], ["Sell Signals", perfStats.sellSignals, S.red], ["Avg Strength", perfStats.avgScore, S.gold]].map(([l, v, c]) => (
                <div key={l} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: "14px 16px" }}>
                  <div style={{ fontSize: 10, color: S.text3, letterSpacing: 2, marginBottom: 6 }}>{l.toUpperCase()}</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: c }}>{v}</div>
                </div>
              ))}
            </div>

            {/* Trade performance */}
            <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 16, marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: S.blue, letterSpacing: 2, marginBottom: 14 }}>YOUR TRADING PERFORMANCE</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
                {[["Win Rate", winRate + "%", winRate >= 50 ? S.green : S.red],
                  ["Total P&L", fu(closedTrades.reduce((a, t) => a + (t.pnl || 0), 0)), pc(closedTrades.reduce((a, t) => a + (t.pnl || 0), 0))],
                  ["Avg Trade", closedTrades.length ? fu(closedTrades.reduce((a, t) => a + (t.pnl || 0), 0) / closedTrades.length) : "—", S.text2],
                ].map(([l, v, c]) => (
                  <div key={l} style={{ background: S.surface, padding: "12px 14px", borderRadius: 8 }}>
                    <div style={{ fontSize: 10, color: S.text3, marginBottom: 5 }}>{l}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: c }}>{v}</div>
                  </div>
                ))}
              </div>
              {/* Signal accuracy by type */}
              {closedTrades.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, color: S.text3, letterSpacing: 1, marginBottom: 10 }}>SIGNAL ACCURACY — Did the signal predict the outcome?</div>
                  {["STRONG BUY", "BUY", "TAKE PROFIT", "MANUAL"].map((sig) => {
                    const relevant = closedTrades.filter((t) => t.signalAtEntry === sig);
                    if (!relevant.length) return null;
                    const wins = relevant.filter((t) => t.pnl > 0).length;
                    const wr = Math.round((wins / relevant.length) * 100);
                    return (
                      <div key={sig} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                        <div style={{ width: 100, fontSize: 11, color: S.text2 }}>{sig}</div>
                        <div style={{ flex: 1, height: 8, background: S.border, borderRadius: 4, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${wr}%`, background: wr >= 60 ? S.green : wr >= 40 ? S.gold : S.red, borderRadius: 4 }} />
                        </div>
                        <div style={{ width: 80, fontSize: 11, color: wr >= 60 ? S.green : wr >= 40 ? S.gold : S.red, textAlign: "right" }}>{wr}% ({relevant.length} trades)</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Lessons learned */}
            <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 16, marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: S.gold, letterSpacing: 2, marginBottom: 14 }}>💡 LESSONS LEARNED — AUTO-GENERATED</div>
              {closedTrades.length < 3 ? (
                <div style={{ fontSize: 12, color: S.text3, lineHeight: 1.7 }}>Complete at least 3 trades to start generating personalized lessons. The more you trade (even paper trades), the more specific and useful these insights become.</div>
              ) : (
                <div>
                  {winRate >= 60 && <div style={{ padding: "10px 14px", background: `${S.green}08`, border: `1px solid ${S.green}33`, borderRadius: 8, marginBottom: 8, fontSize: 12, color: S.text2, lineHeight: 1.6 }}><span style={{ color: S.green, fontWeight: 700 }}>✅ What's working:</span> Your {winRate}% win rate is above average. Your signal-following discipline appears to be paying off. Keep following the checklist before every trade.</div>}
                  {winRate < 50 && <div style={{ padding: "10px 14px", background: `${S.red}08`, border: `1px solid ${S.red}33`, borderRadius: 8, marginBottom: 8, fontSize: 12, color: S.text2, lineHeight: 1.6 }}><span style={{ color: S.red, fontWeight: 700 }}>⚠️ Area to improve:</span> Win rate below 50%. Consider only trading STRONG BUY signals (score 75+) until you build consistency. Review whether you're entering at support levels.</div>}
                  {openTrades.length > settings.maxPos && <div style={{ padding: "10px 14px", background: `${S.orange}08`, border: `1px solid ${S.orange}33`, borderRadius: 8, marginBottom: 8, fontSize: 12, color: S.text2, lineHeight: 1.6 }}><span style={{ color: S.orange, fontWeight: 700 }}>⚠️ Position sizing:</span> You currently have more open trades than your max setting. Too many positions splits your focus. Close some before opening new ones.</div>}
                  <div style={{ padding: "10px 14px", background: `${S.blue}08`, border: `1px solid ${S.blue}33`, borderRadius: 8, marginBottom: 8, fontSize: 12, color: S.text2, lineHeight: 1.6 }}><span style={{ color: S.blue, fontWeight: 700 }}>📊 Support/Resistance tip:</span> Before every trade, check that price is near a support level (green line), not a resistance level (red line). Buying near support gives you a much better risk/reward ratio.</div>
                  <div style={{ padding: "10px 14px", background: `${S.purple}08`, border: `1px solid ${S.purple}33`, borderRadius: 8, fontSize: 12, color: S.text2, lineHeight: 1.6 }}><span style={{ color: S.purple, fontWeight: 700 }}>🧠 Mindset reminder:</span> Losses are part of trading. A 60% win rate with good risk management beats a 90% win rate with bad risk management. Protect your capital first, grow it second.</div>
                </div>
              )}
            </div>

            {/* Recent signal log */}
            {signalLog.length > 0 && (
              <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: 16 }}>
                <div style={{ fontSize: 11, color: S.text3, letterSpacing: 2, marginBottom: 12 }}>RECENT SIGNAL LOG ({signalLog.length} signals captured)</div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead><tr style={{ borderBottom: `1px solid ${S.border}` }}>
                      {["Time", "Coin", "Signal", "Price at Signal", "24h at Signal"].map((h) => <th key={h} style={{ padding: "6px 10px", textAlign: "left", fontSize: 10, color: S.text3, fontWeight: 400 }}>{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {signalLog.slice(0, 20).map((s, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${S.surface}` }}>
                          <td style={{ padding: "8px 10px", color: S.text3, fontSize: 11 }}>{s.time}</td>
                          <td style={{ padding: "8px 10px", fontWeight: 700 }}>{s.symbol}</td>
                          <td style={{ padding: "8px 10px" }}>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: `${s.verdict === "STRONG BUY" || s.verdict === "BUY" ? S.green : S.red}1a`, border: `1px solid ${s.verdict === "STRONG BUY" || s.verdict === "BUY" ? S.green : S.red}33`, color: s.verdict === "STRONG BUY" || s.verdict === "BUY" ? S.green : S.red }}>{s.verdict}</span>
                          </td>
                          <td style={{ padding: "8px 10px" }}>{fu(s.price)}</td>
                          <td style={{ padding: "8px 10px", color: pc(s.p24) }}>{fp(s.p24)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ marginTop: 12, padding: "10px 14px", background: `${S.blue}08`, border: `1px solid ${S.blue}22`, borderRadius: 8, fontSize: 11, color: S.text3, lineHeight: 1.6 }}>
                  <span style={{ color: S.blue2, fontWeight: 700 }}>How to use this:</span> When a signal fires, note the price. Check back 24-48 hours later — did price go up (BUY signal accurate) or down (TAKE PROFIT signal accurate)? Over time you'll see which signal types are most reliable for your style.
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── AI ── */}
        {tab === "ai" && (
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: S.gold, marginBottom: 6 }}>⚡ BLKROSE AI Intelligence</div>
            <div style={{ fontSize: 12, color: S.text3, marginBottom: 18 }}>Powered by Claude · Uses live CoinGecko prices + Support/Resistance levels · Tailored to your ${settings.acct} account</div>
            {!aiLoading && !aiResult && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10, marginBottom: 16 }}>
                {[
                  { l: "🚀 Best Opportunities Right Now", lst: topBuys.slice(0, 10), ctx: "Best buy opportunities right now — include support levels as entry points. Plain English for a beginner." },
                  { l: "📉 Take Profit Analysis", lst: topSells.slice(0, 8), ctx: "These coins show take profit signals — which should I sell and at what resistance level?" },
                  { l: "💎 Large Cap Deep Dive", lst: enriched.filter((c) => c.cat === "largecap"), ctx: "Analyze large caps — which is best for a beginner? Include S/R levels for entry." },
                  { l: "🤖 AI & DePIN Sector", lst: enriched.filter((c) => c.cat === "ai"), ctx: "AI crypto sector — which look best right now with support levels?" },
                  { l: "🐸 Meme Coin Risk Read", lst: enriched.filter((c) => c.cat === "meme"), ctx: "Honest meme coin analysis — risks, opportunities, which have good S/R setups?" },
                  { l: "📰 Today's News Impact", lst: enriched.filter((c) => NEWS.some((n) => n.coins.includes(c.symbol?.toUpperCase()))), ctx: "Based on today's news, what should I do? Which coins are most affected?" },
                  { l: "⭐ My Watchlist Review", lst: watchCoins.length ? watchCoins : topBuys.slice(0, 5), ctx: "Review my watchlist — full read on each coin with support/resistance levels." },
                  { l: "🌍 Big Picture — Where Is Crypto Going?", lst: enriched.filter((c) => c.cat === "largecap"), ctx: "Big picture analysis — where is crypto headed? What should a beginner do right now?" },
                  { l: "💰 Best Strategy For My Account", lst: topBuys.slice(0, 8), ctx: `I have $${settings.acct} with ${settings.risk}% risk per trade. What is the best strategy right now using support levels as entries?` },
                  { l: "🛡️ Risk Assessment", lst: enriched.slice(0, 15), ctx: "What are the biggest risks right now? Where are dangerous resistance levels to watch?" },
                ].map((a) => (
                  <button key={a.l} onClick={() => runAI(a.lst.length ? a.lst : enriched.slice(0, 8), a.ctx)}
                    style={{ padding: "14px 16px", background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, color: S.text2, cursor: "pointer", fontSize: 13, fontFamily: "inherit", textAlign: "left", transition: "all 0.15s" }}>
                    {a.l}
                    <span style={{ fontSize: 10, color: S.text4, display: "block", marginTop: 4 }}>{a.lst.length} live coins · with S/R levels · plain English</span>
                  </button>
                ))}
              </div>
            )}
            {aiLoading && (
              <div style={{ padding: 60, textAlign: "center" }}>
                <div style={{ fontSize: 32, color: S.gold, marginBottom: 14 }}>⚡</div>
                <div style={{ fontSize: 13, color: S.gold, letterSpacing: 2 }}>ANALYZING LIVE DATA...</div>
                <div style={{ fontSize: 11, color: S.text3, marginTop: 6 }}>Using real-time prices and support/resistance levels</div>
              </div>
            )}
            {aiResult && !aiLoading && (
              <div>
                <div style={{ background: S.card, border: `1px solid ${S.gold}33`, borderRadius: 10, padding: 20, marginBottom: 14 }}>
                  <div style={{ fontSize: 10, color: S.gold, letterSpacing: 2, marginBottom: 6 }}>⚡ BLKROSE AI INTELLIGENCE</div>
                  <div style={{ fontSize: 11, color: S.text4, marginBottom: 14, paddingBottom: 10, borderBottom: `1px solid ${S.border}` }}>{aiCtx}</div>
                  <div style={{ fontSize: 13, color: S.text2, lineHeight: 2, whiteSpace: "pre-wrap" }}>{aiResult}</div>
                </div>
                <button onClick={() => setAiResult("")} style={{ padding: "9px 20px", background: "transparent", border: `1px solid ${S.border}`, borderRadius: 8, color: S.text3, cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>← Back to Options</button>
              </div>
            )}
          </div>
        )}

        {/* ── SETTINGS ── */}
        {tab === "settings" && (
          <div style={{ maxWidth: 700 }}>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>⚙️ Settings & Risk Controls</div>
            <div style={{ fontSize: 12, color: S.text3, marginBottom: 20 }}>Configure your risk rules before your first trade. These protect your capital.</div>
            {[{ title: "💰 Account & Risk", color: S.gold, fields: [
                ["Account Size (USD)", "acct", 50, 10000, 50, `Max risk per trade: $${(settings.acct * settings.risk / 100).toFixed(2)}`, false],
                ["Risk Per Trade (%)", "risk", 0.5, 5, 0.5, `${settings.risk}% of $${settings.acct} = $${(settings.acct * settings.risk / 100).toFixed(2)} per trade. Keep at 1-2%.`, true],
                ["Max Open Positions", "maxPos", 1, 10, 1, "Never exceed this many open trades. Beginners: 3-4.", false],
              ]},
              { title: "🛡️ Hard Risk Controls", color: S.red, fields: [
                ["Daily Loss Limit (%)", "dllimit", 1, 10, 0.5, `Stop trading if loss hits $${(settings.acct * settings.dllimit / 100).toFixed(2)}.`, true],
                ["Min Signal Score", "minScore", 40, 90, 5, "Only act on signals above this score. Beginners: start at 65+.", false],
              ]},
            ].map((section) => (
              <div key={section.title} style={{ background: S.card, border: `1px solid ${section.color}33`, borderRadius: 10, padding: 18, marginBottom: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: section.color, marginBottom: 16 }}>{section.title}</div>
                {section.fields.map(([l, k, mn, mx, st, desc, pct]) => (
                  <div key={k} style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <label style={{ fontSize: 13, color: S.text2 }}>{l}</label>
                      <span style={{ fontSize: 14, fontWeight: 700, color: section.color }}>{settings[k]}{pct ? "%" : ""}</span>
                    </div>
                    <input type="range" min={mn} max={mx} step={st} value={settings[k]} onChange={(e) => setSettings((p) => ({ ...p, [k]: st < 1 ? parseFloat(e.target.value) : parseInt(e.target.value) }))} style={{ width: "100%", accentColor: section.color }} />
                    <div style={{ fontSize: 11, color: S.text4, marginTop: 4 }}>{desc}</div>
                  </div>
                ))}
              </div>
            ))}
            <div style={{ background: S.card, border: `1px solid ${S.purple}33`, borderRadius: 10, padding: 18 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: S.purple, marginBottom: 16 }}>📄 Trading Mode</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[{ v: true, l: "📄 PAPER TRADING", d: "Fake money, real signals. Learn without risk. Recommended for first 30+ days.", c: S.purple },
                  { v: false, l: "💵 LIVE TRADING", d: "Real money. Only switch after 30+ paper trades with positive results.", c: S.red }
                ].map((o) => (
                  <div key={String(o.v)} onClick={() => setSettings((p) => ({ ...p, paper: o.v }))} style={{ padding: 14, background: settings.paper === o.v ? `${o.c}11` : S.surface, border: `2px solid ${settings.paper === o.v ? o.c : S.border}`, borderRadius: 8, cursor: "pointer" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: settings.paper === o.v ? o.c : S.text2, marginBottom: 5 }}>{o.l}</div>
                    <div style={{ fontSize: 11, color: S.text3, lineHeight: 1.5 }}>{o.d}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── MODALS ── */}

      {/* Pre-trade checklist */}
      {showChecklist && checklistTarget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: S.surface, border: `1px solid ${S.gold}44`, borderRadius: 14, padding: 24, width: "100%", maxWidth: 480 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: S.gold, marginBottom: 6 }}>✅ Pre-Trade Checklist — {checklistTarget.symbol?.toUpperCase()}</div>
            <div style={{ fontSize: 12, color: S.text3, marginBottom: 16, lineHeight: 1.6 }}>Check every box. If any is unchecked, reconsider the trade. This discipline is what separates consistent traders from gamblers.</div>
            {CHECKLIST.map((item, i) => (
              <div key={i} onClick={() => setChecklist((p) => ({ ...p, [i]: !p[i] }))}
                style={{ display: "flex", gap: 12, padding: "10px 12px", background: checklist[i] ? `${S.green}08` : S.card, border: `1px solid ${checklist[i] ? S.green + "44" : S.border}`, borderRadius: 8, marginBottom: 8, cursor: "pointer", alignItems: "flex-start" }}>
                <div style={{ width: 20, height: 20, border: `2px solid ${checklist[i] ? S.green : S.border}`, borderRadius: 4, background: checklist[i] ? S.green : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                  {checklist[i] && <span style={{ color: "#000", fontSize: 12, fontWeight: 900 }}>✓</span>}
                </div>
                <span style={{ fontSize: 12, color: checklist[i] ? S.text : S.text2, lineHeight: 1.5 }}>{item}</span>
              </div>
            ))}
            {Object.values(checklist).filter(Boolean).length === CHECKLIST.length && (
              <div style={{ padding: 12, background: `${S.green}11`, border: `1px solid ${S.green}`, borderRadius: 8, textAlign: "center", fontSize: 13, color: S.green, fontWeight: 700, marginTop: 8, marginBottom: 12 }}>✅ ALL CHECKS PASSED — Cleared to trade!</div>
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button onClick={() => { setShowTradeForm(true); setTradeForm((p) => ({ ...p, coin: checklistTarget.symbol?.toUpperCase() || "", entry: checklistTarget.current_price?.toString() || "" })); setShowChecklist(false); }}
                style={{ flex: 1, padding: 10, background: `${S.green}11`, border: `1px solid ${S.green}`, borderRadius: 8, color: S.green, cursor: "pointer", fontSize: 12, fontFamily: "inherit", fontWeight: 700 }}>→ Log This Trade</button>
              <button onClick={() => setShowChecklist(false)} style={{ padding: "10px 16px", background: "transparent", border: `1px solid ${S.border}`, borderRadius: 8, color: S.text3, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Trade log form */}
      {showTradeForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: S.surface, border: `1px solid ${S.green}44`, borderRadius: 14, padding: 24, width: "100%", maxWidth: 480 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: S.green, marginBottom: 18 }}>📓 Log New Trade</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              {[["Coin Ticker", "coin", "BTC, ETH, SOL..."], ["Entry Price ($)", "entry", "e.g. 94820"]].map(([l, k, ph]) => (
                <div key={k}>
                  <div style={{ fontSize: 10, color: S.text3, letterSpacing: 1, marginBottom: 5 }}>{l.toUpperCase()}</div>
                  <input value={tradeForm[k]} onChange={(e) => setTradeForm((p) => ({ ...p, [k]: e.target.value }))} placeholder={ph}
                    style={{ width: "100%", padding: "9px 12px", background: S.card, border: `1px solid ${S.border}`, borderRadius: 6, color: S.text, fontSize: 13, fontFamily: "inherit", outline: "none" }} />
                </div>
              ))}
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: S.text3, letterSpacing: 1, marginBottom: 5 }}>POSITION SIZE ($) — MAX ${(settings.acct * settings.risk / 100).toFixed(0)}</div>
              <input value={tradeForm.size} onChange={(e) => setTradeForm((p) => ({ ...p, size: e.target.value }))} placeholder="Amount to invest"
                style={{ width: "100%", padding: "9px 12px", background: S.card, border: `1px solid ${S.border}`, borderRadius: 6, color: S.text, fontSize: 13, fontFamily: "inherit", outline: "none" }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: S.text3, letterSpacing: 1, marginBottom: 8 }}>TRADE TYPE</div>
              <div style={{ display: "flex", gap: 8 }}>
                {["scalp", "swing", "position"].map((t) => (
                  <button key={t} onClick={() => setTradeForm((p) => ({ ...p, type: t }))}
                    style={{ flex: 1, padding: "9px", background: tradeForm.type === t ? `${S.blue}22` : "transparent", border: `1px solid ${tradeForm.type === t ? S.blue : S.border}`, borderRadius: 6, color: tradeForm.type === t ? S.blue : S.text3, cursor: "pointer", fontSize: 12, fontFamily: "inherit", fontWeight: tradeForm.type === t ? 700 : 400 }}>
                    {t.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 10, color: S.text3, letterSpacing: 1, marginBottom: 5 }}>NOTES (why are you taking this trade?)</div>
              <textarea value={tradeForm.notes} onChange={(e) => setTradeForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Which signal fired? What support level are you entering near?"
                style={{ width: "100%", padding: "9px 12px", background: S.card, border: `1px solid ${S.border}`, borderRadius: 6, color: S.text, fontSize: 12, fontFamily: "inherit", outline: "none", resize: "vertical", minHeight: 70 }} />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={logTrade} style={{ flex: 1, padding: 10, background: `${S.green}11`, border: `1px solid ${S.green}`, borderRadius: 8, color: S.green, cursor: "pointer", fontSize: 13, fontFamily: "inherit", fontWeight: 700 }}>✓ LOG TRADE</button>
              <button onClick={() => setShowTradeForm(false)} style={{ padding: "10px 18px", background: "transparent", border: `1px solid ${S.border}`, borderRadius: 8, color: S.text3, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Emotional check-in */}
      {showCheckin && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: S.surface, border: `1px solid ${S.gold}44`, borderRadius: 14, padding: 24, width: "100%", maxWidth: 440 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: S.gold, marginBottom: 6 }}>🧠 Pre-Session Check-In</div>
            <div style={{ fontSize: 12, color: S.text3, marginBottom: 18, lineHeight: 1.6 }}>Professional traders check their mental state before every session. Emotional trading is the #1 account killer.</div>
            {[{ id: "sleep", q: "How did you sleep last night?", opts: ["Great (8+ hrs)", "OK (6-7 hrs)", "Poorly (<6 hrs)"], scores: [2, 1, 0] },
              { id: "stress", q: "How stressed are you right now?", opts: ["Not stressed", "A little", "Very stressed"], scores: [2, 1, 0] },
              { id: "loss", q: "Did you take a loss yesterday?", opts: ["No / First day", "Small loss", "Big loss"], scores: [2, 1, 0] },
            ].map((q) => (
              <div key={q.id} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, color: S.text, marginBottom: 10 }}>{q.q}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  {q.opts.map((opt, i) => (
                    <button key={i} onClick={() => setCheckinAns((p) => ({ ...p, [q.id]: i }))}
                      style={{ flex: 1, padding: "9px 6px", background: checkinAns[q.id] === i ? `${S.gold}22` : "transparent", border: `1px solid ${checkinAns[q.id] === i ? S.gold : S.border}`, borderRadius: 6, color: checkinAns[q.id] === i ? S.gold : S.text3, cursor: "pointer", fontSize: 11, fontFamily: "inherit", lineHeight: 1.4 }}>
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <button onClick={() => {
              const qs = [{ id: "sleep", scores: [2, 1, 0] }, { id: "stress", scores: [2, 1, 0] }, { id: "loss", scores: [2, 1, 0] }];
              let tot = 0;
              qs.forEach((q) => { const v = checkinAns[q.id]; if (v !== undefined) tot += q.scores[v]; });
              setCheckinScore(Math.round((tot / 6) * 100));
              setCheckinDone(true);
              setShowCheckin(false);
            }} disabled={Object.keys(checkinAns).length < 3}
              style={{ width: "100%", padding: 10, background: Object.keys(checkinAns).length >= 3 ? `${S.gold}22` : `${S.border}22`, border: `1px solid ${Object.keys(checkinAns).length >= 3 ? S.gold : S.border}`, borderRadius: 8, color: Object.keys(checkinAns).length >= 3 ? S.gold : S.text4, cursor: "pointer", fontSize: 13, fontFamily: "inherit", fontWeight: 700 }}>
              SEE MY TRADING READINESS →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
