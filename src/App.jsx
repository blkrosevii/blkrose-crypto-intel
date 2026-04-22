import { useState, useEffect, useCallback, useRef } from "react";

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
const pc = (n) => (!n ? "#6b7280" : n > 0 ? "#22c55e" : "#ef4444");
const nowT = () => new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const GC = "https://api.coingecko.com/api/v3";

const T = {
  bg:      "#080810",
  surface: "#0e0e1a",
  card:    "#13131f",
  border:  "#1e1e30",
  border2: "#2a2a40",
  purple:  "#a855f7",
  purple2: "#c084fc",
  purple3: "#7c3aed",
  purpleDim:"#a855f715",
  green:   "#22c55e",
  red:     "#ef4444",
  gold:    "#f59e0b",
  blue:    "#3b82f6",
  text:    "#f8fafc",
  text2:   "#cbd5e1",
  text3:   "#64748b",
  text4:   "#374151",
};

function getSR(price) {
  if (!price) return null;
  return {
    r2: parseFloat((price * 1.15).toFixed(price < 1 ? 5 : 2)),
    r1: parseFloat((price * 1.07).toFixed(price < 1 ? 5 : 2)),
    s1: parseFloat((price * 0.94).toFixed(price < 1 ? 5 : 2)),
    s2: parseFloat((price * 0.86).toFixed(price < 1 ? 5 : 2)),
  };
}

function getSignals(c) {
  if (!c || c.cat === "stable") return { verdict: "STABLE", vColor: T.text3, vBg: T.purpleDim, signals: [], score: 0, sr: null };
  const p24 = c.price_change_percentage_24h ?? 0;
  const p7  = c.price_change_percentage_7d_in_currency ?? 0;
  const p1  = c.price_change_percentage_1h_in_currency ?? 0;
  const athD= c.ath_change_percentage ?? 0;
  const vm  = c.total_volume && c.market_cap ? (c.total_volume / c.market_cap) * 100 : 0;
  const sigs = [];
  if (vm > 50)        sigs.push({ label: "🐋 Vol Spike",     dir: "BUY",  w: 3, why: `Vol/MCap ${vm.toFixed(0)}% — extreme unusual activity` });
  else if (vm > 20)   sigs.push({ label: "⚡ Vol Elevated",   dir: "BUY",  w: 2, why: `Vol/MCap ${vm.toFixed(0)}% — above normal` });
  if (p24 > 20)       sigs.push({ label: "🚀 Breakout",       dir: "BUY",  w: 3, why: `+${p24.toFixed(1)}% today — strong breakout` });
  else if (p24 > 8)   sigs.push({ label: "📈 Momentum",       dir: "BUY",  w: 2, why: `+${p24.toFixed(1)}% today — solid momentum` });
  if (p7 > 40)        sigs.push({ label: "🔥 7D Runner",      dir: "BUY",  w: 2, why: `+${p7.toFixed(1)}% in 7 days` });
  if (athD < -85)     sigs.push({ label: "💎 Deep Discount",  dir: "BUY",  w: 2, why: `${athD.toFixed(0)}% from ATH` });
  if (p1 > 3 && p24 > 5) sigs.push({ label: "⏱ Accelerating", dir: "BUY", w: 2, why: "1h and 24h both positive" });
  if (p24 > 50)       sigs.push({ label: "⚠️ Overextended",   dir: "SELL", w: 3, why: `+${p24.toFixed(0)}% in 24h — reversal likely` });
  if (p7 > 100)       sigs.push({ label: "📉 Overheated",     dir: "SELL", w: 3, why: `+${p7.toFixed(0)}% in 7d — correction expected` });
  if (vm > 80 && p24 > 30) sigs.push({ label: "🔴 Extreme Vol", dir: "SELL", w: 2, why: "Possible final stage of pump" });
  const buy  = sigs.filter(s => s.dir === "BUY").reduce((a, s) => a + s.w, 0);
  const sell = sigs.filter(s => s.dir === "SELL").reduce((a, s) => a + s.w, 0);
  let verdict = "WATCH", vColor = T.gold, vBg = `${T.gold}12`;
  if (buy >= 5 && sell < 3)      { verdict = "STRONG BUY";  vColor = T.green;   vBg = `${T.green}12`; }
  else if (buy >= 3 && sell < 2) { verdict = "BUY";         vColor = "#4ade80"; vBg = "#4ade8010"; }
  else if (sell >= 5)            { verdict = "TAKE PROFIT"; vColor = T.red;     vBg = `${T.red}12`; }
  else if (sell >= 2 && buy < 2) { verdict = "CAUTION";     vColor = T.gold;    vBg = `${T.gold}10`; }
  return { verdict, vColor, vBg, signals: sigs, score: buy - sell, vm, sr: getSR(c.current_price) };
}

const CAT_MAP = {
  bitcoin:"largecap",ethereum:"largecap",binancecoin:"largecap",ripple:"largecap",
  solana:"largecap",cardano:"largecap",dogecoin:"largecap",litecoin:"largecap",
  "bitcoin-cash":"largecap",cosmos:"largecap",filecoin:"largecap",
  "avalanche-2":"altcoin",chainlink:"altcoin",polkadot:"altcoin",uniswap:"altcoin",
  sui:"altcoin","near-protocol":"altcoin",aptos:"altcoin","injective-protocol":"altcoin",
  arbitrum:"altcoin",optimism:"altcoin",sei:"altcoin",hedera:"altcoin",
  "render-token":"ai","fetch-ai":"ai",bittensor:"ai","the-graph":"ai","io-net":"ai",
  "shiba-inu":"meme",pepe:"meme","dogwifcoin":"meme",bonk:"meme",floki:"meme","brett":"meme",
  "pax-gold":"rwa",maker:"rwa","ondo-finance":"rwa",pendle:"rwa",
  tether:"stable","usd-coin":"stable",dai:"stable",
};
const getCat = id => CAT_MAP[id] || "altcoin";

const CATS = [
  { id:"all",      label:"All Coins",   color: T.purple },
  { id:"largecap", label:"💎 Large Cap", color:"#f59e0b" },
  { id:"altcoin",  label:"⚡ Altcoins",  color:"#3b82f6" },
  { id:"ai",       label:"🤖 AI/DePIN",  color: T.purple },
  { id:"meme",     label:"🐸 Meme",      color:"#f97316" },
  { id:"rwa",      label:"🏦 RWA",       color:"#22c55e" },
  { id:"stable",   label:"💵 Stables",   color: T.text3  },
];

const NEWS = [
  { id:1,  time:"4m",  h:"SEC approves ETH ETF staking — institutional access expands",        imp:"BULLISH", str:3, coins:["ETH","LINK","UNI"], cat:"Regulatory",   ex:"ETF staking means institutions earn yield on ETH. Historically triggers 20-40% rallies." },
  { id:2,  time:"11m", h:"Fed signals rate pause — global risk appetite improves",             imp:"BULLISH", str:2, coins:["BTC","ETH","SOL"], cat:"Macro",         ex:"Rate pauses push investors into riskier assets. One of the biggest macro tailwinds for crypto." },
  { id:3,  time:"18m", h:"Solana fee upgrade live — transaction costs drop 80%",               imp:"BULLISH", str:2, coins:["SOL","BONK"],      cat:"Tech",          ex:"Cheaper fees drive more users and demand for SOL across the entire ecosystem." },
  { id:4,  time:"25m", h:"BlackRock files tokenized Treasury product on Ethereum",             imp:"BULLISH", str:3, coins:["ETH","ONDO"],      cat:"Institutional", ex:"Wall Street's biggest firm on Ethereum validates the entire RWA sector." },
  { id:5,  time:"34m", h:"Nvidia GPU supply improves — AI crypto tokens surge",                imp:"BULLISH", str:2, coins:["RNDR","FET","TAO"], cat:"Narrative",    ex:"More GPU availability means more AI compute on-chain and more demand for AI tokens." },
  { id:6,  time:"1h",  h:"$280M BTC moved to cold storage — supply squeeze forming",           imp:"BULLISH", str:3, coins:["BTC"],             cat:"On-Chain",      ex:"Cold storage means not selling. Removes supply from exchanges and creates upward pressure." },
  { id:7,  time:"2h",  h:"DeFi exploit drains $22M from Base chain protocol",                  imp:"BEARISH", str:2, coins:["ETH","UNI"],       cat:"Security",      ex:"Hacks cause panic selling. Watch for contagion to similar DeFi protocols." },
  { id:8,  time:"3h",  h:"DOJ investigation into major exchange expands",                      imp:"BEARISH", str:3, coins:["BNB"],             cat:"Regulatory",    ex:"Active investigations cause sustained selling pressure until legal clarity arrives." },
  { id:9,  time:"3h",  h:"BTC dominance at 58.5% — altcoin season not yet",                   imp:"NEUTRAL", str:1, coins:["BTC"],             cat:"Market",        ex:"Alt season starts when BTC dominance falls below 52%." },
  { id:10, time:"4h",  h:"PEPE whale accumulates $15M across 4 wallets",                       imp:"BULLISH", str:2, coins:["PEPE"],            cat:"On-Chain",      ex:"Coordinated whale accumulation before a move is one of the clearest early signals." },
];

const CHECKLIST = [
  "Market regime is GREEN or YELLOW?",
  "Coin credibility is solid — not a brand new or anonymous project?",
  "Confidence score is 65 or above?",
  "Risk/Reward ratio is 1.5:1 or better?",
  "Price is near a support level — not at resistance?",
  "Clear exit plan with Take Profit and Stop Loss levels set?",
  "Within daily risk budget — not already at 3% loss today?",
  "No major macro event in the next 2 hours?",
];

const TABS = [
  { id:"dashboard",   label:"Dashboard"    },
  { id:"signals",     label:"Signals"      },
  { id:"journal",     label:"Journal"      },
  { id:"news",        label:"News"         },
  { id:"performance", label:"Performance"  },
  { id:"ai",          label:"AI Intel"     },
  { id:"settings",    label:"Settings"     },
];

// ─── Reusable UI atoms ──────────────────────────────────────────────────────
const Card = ({ children, style = {}, accent }) => (
  <div style={{
    background: T.card,
    border: `1px solid ${accent ? accent + "40" : T.border}`,
    borderRadius: 14,
    padding: "18px 20px",
    ...style,
  }}>{children}</div>
);

const Label = ({ children, color = T.text3, style = {} }) => (
  <div style={{ fontSize: 11, letterSpacing: "0.12em", color, textTransform: "uppercase", fontWeight: 600, marginBottom: 8, ...style }}>{children}</div>
);

const Pill = ({ children, color, size = 11 }) => (
  <span style={{ display:"inline-flex", alignItems:"center", fontSize: size, fontWeight: 700, letterSpacing:"0.05em", padding:"3px 10px", borderRadius: 20, background:`${color}18`, border:`1px solid ${color}50`, color, whiteSpace:"nowrap" }}>{children}</span>
);

const StatCard = ({ label, value, color, sub }) => (
  <Card style={{ padding:"16px 18px" }}>
    <Label>{label}</Label>
    <div style={{ fontSize: 26, fontWeight: 800, color: color || T.text, letterSpacing:"-0.02em", lineHeight:1 }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: T.text3, marginTop: 6 }}>{sub}</div>}
  </Card>
);

// ─── Support/Resistance Visual ──────────────────────────────────────────────
function SRVisual({ price, sr }) {
  if (!sr || !price) return null;
  const levels = [
    { key:"r2", label:"Resistance 2", value:sr.r2, color:T.red,    pct:"+15%" },
    { key:"r1", label:"Resistance 1", value:sr.r1, color:"#f97316", pct:"+7%"  },
    { key:"now",label:"Current Price",value:price, color:T.purple,  pct:"NOW"  },
    { key:"s1", label:"Support 1",    value:sr.s1, color:"#4ade80", pct:"-6%"  },
    { key:"s2", label:"Support 2",    value:sr.s2, color:T.green,   pct:"-14%" },
  ];
  const max = sr.r2, min = sr.s2, range = max - min;
  return (
    <div style={{ background: T.surface, border:`1px solid ${T.border}`, borderRadius:10, padding:"14px 16px", marginBottom:14 }}>
      <Label color={T.purple2}>Support &amp; Resistance Levels</Label>
      <div style={{ fontSize:11, color:T.text3, marginBottom:12, lineHeight:1.6 }}>
        <span style={{ color:T.red }}>Red = Resistance</span> — price may stall or drop here ·{" "}
        <span style={{ color:T.green }}>Green = Support</span> — price may bounce up here
      </div>
      {levels.map(lv => {
        const pct = ((lv.value - min) / range) * 100;
        const isNow = lv.key === "now";
        return (
          <div key={lv.key} style={{ display:"flex", alignItems:"center", gap:10, marginBottom: isNow ? 10 : 7 }}>
            <div style={{ width:90, fontSize:11, color:lv.color, fontWeight: isNow ? 800 : 500, flexShrink:0 }}>{lv.label}</div>
            <div style={{ flex:1, position:"relative", height: isNow ? 10 : 5, background:T.border, borderRadius:3, overflow:"hidden" }}>
              <div style={{ position:"absolute", left:0, top:0, height:"100%", width:`${pct}%`, background:lv.color, borderRadius:3 }} />
            </div>
            <div style={{ width:70, fontSize:11, color:lv.color, fontWeight: isNow ? 800 : 500, textAlign:"right", flexShrink:0 }}>{fu(lv.value)}</div>
            <div style={{ width:36, fontSize:10, color:T.text3, textAlign:"right", flexShrink:0 }}>{lv.pct}</div>
          </div>
        );
      })}
      <div style={{ marginTop:12, padding:"10px 12px", background:T.card, borderRadius:8, fontSize:11, color:T.text2, lineHeight:1.7 }}>
        <span style={{ color:T.purple2, fontWeight:700 }}>Strategy tip: </span>
        Consider entering near Support 1 ({fu(sr.s1)}) and taking profit near Resistance 1 ({fu(sr.r1)}).
        That's a potential <span style={{ color:T.green, fontWeight:700 }}>{((sr.r1 - sr.s1) / sr.s1 * 100).toFixed(1)}% gain</span>.
      </div>
    </div>
  );
}

// ─── Main App ───────────────────────────────────────────────────────────────
export default function App() {
  const [coins, setCoins]         = useState([]);
  const [status, setStatus]       = useState("loading");
  const [lastFetch, setLastFetch] = useState(null);
  const [tab, setTab]             = useState("dashboard");
  const [activeCat, setActiveCat] = useState("all");
  const [search, setSearch]       = useState("");
  const [expanded, setExpanded]   = useState(null);
  const [watchlist, setWatchlist] = useState(["injective-protocol","the-graph","bittensor","pepe","dogwifcoin","render-token"]);
  const [alerts, setAlerts]       = useState([]);
  const [selNews, setSelNews]     = useState(null);
  const [aiResult, setAiResult]   = useState("");
  const [aiLoad, setAiLoad]       = useState(false);
  const [aiCtx, setAiCtx]         = useState("");
  const [trades, setTrades]       = useState([]);
  const [sigLog, setSigLog]       = useState([]);
  const [checklist, setChecklist] = useState({});
  const [showCL, setShowCL]       = useState(false);
  const [clTarget, setClTarget]   = useState(null);
  const [showTF, setShowTF]       = useState(false);
  const [tf, setTf]               = useState({ coin:"", entry:"", size:"", type:"swing", notes:"" });
  const [checkinDone, setCheckinDone]   = useState(false);
  const [checkinScore, setCheckinScore] = useState(null);
  const [showCI, setShowCI]             = useState(false);
  const [ciAns, setCiAns]               = useState({});
  const [cfg, setCfg]             = useState({ acct:500, risk:2, maxPos:4, dllimit:3, minScore:60, paper:true });
  const alertRef = useRef([]);
  const timerRef = useRef(null);

  // ── Fetch live data ────────────────────────────────────────────────────
  const fetchCoins = useCallback(async (silent = false) => {
    if (!silent) setStatus("loading");
    try {
      const pages = await Promise.all([1,2,3].map(p =>
        fetch(`${GC}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=${p}&sparkline=false&price_change_percentage=1h,24h,7d`)
          .then(r => r.ok ? r.json() : [])
      ));
      const all = pages.flat().map(c => ({ ...c, cat: getCat(c.id) }));
      if (!all.length) throw new Error("empty");
      setCoins(all);
      setStatus("live");
      setLastFetch(nowT());
      // log signals
      setSigLog(prev => {
        const fresh = all.flatMap(c => {
          const { verdict, score } = getSignals(c);
          if (!["STRONG BUY","BUY","TAKE PROFIT"].includes(verdict)) return [];
          if (prev.some(s => s.id === c.id && Date.now() - s.ts < 3600000)) return [];
          return [{ id:c.id, symbol:c.symbol?.toUpperCase(), name:c.name, verdict, score, price:c.current_price, p24:c.price_change_percentage_24h??0, time:nowT(), ts:Date.now() }];
        });
        return [...fresh, ...prev].slice(0, 100);
      });
    } catch {
      if (!silent) setStatus("error");
    }
  }, []);

  useEffect(() => { fetchCoins(); }, [fetchCoins]);
  useEffect(() => {
    timerRef.current = setInterval(() => fetchCoins(true), 90000);
    return () => clearInterval(timerRef.current);
  }, [fetchCoins]);

  // ── Auto alerts ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!coins.length) return;
    const fired = [];
    coins.forEach(c => {
      const { verdict, vColor, signals } = getSignals(c);
      if (verdict === "STRONG BUY" || verdict === "TAKE PROFIT") {
        const recent = alertRef.current.some(a => a.id === c.id && Date.now() - a.ts < 180000);
        if (!recent) {
          fired.push({ ...c, verdict, vColor, signals, alertTime: nowT(), ts: Date.now() });
          alertRef.current = [...alertRef.current.filter(a => a.id !== c.id), { id:c.id, ts:Date.now() }];
        }
      }
    });
    if (fired.length) setAlerts(prev => [...fired, ...prev].slice(0, 30));
  }, [coins]);

  // ── Derived data ───────────────────────────────────────────────────────
  const enriched   = coins.map(c => ({ ...c, ...getSignals(c) }));
  const btc        = enriched.find(c => c.id === "bitcoin");
  const topBuys    = enriched.filter(c => c.verdict === "STRONG BUY" || c.verdict === "BUY").sort((a,b) => b.score - a.score);
  const topSells   = enriched.filter(c => c.verdict === "TAKE PROFIT");
  const watchCoins = enriched.filter(c => watchlist.includes(c.id));
  const browsed    = enriched
    .filter(c => (activeCat === "all" || c.cat === activeCat) && (!search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.symbol?.toLowerCase().includes(search.toLowerCase())))
    .sort((a,b) => (b.score||0) - (a.score||0));
  const openTrades   = trades.filter(t => !t.closed);
  const closedTrades = trades.filter(t => t.closed);
  const dailyPnL     = closedTrades.reduce((a,t) => a + (t.pnl||0), 0);
  const winRate      = closedTrades.length ? Math.round(closedTrades.filter(t => t.pnl > 0).length / closedTrades.length * 100) : 0;

  function getRegime() {
    const b = btc?.price_change_percentage_24h ?? 0;
    if (b < -8) return { label:"🔴 STOP TRADING",  color:T.red    };
    if (b < -4) return { label:"🟠 HIGH ALERT",     color:"#f97316" };
    if (Math.abs(b) > 2) return { label:"🟡 ELEVATED", color:T.gold };
    return              { label:"🟢 FULL SPEED",    color:T.green  };
  }
  function getWindow() {
    const h = new Date().getHours();
    if (h >= 9  && h <= 11) return { label:"🔥 US Market Open",    color:T.green  };
    if (h >= 13 && h <= 15) return { label:"⚡ US Afternoon",       color:T.gold   };
    if (h >= 20 && h <= 23) return { label:"🌏 Asia Open",          color:T.purple };
    if (h >= 0  && h <= 3)  return { label:"🌏 Asia Peak",          color:T.purple };
    return                         { label:"💤 Low Activity",       color:T.text3  };
  }

  const regime  = getRegime();
  const window_ = getWindow();

  // ── AI ─────────────────────────────────────────────────────────────────
  const runAI = useCallback(async (list, context) => {
    setAiLoad(true); setAiResult(""); setAiCtx(context); setTab("ai");
    const sum = list.slice(0,10).map(c => {
      const { verdict, sr } = getSignals(c);
      const srTxt = sr ? `S1:${fu(sr.s1)} R1:${fu(sr.r1)}` : "";
      return `${c.name}(${c.symbol?.toUpperCase()}): $${fu(c.current_price)}, 24h ${fp(c.price_change_percentage_24h??0)}, 7d ${fp(c.price_change_percentage_7d_in_currency??0)}, vol/mcap ${c.total_volume&&c.market_cap?((c.total_volume/c.market_cap)*100).toFixed(1):"?"}%, signal:${verdict}, ${srTxt}`;
    }).join("\n");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          model:"claude-sonnet-4-20250514", max_tokens:1200,
          messages:[{ role:"user", content:`You are BLKROSE AI — a professional crypto analyst. The user is a complete beginner with $${cfg.acct} capital doing swing trades. Mode: ${cfg.paper?"PAPER TRADING":"LIVE TRADING"}.

Context: ${context}
Account: $${cfg.acct} | Risk/trade: ${cfg.risk}% = $${(cfg.acct*cfg.risk/100).toFixed(2)} max
Market Regime: ${regime.label} | BTC 24h: ${fp(btc?.price_change_percentage_24h)}

LIVE data with Support/Resistance:
${sum}

Reply in EXACTLY this format:

🎯 BOTTOM LINE
[1-2 sentences. Simple direct verdict.]

📊 WHAT THE DATA SHOWS
[3-4 bullets. Plain English. Define jargon in brackets.]

🏆 TOP PICKS
[2-3 coins. Name each, reasoning with numbers, mention support level as ideal entry.]

⚠️ KEY RISK
[1-2 sentences.]

📋 YOUR ACTION PLAN
[Specific steps. Max per trade: $${(cfg.acct*cfg.risk/100).toFixed(2)}. Recommend paper trading if score under 75.]` }]
        })
      });
      const d = await res.json();
      setAiResult(d.content?.find(b => b.type==="text")?.text || "No response.");
    } catch(e) { setAiResult("AI error: " + e.message); }
    setAiLoad(false);
  }, [cfg, regime, btc]);

  // ── Trade helpers ──────────────────────────────────────────────────────
  function logTrade() {
    const coin  = enriched.find(c => c.symbol?.toUpperCase() === tf.coin.toUpperCase() || c.name?.toLowerCase() === tf.coin.toLowerCase());
    const entry = parseFloat(tf.entry);
    const size  = parseFloat(tf.size);
    if (!tf.coin || isNaN(entry) || isNaN(size)) return;
    const atr = entry * 0.04;
    const tp  = tf.type === "scalp" ? entry + atr*1.5 : tf.type === "swing" ? entry + atr*2.5 : entry + atr*3.5;
    const sl  = entry - atr;
    const rr  = ((tp - entry) / (entry - sl)).toFixed(1);
    setTrades(prev => [{ id:Date.now(), coinId:coin?.id||tf.coin.toLowerCase(), symbol:tf.coin.toUpperCase(), name:coin?.name||tf.coin, entry, size, type:tf.type, notes:tf.notes, tp, sl, rr, openTime:nowT(), closed:false, pnl:null, paper:cfg.paper, signalAtEntry:coin?getSignals(coin).verdict:"MANUAL" }, ...prev]);
    setShowTF(false);
    setTf({ coin:"", entry:"", size:"", type:"swing", notes:"" });
    setTab("journal");
  }

  function closeTrade(id) {
    const exit = parseFloat(window.prompt("Close at what exit price?"));
    if (isNaN(exit)) return;
    setTrades(prev => prev.map(t => {
      if (t.id !== id) return t;
      return { ...t, closed:true, exitPrice:exit, pnl:(exit-t.entry)*(t.size/t.entry), closeTime:nowT() };
    }));
  }

  // ── Coin Card ──────────────────────────────────────────────────────────
  function CoinCard({ c }) {
    const isExp   = expanded === c.id;
    const watched = watchlist.includes(c.id);
    const p24 = c.price_change_percentage_24h ?? 0;
    const p7  = c.price_change_percentage_7d_in_currency ?? 0;
    return (
      <div style={{ marginBottom:8 }}>
        <div onClick={() => setExpanded(isExp ? null : c.id)}
          style={{ padding:"14px 16px", background: isExp ? T.card : T.surface, border:`1px solid ${isExp ? (c.vColor||T.purple)+"60" : T.border}`, borderRadius: isExp ? "12px 12px 0 0" : 12, cursor:"pointer", transition:"all 0.2s" }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            {c.image && <img src={c.image} alt="" style={{ width:32, height:32, borderRadius:"50%", flexShrink:0 }} onError={e => { e.target.style.display="none"; }} />}
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:3 }}>
                <span style={{ fontSize:16, fontWeight:800, color:T.text, letterSpacing:"-0.01em" }}>{c.symbol?.toUpperCase()}</span>
                {c.market_cap_rank && <span style={{ fontSize:10, color:T.text4, background:T.card, padding:"1px 6px", borderRadius:4 }}>#{c.market_cap_rank}</span>}
                <Pill color={c.vColor || T.gold}>{c.verdict || "WATCH"}</Pill>
                {c.sr && <Pill color={T.purple} size={10}>S/R</Pill>}
              </div>
              <div style={{ fontSize:12, color:T.text3 }}>{c.name} · {fu(c.market_cap)}</div>
            </div>
            <div style={{ textAlign:"right", flexShrink:0 }}>
              <div style={{ fontSize:16, fontWeight:700, color:T.text }}>{fu(c.current_price)}</div>
              <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:2 }}>
                <span style={{ fontSize:12, color:pc(p24) }}>{fp(p24)}</span>
                <span style={{ fontSize:12, color:pc(p7) }}>{fp(p7)} 7d</span>
              </div>
            </div>
            <button onClick={e => { e.stopPropagation(); setWatchlist(w => w.includes(c.id) ? w.filter(x => x !== c.id) : [...w, c.id]); }}
              style={{ background:"none", border:"none", cursor:"pointer", fontSize:22, color: watched ? T.purple : T.text4, padding:"0 2px", flexShrink:0 }}>
              {watched ? "★" : "☆"}
            </button>
          </div>
        </div>
        {isExp && (
          <div style={{ background:T.card, border:`1px solid ${(c.vColor||T.purple)}40`, borderTop:"none", borderRadius:"0 0 12px 12px", padding:18 }}>
            {/* Score */}
            <div style={{ marginBottom:16 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                <Label style={{ marginBottom:0 }}>Confidence Score</Label>
                <span style={{ fontSize:22, fontWeight:800, color:c.vColor||T.purple }}>{Math.min(Math.abs(c.score||0)*12,100)}<span style={{ fontSize:13, color:T.text3 }}>/100</span></span>
              </div>
              <div style={{ height:6, background:T.border, borderRadius:3, overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${Math.min(Math.abs(c.score||0)*12,100)}%`, background:`linear-gradient(90deg, ${T.purple3}, ${T.purple2})`, borderRadius:3 }} />
              </div>
            </div>
            {/* S/R */}
            {c.sr && <SRVisual price={c.current_price} sr={c.sr} />}
            {/* Signals */}
            {c.signals?.length > 0 && (
              <div style={{ marginBottom:14 }}>
                <Label>Signals Detected</Label>
                {c.signals.map((s,i) => (
                  <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"9px 12px", background:T.surface, border:`1px solid ${s.dir==="BUY"?"#22c55e22":"#ef444422"}`, borderRadius:8, marginBottom:6 }}>
                    <span style={{ fontSize:13, flexShrink:0 }}>{s.label}</span>
                    <span style={{ fontSize:12, color:T.text2, lineHeight:1.5, flex:1 }}>{s.why}</span>
                    <span style={{ fontSize:11, fontWeight:700, color:s.dir==="BUY"?T.green:T.red, flexShrink:0 }}>{s.dir}</span>
                  </div>
                ))}
              </div>
            )}
            {/* Stats */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:14 }}>
              {[["1h Change", fp(c.price_change_percentage_1h_in_currency), pc(c.price_change_percentage_1h_in_currency)],
                ["24h Volume", fu(c.total_volume), T.text2],
                ["ATH Drop",  fp(c.ath_change_percentage), pc(c.ath_change_percentage)]
              ].map(([k,v,col]) => (
                <div key={k} style={{ background:T.surface, padding:"10px 12px", borderRadius:8 }}>
                  <div style={{ fontSize:10, color:T.text3, letterSpacing:"0.08em", marginBottom:4 }}>{k.toUpperCase()}</div>
                  <div style={{ fontSize:13, color:col, fontWeight:600 }}>{v}</div>
                </div>
              ))}
            </div>
            {/* Actions */}
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              <button onClick={() => { setClTarget(c); setChecklist({}); setShowCL(true); }}
                style={{ flex:1, padding:"10px", background:`${T.purple}12`, border:`1px solid ${T.purple}60`, borderRadius:8, color:T.purple2, cursor:"pointer", fontSize:12, fontFamily:"inherit", fontWeight:700 }}>
                ✅ Pre-Trade Checklist
              </button>
              <button onClick={() => runAI([c], `Deep dive on ${c.name} — live price ${fu(c.current_price)}, S1 ${fu(c.sr?.s1)}, R1 ${fu(c.sr?.r1)}. Should I trade this right now?`)}
                style={{ flex:1, padding:"10px", background:`${c.vColor}12`, border:`1px solid ${c.vColor}60`, borderRadius:8, color:c.vColor, cursor:"pointer", fontSize:12, fontFamily:"inherit", fontWeight:700 }}>
                ⚡ AI Deep Dive
              </button>
              <a href={`https://www.tradingview.com/chart/?symbol=${c.symbol?.toUpperCase()}USDT`} target="_blank" rel="noopener noreferrer"
                style={{ flex:1, padding:"10px", background:`${T.blue}12`, border:`1px solid ${T.blue}60`, borderRadius:8, color:T.blue, cursor:"pointer", fontSize:12, fontFamily:"inherit", fontWeight:700, textDecoration:"none", textAlign:"center" }}>
                📊 Live Chart ↗
              </a>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── LOADING / ERROR ────────────────────────────────────────────────────
  if (status === "loading") return (
    <div style={{ minHeight:"100vh", background:T.bg, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", fontFamily:"system-ui, sans-serif" }}>
      <div style={{ width:56, height:56, background:`linear-gradient(135deg,${T.purple3},${T.purple})`, borderRadius:16, display:"flex", alignItems:"center", justifyContent:"center", fontSize:26, fontWeight:900, color:"white", marginBottom:20 }}>₿</div>
      <div style={{ fontSize:22, fontWeight:800, color:T.text, letterSpacing:"-0.02em", marginBottom:6 }}>BLKROSE <span style={{ color:T.purple2 }}>CRYPTO INTEL</span></div>
      <div style={{ fontSize:13, color:T.text3, letterSpacing:"0.1em" }}>LOADING LIVE MARKET DATA...</div>
      <div style={{ marginTop:24, width:200, height:3, background:T.border, borderRadius:2, overflow:"hidden" }}>
        <div style={{ height:"100%", width:"60%", background:`linear-gradient(90deg,${T.purple3},${T.purple2})`, borderRadius:2, animation:"slide 1.5s ease-in-out infinite" }} />
      </div>
      <style>{`@keyframes slide{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}`}</style>
    </div>
  );

  if (status === "error") return (
    <div style={{ minHeight:"100vh", background:T.bg, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", fontFamily:"system-ui, sans-serif", textAlign:"center", padding:24 }}>
      <div style={{ fontSize:24, marginBottom:12 }}>⚠️</div>
      <div style={{ fontSize:20, fontWeight:700, color:T.text, marginBottom:8 }}>API Rate Limited</div>
      <div style={{ fontSize:13, color:T.text3, maxWidth:360, lineHeight:1.7, marginBottom:24 }}>CoinGecko free tier limit reached. This is temporary — usually clears in 60 seconds.</div>
      <button onClick={() => fetchCoins()} style={{ padding:"11px 28px", background:`linear-gradient(135deg,${T.purple3},${T.purple})`, border:"none", borderRadius:10, color:"white", cursor:"pointer", fontSize:13, fontWeight:700 }}>↻ Retry</button>
    </div>
  );

  // ── MAIN RENDER ────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:"100vh", background:T.bg, color:T.text, fontFamily:"system-ui,-apple-system,sans-serif", fontSize:14 }}>

      {/* ── HEADER ── */}
      <div style={{ background:T.surface, borderBottom:`1px solid ${T.border}`, position:"sticky", top:0, zIndex:50 }}>
        <div style={{ maxWidth:1400, margin:"0 auto", padding:"0 24px" }}>
          {/* Top bar — split logo left, stats right */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 0 10px" }}>
            {/* Logo */}
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ width:40, height:40, background:`linear-gradient(135deg,${T.purple3},${T.purple})`, borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, fontWeight:900, color:"white", flexShrink:0 }}>₿</div>
              <div>
                <div style={{ fontSize:19, fontWeight:800, letterSpacing:"-0.02em", lineHeight:1 }}>
                  BLKROSE <span style={{ color:T.purple2 }}>CRYPTO INTEL</span>
                </div>
                <div style={{ fontSize:10, color:T.text3, letterSpacing:"0.1em", marginTop:3 }}>
                  {coins.length} LIVE COINS · UPDATED {lastFetch || "..."}
                </div>
              </div>
            </div>
            {/* Live stats right */}
            <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", justifyContent:"flex-end" }}>
              <div style={{ padding:"6px 14px", borderRadius:20, fontSize:11, fontWeight:700, background:`${regime.color}15`, border:`1px solid ${regime.color}50`, color:regime.color }}>{regime.label}</div>
              <div style={{ padding:"6px 12px", borderRadius:20, fontSize:11, background:`${window_.color}12`, border:`1px solid ${window_.color}40`, color:window_.color }}>{window_.label}</div>
              {cfg.paper && <div style={{ padding:"5px 11px", borderRadius:20, fontSize:11, background:`${T.purple}12`, border:`1px solid ${T.purple}40`, color:T.purple2 }}>📄 PAPER</div>}
              <div style={{ padding:"5px 11px", borderRadius:20, fontSize:11, background:`${T.green}12`, border:`1px solid ${T.green}40`, color:T.green }}>● LIVE</div>
              <button onClick={() => { alertRef.current=[]; fetchCoins(); }} style={{ padding:"6px 12px", background:T.card, border:`1px solid ${T.border}`, borderRadius:8, color:T.text3, cursor:"pointer", fontSize:12 }}>↻</button>
            </div>
          </div>
          {/* Quick signal pills */}
          <div style={{ display:"flex", gap:6, paddingBottom:10, overflowX:"auto" }}>
            {[
              { label:`${topBuys.filter(c=>c.verdict==="STRONG BUY").length} Strong Buy`, color:T.green },
              { label:`${topBuys.filter(c=>c.verdict==="BUY").length} Buy`,               color:"#4ade80" },
              { label:`${topSells.length} Take Profit`,                                   color:T.red    },
              { label:`${alerts.length} Alerts`,                                          color:T.purple2},
              { label:`${watchCoins.length} Watching`,                                    color:T.gold   },
            ].map(b => (
              <div key={b.label} style={{ padding:"3px 12px", background:`${b.color}12`, border:`1px solid ${b.color}35`, borderRadius:20, fontSize:11, color:b.color, whiteSpace:"nowrap", flexShrink:0 }}>{b.label}</div>
            ))}
          </div>
          {/* Nav tabs */}
          <div style={{ display:"flex", borderTop:`1px solid ${T.border}` }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={{ flex:1, padding:"11px 6px", background:"none", border:"none", borderBottom:`2px solid ${tab===t.id ? T.purple : "transparent"}`, color: tab===t.id ? T.purple2 : T.text3, cursor:"pointer", fontSize:12, fontWeight: tab===t.id ? 700 : 400, fontFamily:"inherit", transition:"all 0.15s", letterSpacing:"0.02em" }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth:1400, margin:"0 auto", padding:"24px 24px 80px" }}>

        {/* ════════════════════════════════════════════════════════════
            DASHBOARD
        ════════════════════════════════════════════════════════════ */}
        {tab === "dashboard" && (
          <div>
            {/* Check-in banner */}
            {!checkinDone ? (
              <Card accent={T.purple} style={{ marginBottom:16, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <div style={{ fontSize:15, fontWeight:700, color:T.purple2, marginBottom:4 }}>🧠 Pre-Session Check-In</div>
                  <div style={{ fontSize:12, color:T.text3 }}>Complete before your first trade. Research shows emotional state directly impacts trading results.</div>
                </div>
                <button onClick={() => setShowCI(true)} style={{ padding:"10px 20px", background:`linear-gradient(135deg,${T.purple3},${T.purple})`, border:"none", borderRadius:10, color:"white", cursor:"pointer", fontSize:13, fontWeight:700, whiteSpace:"nowrap", marginLeft:16 }}>Start →</button>
              </Card>
            ) : (
              <Card accent={checkinScore>=67?T.green:T.gold} style={{ marginBottom:16 }}>
                <div style={{ fontSize:14, fontWeight:700, color:checkinScore>=67?T.green:T.gold }}>
                  {checkinScore>=67?"✅ Good to trade today":"⚠️ Consider paper trading only"} — Mental score: {checkinScore}/100
                </div>
                <div style={{ fontSize:12, color:T.text3, marginTop:4 }}>{checkinScore>=67?"Emotional state looks good. Follow your rules and trade your plan.":"Elevated stress detected. Stick to high-confidence signals only."}</div>
              </Card>
            )}
            {/* Stat row */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:12, marginBottom:16 }}>
              <StatCard label="Account"    value={`$${cfg.acct.toLocaleString()}`} color={T.purple2} />
              <StatCard label="Daily P&L"  value={fu(dailyPnL)}  color={pc(dailyPnL)} />
              <StatCard label="Open / Max" value={`${openTrades.length} / ${cfg.maxPos}`} color={T.blue} />
              <StatCard label="Strong Buys" value={topBuys.filter(c=>c.verdict==="STRONG BUY").length} color={T.green} />
              <StatCard label="Alerts" value={alerts.length} color={T.purple2} />
            </div>
            {/* Regime + BTC */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:16 }}>
              <Card accent={regime.color}>
                <Label>Market Regime</Label>
                <div style={{ fontSize:22, fontWeight:800, color:regime.color, marginBottom:8, letterSpacing:"-0.01em" }}>{regime.label}</div>
                <div style={{ fontSize:12, color:T.text2 }}>BTC 24h: <span style={{ color:pc(btc?.price_change_percentage_24h), fontWeight:700 }}>{fp(btc?.price_change_percentage_24h)}</span> — this sets the risk environment for all trades today.</div>
              </Card>
              <Card accent={T.purple}>
                <Label>BTC — Market Baseline</Label>
                <div style={{ fontSize:28, fontWeight:800, color:T.text, letterSpacing:"-0.02em", marginBottom:8 }}>{fu(btc?.current_price)}</div>
                <div style={{ display:"flex", gap:20 }}>
                  {[["1H",btc?.price_change_percentage_1h_in_currency],["24H",btc?.price_change_percentage_24h],["7D",btc?.price_change_percentage_7d_in_currency]].map(([l,v])=>(
                    <div key={l}><div style={{ fontSize:10, color:T.text4, letterSpacing:"0.08em" }}>{l}</div><div style={{ fontSize:14, fontWeight:700, color:pc(v) }}>{fp(v)}</div></div>
                  ))}
                  {btc?.sr && <>
                    <div><div style={{ fontSize:10, color:T.text4, letterSpacing:"0.08em" }}>SUPPORT</div><div style={{ fontSize:14, fontWeight:700, color:T.green }}>{fu(btc.sr.s1)}</div></div>
                    <div><div style={{ fontSize:10, color:T.text4, letterSpacing:"0.08em" }}>RESIST.</div><div style={{ fontSize:14, fontWeight:700, color:T.red }}>{fu(btc.sr.r1)}</div></div>
                  </>}
                </div>
              </Card>
            </div>
            {/* Alerts */}
            {alerts.length > 0 && (
              <Card style={{ marginBottom:16 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                  <Label color={T.purple2} style={{ marginBottom:0 }}>⚡ Live Signal Alerts ({alerts.length})</Label>
                  <button onClick={() => runAI(alerts.slice(0,6),"All triggered alerts — which should I act on and why?")} style={{ padding:"6px 14px", background:`${T.purple}12`, border:`1px solid ${T.purple}50`, borderRadius:8, color:T.purple2, cursor:"pointer", fontSize:11, fontWeight:700, fontFamily:"inherit" }}>⚡ AI Read All</button>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:10 }}>
                  {alerts.slice(0,6).map(a => (
                    <div key={`${a.id}-${a.ts}`} onClick={() => { setSearch(a.symbol||""); setTab("signals"); }} style={{ padding:"14px 16px", background:T.surface, border:`1px solid ${a.vColor}50`, borderRadius:10, cursor:"pointer", transition:"border-color 0.2s" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          {a.image && <img src={a.image} alt="" style={{ width:24, height:24, borderRadius:"50%" }} />}
                          <div>
                            <div style={{ fontSize:15, fontWeight:800 }}>{a.symbol?.toUpperCase()}</div>
                            <div style={{ fontSize:10, color:T.text3 }}>{a.alertTime}</div>
                          </div>
                          <Pill color={a.vColor}>{a.verdict}</Pill>
                        </div>
                        <div style={{ textAlign:"right" }}>
                          <div style={{ fontSize:14, fontWeight:700 }}>{fu(a.current_price)}</div>
                          <div style={{ fontSize:12, color:pc(a.price_change_percentage_24h) }}>{fp(a.price_change_percentage_24h)}</div>
                        </div>
                      </div>
                      {a.sr && <div style={{ fontSize:11, color:T.text3 }}>S1: <span style={{ color:T.green }}>{fu(a.sr.s1)}</span> · R1: <span style={{ color:T.red }}>{fu(a.sr.r1)}</span></div>}
                    </div>
                  ))}
                </div>
              </Card>
            )}
            {/* Watchlist */}
            {watchCoins.length > 0 && (
              <Card>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                  <Label color={T.purple2} style={{ marginBottom:0 }}>⭐ Watchlist ({watchCoins.length})</Label>
                  <button onClick={() => runAI(watchCoins,"Review my full watchlist — read on each coin including support/resistance.")} style={{ padding:"6px 14px", background:`${T.purple}12`, border:`1px solid ${T.purple}50`, borderRadius:8, color:T.purple2, cursor:"pointer", fontSize:11, fontWeight:700, fontFamily:"inherit" }}>⚡ AI Review</button>
                </div>
                {watchCoins.map(c => <CoinCard key={c.id} c={c} />)}
              </Card>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════
            SIGNALS
        ════════════════════════════════════════════════════════════ */}
        {tab === "signals" && (
          <div>
            <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap", alignItems:"center" }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Search ${coins.length} live coins...`}
                style={{ padding:"10px 16px", background:T.card, border:`1px solid ${T.border}`, borderRadius:10, color:T.text, fontSize:13, fontFamily:"inherit", outline:"none", minWidth:240, flex:1, maxWidth:320 }} />
              <button onClick={() => runAI(topBuys.slice(0,10),"Best buy opportunities right now with support levels as entry points.")} style={{ padding:"10px 18px", background:`linear-gradient(135deg,${T.purple3},${T.purple})`, border:"none", borderRadius:10, color:"white", cursor:"pointer", fontSize:12, fontWeight:700 }}>⚡ AI Best Buys</button>
            </div>
            {/* Category filters */}
            <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:14 }}>
              {CATS.map(cat => (
                <button key={cat.id} onClick={() => setActiveCat(cat.id)}
                  style={{ padding:"6px 14px", background: activeCat===cat.id ? `${cat.color}18` : "transparent", border:`1px solid ${activeCat===cat.id ? cat.color : T.border}`, borderRadius:8, color: activeCat===cat.id ? cat.color : T.text3, cursor:"pointer", fontSize:12, fontFamily:"inherit", fontWeight: activeCat===cat.id ? 700 : 400 }}>
                  {cat.label} <span style={{ opacity:0.6 }}>({cat.id==="all" ? enriched.length : enriched.filter(c=>c.cat===cat.id).length})</span>
                </button>
              ))}
            </div>
            {/* Signal count badges */}
            <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:16, alignItems:"center" }}>
              {["STRONG BUY","BUY","WATCH","TAKE PROFIT","CAUTION"].map(v => {
                const cnt = browsed.filter(c=>c.verdict===v).length;
                const col = v==="STRONG BUY"?T.green:v==="BUY"?"#4ade80":v==="TAKE PROFIT"?T.red:v==="CAUTION"?T.gold:T.text3;
                return cnt>0 ? <span key={v} style={{ fontSize:11, padding:"3px 12px", background:`${col}12`, border:`1px solid ${col}35`, borderRadius:20, color:col }}>{v} ({cnt})</span> : null;
              })}
              <span style={{ fontSize:11, color:T.text4, marginLeft:4 }}>{browsed.length} coins</span>
            </div>
            {browsed.map(c => <CoinCard key={c.id} c={c} />)}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════
            JOURNAL
        ════════════════════════════════════════════════════════════ */}
        {tab === "journal" && (
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
              <div>
                <div style={{ fontSize:20, fontWeight:800, letterSpacing:"-0.02em", marginBottom:4 }}>Trade Journal</div>
                <div style={{ fontSize:12, color:T.text3 }}>{openTrades.length} open · {closedTrades.length} closed · {cfg.paper?"📄 Paper Mode":"💵 Live Mode"}</div>
              </div>
              <button onClick={() => setShowTF(true)} style={{ padding:"10px 20px", background:`linear-gradient(135deg,${T.green}cc,${T.green})`, border:"none", borderRadius:10, color:"white", cursor:"pointer", fontSize:13, fontWeight:700 }}>+ Log New Trade</button>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:18 }}>
              <StatCard label="Today P&L"  value={fu(dailyPnL)} color={pc(dailyPnL)} />
              <StatCard label="Win Rate"   value={winRate+"%"} color={winRate>=50?T.green:T.red} />
              <StatCard label="Trades"     value={trades.length} color={T.text2} />
              <StatCard label="Open / Max" value={`${openTrades.length}/${cfg.maxPos}`} color={T.purple2} />
            </div>
            {openTrades.map(t => {
              const coin = enriched.find(c=>c.id===t.coinId);
              const cur  = coin?.current_price || t.entry;
              const ur   = (cur - t.entry) * (t.size / t.entry);
              const pe   = ((cur - t.entry) / t.entry) * 100;
              let rec="HOLD", rc=T.gold;
              if (cur >= t.tp*0.97)              { rec="TAKE PROFIT NOW"; rc=T.green; }
              else if (cur <= t.sl*1.03)          { rec="CUT LOSS NOW";    rc=T.red;   }
              else if (coin&&(coin.verdict==="TAKE PROFIT"||coin.verdict==="CAUTION")) { rec="CONSIDER EXIT"; rc=T.gold; }
              return (
                <Card key={t.id} accent={rc} style={{ marginBottom:12 }}>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:12, marginBottom:12 }}>
                    <div><Label>Coin</Label><div style={{ fontSize:20, fontWeight:800 }}>{t.symbol}</div><div style={{ fontSize:11, color:T.text3 }}>{t.type.toUpperCase()}</div></div>
                    <div><Label>Entry → Now</Label><div style={{ fontSize:13, fontWeight:600 }}>{fu(t.entry)} → {fu(cur)}</div><div style={{ fontSize:13, color:pc(pe) }}>{fp(pe)}</div></div>
                    <div><Label>Unrealized</Label><div style={{ fontSize:15, fontWeight:700, color:pc(ur) }}>{ur>=0?"+":""}{fu(ur)}</div></div>
                    <div><Label>Recommendation</Label><div style={{ fontSize:14, fontWeight:800, color:rc }}>{rec}</div></div>
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:12 }}>
                    {[["Take Profit",fu(t.tp),T.green],["Stop Loss",fu(t.sl),T.red],["R:R",t.rr+":1",T.purple2]].map(([k,v,c])=>(
                      <div key={k} style={{ background:T.surface, padding:"10px 12px", borderRadius:8 }}>
                        <div style={{ fontSize:10, color:T.text3, marginBottom:4, letterSpacing:"0.08em" }}>{k.toUpperCase()}</div>
                        <div style={{ fontSize:14, fontWeight:700, color:c }}>{v}</div>
                      </div>
                    ))}
                  </div>
                  {t.notes && <div style={{ fontSize:12, color:T.text3, marginBottom:12, fontStyle:"italic" }}>"{t.notes}"</div>}
                  <div style={{ display:"flex", gap:8 }}>
                    <button onClick={()=>closeTrade(t.id)} style={{ padding:"8px 16px", background:`${T.red}12`, border:`1px solid ${T.red}50`, borderRadius:8, color:T.red, cursor:"pointer", fontSize:12, fontFamily:"inherit", fontWeight:600 }}>Close Trade</button>
                    <button onClick={()=>runAI([coin||{name:t.symbol,symbol:t.symbol,current_price:cur,price_change_percentage_24h:0,price_change_percentage_7d_in_currency:0,total_volume:0,market_cap:0,ath_change_percentage:0}],`I hold ${t.symbol} entered at ${fu(t.entry)}, now ${fu(cur)}. Should I hold or exit?`)}
                      style={{ padding:"8px 16px", background:`${T.purple}12`, border:`1px solid ${T.purple}50`, borderRadius:8, color:T.purple2, cursor:"pointer", fontSize:12, fontFamily:"inherit", fontWeight:600 }}>⚡ AI Advice</button>
                  </div>
                </Card>
              );
            })}
            {closedTrades.length > 0 && (
              <Card>
                <Label>Trade History</Label>
                <div style={{ overflowX:"auto" }}>
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                    <thead><tr style={{ borderBottom:`1px solid ${T.border}` }}>
                      {["Coin","Type","Entry","Exit","P&L","Result","Signal"].map(h=><th key={h} style={{ padding:"8px 12px", textAlign:"left", fontSize:10, color:T.text3, fontWeight:600, letterSpacing:"0.08em" }}>{h.toUpperCase()}</th>)}
                    </tr></thead>
                    <tbody>
                      {closedTrades.map(t=>(
                        <tr key={t.id} style={{ borderBottom:`1px solid ${T.surface}` }}>
                          <td style={{ padding:"10px 12px", fontWeight:700 }}>{t.symbol}</td>
                          <td style={{ padding:"10px 12px", color:T.text3 }}>{t.type}</td>
                          <td style={{ padding:"10px 12px" }}>{fu(t.entry)}</td>
                          <td style={{ padding:"10px 12px" }}>{fu(t.exitPrice)}</td>
                          <td style={{ padding:"10px 12px", fontWeight:700, color:pc(t.pnl) }}>{t.pnl>=0?"+":""}{fu(t.pnl)}</td>
                          <td style={{ padding:"10px 12px" }}><Pill color={t.pnl>0?T.green:T.red}>{t.pnl>0?"WIN":"LOSS"}</Pill></td>
                          <td style={{ padding:"10px 12px", color:T.text3, fontSize:11 }}>{t.signalAtEntry}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
            {trades.length === 0 && (
              <Card style={{ textAlign:"center", padding:56 }}>
                <div style={{ fontSize:40, marginBottom:14 }}>📓</div>
                <div style={{ fontSize:17, fontWeight:700, color:T.text2, marginBottom:8 }}>No trades logged yet</div>
                <div style={{ fontSize:13, color:T.text3, maxWidth:420, margin:"0 auto", lineHeight:1.7 }}>Click <strong>Log New Trade</strong> when you enter a position. The journal tracks your P&L, gives live hold/exit recommendations, and records which signal was active when you entered.</div>
              </Card>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════
            NEWS
        ════════════════════════════════════════════════════════════ */}
        {tab === "news" && (
          <div>
            <div style={{ marginBottom:16, padding:"12px 16px", background:`${T.blue}10`, border:`1px solid ${T.blue}30`, borderRadius:10, fontSize:13, color:T.text2, lineHeight:1.7 }}>
              News and events move crypto prices fast. Tap any story to understand why it matters and get AI trade advice.
            </div>
            {[
              { l:"📈 Bullish Catalysts", items:NEWS.filter(n=>n.imp==="BULLISH"), c:T.green  },
              { l:"📉 Bearish Risks",     items:NEWS.filter(n=>n.imp==="BEARISH"), c:T.red    },
              { l:"➡️ Market Info",       items:NEWS.filter(n=>n.imp==="NEUTRAL"), c:T.text3  },
            ].map(sec => (
              <div key={sec.l} style={{ marginBottom:24 }}>
                <div style={{ fontSize:13, fontWeight:700, color:sec.c, letterSpacing:"0.08em", marginBottom:12, paddingBottom:10, borderBottom:`1px solid ${sec.c}25` }}>{sec.l} ({sec.items.length})</div>
                {sec.items.map(item => (
                  <Card key={item.id} style={{ marginBottom:8, cursor:"pointer", background: selNews?.id===item.id ? `${sec.c}08` : T.card, border:`1px solid ${selNews?.id===item.id ? sec.c+"60" : T.border}`, padding:"14px 16px" }} onClick={() => setSelNews(selNews?.id===item.id ? null : item)}>
                    <div style={{ display:"flex", justifyContent:"space-between", gap:12, marginBottom:10 }}>
                      <div style={{ fontSize:13, color:T.text, lineHeight:1.5, flex:1, fontWeight:500 }}>{item.h}</div>
                      <div style={{ flexShrink:0, textAlign:"right" }}>
                        <Pill color={sec.c}>{"●".repeat(item.str)} {item.imp}</Pill>
                        <div style={{ fontSize:10, color:T.text3, marginTop:5 }}>{item.time} ago</div>
                      </div>
                    </div>
                    <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom: selNews?.id===item.id ? 12 : 0 }}>
                      <Pill color={T.blue} size={10}>{item.cat}</Pill>
                      {item.coins.map(s=><Pill key={s} color={sec.c} size={10}>{s}</Pill>)}
                    </div>
                    {selNews?.id===item.id && (
                      <div style={{ paddingTop:12, borderTop:`1px solid ${sec.c}25` }}>
                        <div style={{ fontSize:13, color:T.text2, lineHeight:1.7, marginBottom:12 }}>{item.ex}</div>
                        <button onClick={e=>{e.stopPropagation();const cl=enriched.filter(c=>item.coins.includes(c.symbol?.toUpperCase()));runAI(cl.length?cl:enriched.slice(0,5),`News: "${item.h}" — how should a beginner respond to this?`);}}
                          style={{ padding:"8px 16px", background:`${sec.c}12`, border:`1px solid ${sec.c}60`, borderRadius:8, color:sec.c, cursor:"pointer", fontSize:12, fontFamily:"inherit", fontWeight:700 }}>
                          ⚡ AI — How do I trade this?
                        </button>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════
            PERFORMANCE
        ════════════════════════════════════════════════════════════ */}
        {tab === "performance" && (
          <div>
            <div style={{ fontSize:20, fontWeight:800, letterSpacing:"-0.02em", marginBottom:6 }}>Performance & Lessons Learned</div>
            <div style={{ fontSize:13, color:T.text3, marginBottom:20, lineHeight:1.7, maxWidth:680 }}>
              This tab tracks every signal the tool generates and your trading outcomes. Over time it reveals what's working, what isn't, and how to improve. The more you use it the smarter it gets.
            </div>
            {/* Stats */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:16 }}>
              <StatCard label="Signals Logged"  value={sigLog.length} color={T.purple2} />
              <StatCard label="Buy Signals"     value={sigLog.filter(s=>s.verdict==="STRONG BUY"||s.verdict==="BUY").length} color={T.green} />
              <StatCard label="Sell Signals"    value={sigLog.filter(s=>s.verdict==="TAKE PROFIT").length} color={T.red} />
              <StatCard label="Win Rate"        value={winRate+"%"} color={winRate>=50?T.green:T.red} sub={`${closedTrades.length} closed trades`} />
            </div>
            {/* Lessons */}
            <Card accent={T.purple} style={{ marginBottom:14 }}>
              <Label color={T.purple2}>💡 Auto-Generated Lessons</Label>
              {closedTrades.length < 3 ? (
                <div style={{ fontSize:13, color:T.text3, lineHeight:1.7, padding:"10px 0" }}>Complete at least 3 trades to start generating personalized lessons. Every paper trade counts — the more data the tool has the more specific the insights become.</div>
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  {winRate >= 60 && <div style={{ padding:"12px 16px", background:`${T.green}10`, border:`1px solid ${T.green}35`, borderRadius:10, fontSize:13, color:T.text2, lineHeight:1.7 }}><span style={{ color:T.green, fontWeight:700 }}>✅ What's working: </span>Your {winRate}% win rate is above average. Signal-following discipline is paying off. Keep using the pre-trade checklist before every entry.</div>}
                  {winRate < 50 && <div style={{ padding:"12px 16px", background:`${T.red}10`, border:`1px solid ${T.red}35`, borderRadius:10, fontSize:13, color:T.text2, lineHeight:1.7 }}><span style={{ color:T.red, fontWeight:700 }}>⚠️ Area to improve: </span>Win rate below 50%. Try only trading STRONG BUY signals (score 75+) and entering near support levels rather than chasing breakouts.</div>}
                  {openTrades.length > cfg.maxPos && <div style={{ padding:"12px 16px", background:`${T.gold}10`, border:`1px solid ${T.gold}35`, borderRadius:10, fontSize:13, color:T.text2, lineHeight:1.7 }}><span style={{ color:T.gold, fontWeight:700 }}>⚠️ Too many positions: </span>You have more open trades than your max setting. Too many positions splits focus and increases risk. Close some before opening new ones.</div>}
                  <div style={{ padding:"12px 16px", background:`${T.purple}10`, border:`1px solid ${T.purple}35`, borderRadius:10, fontSize:13, color:T.text2, lineHeight:1.7 }}><span style={{ color:T.purple2, fontWeight:700 }}>📊 S/R tip: </span>Always check that price is near a Support level before entering — not at Resistance. Buying at Support gives you a far better risk/reward ratio.</div>
                  <div style={{ padding:"12px 16px", background:`${T.blue}10`, border:`1px solid ${T.blue}35`, borderRadius:10, fontSize:13, color:T.text2, lineHeight:1.7 }}><span style={{ color:T.blue, fontWeight:700 }}>🧠 Mindset: </span>A 60% win rate with solid risk management beats a 90% win rate with poor risk management. Protect capital first. Growth follows discipline.</div>
                </div>
              )}
            </Card>
            {/* Signal accuracy */}
            {closedTrades.length > 0 && (
              <Card style={{ marginBottom:14 }}>
                <Label>Signal Accuracy — Did the signal predict outcome?</Label>
                {["STRONG BUY","BUY","TAKE PROFIT","MANUAL"].map(sig => {
                  const rel  = closedTrades.filter(t=>t.signalAtEntry===sig);
                  if (!rel.length) return null;
                  const wr2  = Math.round(rel.filter(t=>t.pnl>0).length/rel.length*100);
                  const col  = wr2>=60?T.green:wr2>=40?T.gold:T.red;
                  return (
                    <div key={sig} style={{ display:"flex", alignItems:"center", gap:12, marginBottom:10 }}>
                      <div style={{ width:110, fontSize:12, color:T.text2, fontWeight:500 }}>{sig}</div>
                      <div style={{ flex:1, height:8, background:T.border, borderRadius:4, overflow:"hidden" }}>
                        <div style={{ height:"100%", width:`${wr2}%`, background:col, borderRadius:4 }} />
                      </div>
                      <div style={{ width:100, fontSize:12, color:col, textAlign:"right", fontWeight:700 }}>{wr2}% ({rel.length} trades)</div>
                    </div>
                  );
                })}
              </Card>
            )}
            {/* Signal log */}
            {sigLog.length > 0 && (
              <Card>
                <Label>Recent Signal Log ({sigLog.length} captured)</Label>
                <div style={{ overflowX:"auto" }}>
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                    <thead><tr style={{ borderBottom:`1px solid ${T.border}` }}>
                      {["Time","Coin","Signal","Price","24h"].map(h=><th key={h} style={{ padding:"8px 12px", textAlign:"left", fontSize:10, color:T.text3, fontWeight:600, letterSpacing:"0.08em" }}>{h.toUpperCase()}</th>)}
                    </tr></thead>
                    <tbody>
                      {sigLog.slice(0,20).map((s,i)=>(
                        <tr key={i} style={{ borderBottom:`1px solid ${T.surface}` }}>
                          <td style={{ padding:"9px 12px", color:T.text3, fontSize:11 }}>{s.time}</td>
                          <td style={{ padding:"9px 12px", fontWeight:700 }}>{s.symbol}</td>
                          <td style={{ padding:"9px 12px" }}><Pill color={s.verdict==="STRONG BUY"||s.verdict==="BUY"?T.green:T.red} size={10}>{s.verdict}</Pill></td>
                          <td style={{ padding:"9px 12px" }}>{fu(s.price)}</td>
                          <td style={{ padding:"9px 12px", color:pc(s.p24) }}>{fp(s.p24)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ marginTop:14, padding:"10px 14px", background:`${T.purple}08`, border:`1px solid ${T.purple}30`, borderRadius:8, fontSize:12, color:T.text3, lineHeight:1.7 }}>
                  <span style={{ color:T.purple2, fontWeight:700 }}>How to use this: </span>
                  When a signal fires note the price. Check back 24-48 hours later — did price go in the predicted direction? Over time you will see which signal types are most reliable for your trading style.
                </div>
              </Card>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════
            AI
        ════════════════════════════════════════════════════════════ */}
        {tab === "ai" && (
          <div>
            <div style={{ fontSize:20, fontWeight:800, color:T.purple2, marginBottom:6, letterSpacing:"-0.02em" }}>⚡ BLKROSE AI Intelligence</div>
            <div style={{ fontSize:13, color:T.text3, marginBottom:20 }}>Powered by Claude · Live CoinGecko data + Support/Resistance · Tailored to your ${cfg.acct} account</div>
            {!aiLoad && !aiResult && (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))", gap:10, marginBottom:16 }}>
                {[
                  { l:"🚀 Best Opportunities Right Now",     lst:topBuys.slice(0,10),                                  ctx:"Best buy opportunities right now — include support levels as ideal entry points. Plain English." },
                  { l:"📉 Take Profit Analysis",             lst:topSells.slice(0,8),                                   ctx:"Take profit signals — which should I sell now and at what resistance level?" },
                  { l:"💎 Large Cap Deep Dive",              lst:enriched.filter(c=>c.cat==="largecap"),                ctx:"Analyze large caps — best for a beginner right now? Include S/R entry levels." },
                  { l:"🤖 AI & DePIN Sector",                lst:enriched.filter(c=>c.cat==="ai"),                      ctx:"AI crypto sector — which coins look best and where are the support levels?" },
                  { l:"🐸 Meme Coin Honest Risk Read",       lst:enriched.filter(c=>c.cat==="meme"),                    ctx:"Honest meme coin analysis — risks, opportunities, which have solid S/R setups?" },
                  { l:"📰 Today's News Impact",              lst:enriched.filter(c=>NEWS.some(n=>n.coins.includes(c.symbol?.toUpperCase()))), ctx:"Based on today's news, what should I do? Which coins most affected?" },
                  { l:"⭐ My Watchlist Review",              lst:watchCoins.length?watchCoins:topBuys.slice(0,5),       ctx:"Review my watchlist — full read on each coin with support/resistance levels." },
                  { l:"🌍 Big Picture — Where Is Crypto?",  lst:enriched.filter(c=>c.cat==="largecap"),                ctx:"Big picture — where is crypto headed right now? What should a beginner do?" },
                  { l:"💰 Best Strategy For My Account",    lst:topBuys.slice(0,8),                                    ctx:`I have $${cfg.acct} with ${cfg.risk}% risk per trade. Best strategy using support levels as entries?` },
                  { l:"🛡️ Risk Assessment",                 lst:enriched.slice(0,15),                                  ctx:"Biggest risks right now? Where are dangerous resistance levels to watch?" },
                ].map(a => (
                  <button key={a.l} onClick={() => runAI(a.lst.length?a.lst:enriched.slice(0,8), a.ctx)}
                    style={{ padding:"16px 18px", background:T.card, border:`1px solid ${T.border}`, borderRadius:12, color:T.text2, cursor:"pointer", fontSize:13, fontFamily:"inherit", textAlign:"left", transition:"all 0.15s", lineHeight:1.4 }}>
                    <div style={{ fontWeight:600, marginBottom:5 }}>{a.l}</div>
                    <div style={{ fontSize:11, color:T.text4 }}>{a.lst.length} live coins · with S/R · plain English</div>
                  </button>
                ))}
              </div>
            )}
            {aiLoad && (
              <div style={{ padding:70, textAlign:"center" }}>
                <div style={{ width:52, height:52, background:`linear-gradient(135deg,${T.purple3},${T.purple})`, borderRadius:14, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, margin:"0 auto 16px" }}>⚡</div>
                <div style={{ fontSize:14, color:T.purple2, fontWeight:700, letterSpacing:"0.1em" }}>ANALYZING LIVE DATA...</div>
                <div style={{ fontSize:12, color:T.text3, marginTop:8 }}>Using real prices and support/resistance levels</div>
              </div>
            )}
            {aiResult && !aiLoad && (
              <div>
                <Card accent={T.purple} style={{ marginBottom:16 }}>
                  <div style={{ fontSize:11, color:T.purple2, fontWeight:700, letterSpacing:"0.1em", marginBottom:6 }}>⚡ BLKROSE AI INTELLIGENCE</div>
                  <div style={{ fontSize:11, color:T.text4, marginBottom:16, paddingBottom:12, borderBottom:`1px solid ${T.border}` }}>{aiCtx}</div>
                  <div style={{ fontSize:14, color:T.text2, lineHeight:2.1, whiteSpace:"pre-wrap" }}>{aiResult}</div>
                </Card>
                <button onClick={() => setAiResult("")} style={{ padding:"10px 20px", background:"transparent", border:`1px solid ${T.border}`, borderRadius:10, color:T.text3, cursor:"pointer", fontSize:12, fontFamily:"inherit" }}>← Back to Options</button>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════
            SETTINGS
        ════════════════════════════════════════════════════════════ */}
        {tab === "settings" && (
          <div style={{ maxWidth:700 }}>
            <div style={{ fontSize:20, fontWeight:800, letterSpacing:"-0.02em", marginBottom:6 }}>Settings & Risk Controls</div>
            <div style={{ fontSize:13, color:T.text3, marginBottom:22 }}>Configure your risk rules before your first trade. These protect your capital.</div>
            {[
              { title:"💰 Account & Risk", color:T.purple, fields:[
                ["Account Size (USD)","acct",50,10000,50,`Max risk per trade: $${(cfg.acct*cfg.risk/100).toFixed(2)}`,false],
                ["Risk Per Trade (%)","risk",0.5,5,0.5,`${cfg.risk}% of $${cfg.acct} = $${(cfg.acct*cfg.risk/100).toFixed(2)} per trade. Beginners: keep at 1-2%.`,true],
                ["Max Open Positions","maxPos",1,10,1,"Never exceed this many open trades at once. Beginners: 3-4.",false],
              ]},
              { title:"🛡️ Hard Risk Controls", color:T.red, fields:[
                ["Daily Loss Limit (%)","dllimit",1,10,0.5,`Stop trading if loss hits $${(cfg.acct*cfg.dllimit/100).toFixed(2)}.`,true],
                ["Min Signal Score","minScore",40,90,5,"Only act on signals above this score. Beginners: start at 65+.",false],
              ]},
            ].map(sec => (
              <Card key={sec.title} accent={sec.color} style={{ marginBottom:14 }}>
                <div style={{ fontSize:15, fontWeight:700, color:sec.color==="purple"?T.purple2:sec.color, marginBottom:18 }}>{sec.title}</div>
                {sec.fields.map(([l,k,mn,mx,st,desc,pct]) => (
                  <div key={k} style={{ marginBottom:18 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                      <label style={{ fontSize:13, color:T.text2, fontWeight:500 }}>{l}</label>
                      <span style={{ fontSize:15, fontWeight:700, color:sec.color==="purple"?T.purple2:sec.color }}>{cfg[k]}{pct?"%":""}</span>
                    </div>
                    <input type="range" min={mn} max={mx} step={st} value={cfg[k]}
                      onChange={e => setCfg(p=>({...p,[k]:st<1?parseFloat(e.target.value):parseInt(e.target.value)}))}
                      style={{ width:"100%", accentColor: sec.color==="purple" ? T.purple : sec.color }} />
                    <div style={{ fontSize:11, color:T.text4, marginTop:5 }}>{desc}</div>
                  </div>
                ))}
              </Card>
            ))}
            <Card accent={T.purple}>
              <div style={{ fontSize:15, fontWeight:700, color:T.purple2, marginBottom:16 }}>📄 Trading Mode</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                {[
                  { v:true,  l:"📄 Paper Trading", d:"Fake money, real signals. Learn without risk. Recommended for first 30+ days.", c:T.purple },
                  { v:false, l:"💵 Live Trading",  d:"Real money. Only switch after 30+ paper trades with consistent positive results.", c:T.red },
                ].map(o => (
                  <div key={String(o.v)} onClick={() => setCfg(p=>({...p,paper:o.v}))}
                    style={{ padding:16, background: cfg.paper===o.v ? `${o.c}14` : T.surface, border:`2px solid ${cfg.paper===o.v ? o.c : T.border}`, borderRadius:10, cursor:"pointer", transition:"all 0.2s" }}>
                    <div style={{ fontSize:13, fontWeight:700, color: cfg.paper===o.v ? (o.c===T.purple?T.purple2:o.c) : T.text2, marginBottom:6 }}>{o.l}</div>
                    <div style={{ fontSize:12, color:T.text3, lineHeight:1.5 }}>{o.d}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════
          MODALS
      ══════════════════════════════════════════════════════════════ */}

      {/* Pre-trade checklist */}
      {showCL && clTarget && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.92)", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
          <div style={{ background:T.surface, border:`1px solid ${T.purple}50`, borderRadius:16, padding:28, width:"100%", maxWidth:500 }}>
            <div style={{ fontSize:17, fontWeight:800, color:T.purple2, marginBottom:6 }}>✅ Pre-Trade Checklist — {clTarget.symbol?.toUpperCase()}</div>
            <div style={{ fontSize:13, color:T.text3, marginBottom:18, lineHeight:1.6 }}>Check every box before entering. If any is unchecked, reconsider. This discipline separates consistent traders from gamblers.</div>
            {CHECKLIST.map((item,i) => (
              <div key={i} onClick={() => setChecklist(p=>({...p,[i]:!p[i]}))}
                style={{ display:"flex", gap:12, padding:"11px 14px", background: checklist[i]?`${T.green}10`:T.card, border:`1px solid ${checklist[i]?T.green+"50":T.border}`, borderRadius:10, marginBottom:8, cursor:"pointer", alignItems:"flex-start" }}>
                <div style={{ width:20, height:20, border:`2px solid ${checklist[i]?T.green:T.border2}`, borderRadius:5, background: checklist[i]?T.green:"transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginTop:1 }}>
                  {checklist[i] && <span style={{ color:"#000", fontSize:13, fontWeight:900 }}>✓</span>}
                </div>
                <span style={{ fontSize:13, color: checklist[i]?T.text:T.text2, lineHeight:1.5 }}>{item}</span>
              </div>
            ))}
            {Object.values(checklist).filter(Boolean).length === CHECKLIST.length && (
              <div style={{ padding:14, background:`${T.green}12`, border:`1px solid ${T.green}50`, borderRadius:10, textAlign:"center", fontSize:14, color:T.green, fontWeight:800, marginTop:10, marginBottom:14 }}>✅ ALL CHECKS PASSED — Cleared to trade!</div>
            )}
            <div style={{ display:"flex", gap:10, marginTop:16 }}>
              <button onClick={() => { setShowTF(true); setTf(p=>({...p, coin:clTarget.symbol?.toUpperCase()||"", entry:clTarget.current_price?.toString()||""})); setShowCL(false); }}
                style={{ flex:1, padding:11, background:`linear-gradient(135deg,${T.green}cc,${T.green})`, border:"none", borderRadius:10, color:"white", cursor:"pointer", fontSize:13, fontWeight:700 }}>→ Log This Trade</button>
              <button onClick={() => setShowCL(false)} style={{ padding:"11px 18px", background:"transparent", border:`1px solid ${T.border}`, borderRadius:10, color:T.text3, cursor:"pointer", fontSize:13, fontFamily:"inherit" }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Trade form */}
      {showTF && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.92)", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
          <div style={{ background:T.surface, border:`1px solid ${T.green}50`, borderRadius:16, padding:28, width:"100%", maxWidth:500 }}>
            <div style={{ fontSize:17, fontWeight:800, color:T.green, marginBottom:20 }}>📓 Log New Trade</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
              {[["Coin Ticker","coin","BTC, ETH, SOL..."],["Entry Price ($)","entry","e.g. 94820"]].map(([l,k,ph])=>(
                <div key={k}>
                  <div style={{ fontSize:11, color:T.text3, letterSpacing:"0.08em", marginBottom:6 }}>{l.toUpperCase()}</div>
                  <input value={tf[k]} onChange={e=>setTf(p=>({...p,[k]:e.target.value}))} placeholder={ph}
                    style={{ width:"100%", padding:"10px 14px", background:T.card, border:`1px solid ${T.border}`, borderRadius:8, color:T.text, fontSize:13, fontFamily:"inherit", outline:"none" }} />
                </div>
              ))}
            </div>
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:11, color:T.text3, letterSpacing:"0.08em", marginBottom:6 }}>POSITION SIZE ($) — MAX ${(cfg.acct*cfg.risk/100).toFixed(0)}</div>
              <input value={tf.size} onChange={e=>setTf(p=>({...p,size:e.target.value}))} placeholder="Amount to invest"
                style={{ width:"100%", padding:"10px 14px", background:T.card, border:`1px solid ${T.border}`, borderRadius:8, color:T.text, fontSize:13, fontFamily:"inherit", outline:"none" }} />
            </div>
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:11, color:T.text3, letterSpacing:"0.08em", marginBottom:8 }}>TRADE TYPE</div>
              <div style={{ display:"flex", gap:8 }}>
                {["scalp","swing","position"].map(t=>(
                  <button key={t} onClick={()=>setTf(p=>({...p,type:t}))}
                    style={{ flex:1, padding:"10px", background: tf.type===t?`${T.purple}20`:"transparent", border:`1px solid ${tf.type===t?T.purple:T.border}`, borderRadius:8, color: tf.type===t?T.purple2:T.text3, cursor:"pointer", fontSize:12, fontFamily:"inherit", fontWeight: tf.type===t?700:400 }}>
                    {t.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:11, color:T.text3, letterSpacing:"0.08em", marginBottom:6 }}>NOTES — Why are you taking this trade?</div>
              <textarea value={tf.notes} onChange={e=>setTf(p=>({...p,notes:e.target.value}))} placeholder="Which signal fired? What support level are you entering near?"
                style={{ width:"100%", padding:"10px 14px", background:T.card, border:`1px solid ${T.border}`, borderRadius:8, color:T.text, fontSize:13, fontFamily:"inherit", outline:"none", resize:"vertical", minHeight:72 }} />
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={logTrade} style={{ flex:1, padding:11, background:`linear-gradient(135deg,${T.green}cc,${T.green})`, border:"none", borderRadius:10, color:"white", cursor:"pointer", fontSize:14, fontWeight:700 }}>✓ Log Trade</button>
              <button onClick={()=>setShowTF(false)} style={{ padding:"11px 20px", background:"transparent", border:`1px solid ${T.border}`, borderRadius:10, color:T.text3, cursor:"pointer", fontSize:13, fontFamily:"inherit" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Emotional check-in */}
      {showCI && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.92)", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
          <div style={{ background:T.surface, border:`1px solid ${T.purple}50`, borderRadius:16, padding:28, width:"100%", maxWidth:460 }}>
            <div style={{ fontSize:17, fontWeight:800, color:T.purple2, marginBottom:6 }}>🧠 Pre-Session Check-In</div>
            <div style={{ fontSize:13, color:T.text3, marginBottom:20, lineHeight:1.6 }}>Professional traders check their mental state before every session. Emotional trading is the #1 account killer. Be honest.</div>
            {[
              { id:"sleep", q:"How did you sleep last night?",  opts:["Great (8+ hrs)","OK (6-7 hrs)","Poorly (<6 hrs)"],  scores:[2,1,0] },
              { id:"stress",q:"How stressed are you right now?", opts:["Not stressed","A little","Very stressed"],            scores:[2,1,0] },
              { id:"loss",  q:"Did you lose money yesterday?",  opts:["No / First day","Small loss","Big loss"],            scores:[2,1,0] },
            ].map(q => (
              <div key={q.id} style={{ marginBottom:18 }}>
                <div style={{ fontSize:14, color:T.text, marginBottom:10, fontWeight:500 }}>{q.q}</div>
                <div style={{ display:"flex", gap:8 }}>
                  {q.opts.map((opt,i) => (
                    <button key={i} onClick={() => setCiAns(p=>({...p,[q.id]:i}))}
                      style={{ flex:1, padding:"10px 8px", background: ciAns[q.id]===i?`${T.purple}20`:"transparent", border:`1px solid ${ciAns[q.id]===i?T.purple:T.border}`, borderRadius:8, color: ciAns[q.id]===i?T.purple2:T.text3, cursor:"pointer", fontSize:12, fontFamily:"inherit", lineHeight:1.4 }}>
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <button
              onClick={() => {
                let tot = 0;
                [["sleep",[2,1,0]],["stress",[2,1,0]],["loss",[2,1,0]]].forEach(([k,sc]) => { const v=ciAns[k]; if(v!==undefined) tot+=sc[v]; });
                setCheckinScore(Math.round(tot/6*100));
                setCheckinDone(true);
                setShowCI(false);
              }}
              disabled={Object.keys(ciAns).length < 3}
              style={{ width:"100%", padding:12, background: Object.keys(ciAns).length>=3?`linear-gradient(135deg,${T.purple3},${T.purple})`:`${T.border}`, border:"none", borderRadius:10, color: Object.keys(ciAns).length>=3?"white":T.text4, cursor:"pointer", fontSize:14, fontWeight:700, marginTop:4 }}>
              See My Trading Readiness →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
