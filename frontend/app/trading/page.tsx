"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, ComposedChart, Scatter
} from "recharts";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECURITY LAYER — ADVANCIA PROPRIETARY
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const _SEC = Object.freeze({
  _h: (s: string) => s.split("").reduce((a,c)=>((a<<5)-a+c.charCodeAt(0))|0,0).toString(36),
  _ak: () => "ADV-" + Math.random().toString(36).slice(2,10).toUpperCase(),
  _mask: (s: string) => s ? s.slice(0,4) + "••••••••" + s.slice(-4) : "••••••••••••",
  _audit: [] as any[],
  log: function(action: string, user: string, detail: string) {
    this._audit.unshift({
      id: Date.now(), action, user,
      detail: typeof detail === "string" ? detail : "[REDACTED]",
      ts: new Date().toISOString(), ip: "192.168.x.x"
    });
    if (this._audit.length > 500) this._audit.pop();
  }
});

// ADMIN AUTH
const _AUTH_HASH = _SEC._h("admin") + ":" + _SEC._h("Advancia@2025!");
const _verifyAdmin = (u: string, p: string) => (_SEC._h(u) + ":" + _SEC._h(p)) === _AUTH_HASH;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BRAND SYSTEM
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const B = {
  bg:"#05080F", panel:"#0A1020", panel2:"#0E1628", border:"#172035",
  accent:"#0057FF", accent2:"#003ECC", accentGlow:"rgba(0,87,255,0.18)",
  green:"#00E87A", green2:"rgba(0,232,122,0.12)",
  red:"#FF1F4B", red2:"rgba(255,31,75,0.12)",
  yellow:"#FFD000", yellow2:"rgba(255,208,0,0.1)",
  teal:"#00C2D4", purple:"#7B5CF5", orange:"#FF6820",
  text:"#D8E3F0", muted:"#3E5370", dim:"#1E2E45",
  white:"#F0F6FF",
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MARKET DATA ENGINE — STREAMING SIMULATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const MARKETS = {
  crypto:  { assets:["BTC/USDT","ETH/USDT","SOL/USDT","BNB/USDT","AVAX/USDT","ARB/USDT","MATIC/USDT","LINK/USDT"], vol:0.0035 },
  stocks:  { assets:["AAPL","NVDA","MSFT","AMZN","META","TSLA","GOOGL","JPM"], vol:0.0018 },
  forex:   { assets:["EUR/USD","GBP/USD","USD/JPY","AUD/USD","USD/CAD","CHF/USD","NZD/USD","USD/SGD"], vol:0.0008 },
  options: { assets:["SPY 505C","QQQ 430P","AAPL 195C","NVDA 870C","TSLA 250P","IWM 200C","SPX 5100C","VIX 18P"], vol:0.015 },
} as const;

const BASE_P: Record<string, number> = {
  "BTC/USDT":68850,"ETH/USDT":3920,"SOL/USDT":189,"BNB/USDT":602,"AVAX/USDT":41,
  "ARB/USDT":1.28,"MATIC/USDT":0.91,"LINK/USDT":18.4,
  "AAPL":194,"NVDA":888,"MSFT":418,"AMZN":190,"META":511,"TSLA":252,"GOOGL":178,"JPM":198,
  "EUR/USD":1.0843,"GBP/USD":1.2661,"USD/JPY":149.3,"AUD/USD":0.654,"USD/CAD":1.351,"CHF/USD":0.882,"NZD/USD":0.611,"USD/SGD":1.341,
  "SPY 505C":14.2,"QQQ 430P":9.8,"AAPL 195C":7.1,"NVDA 870C":25.4,"TSLA 250P":17.2,"IWM 200C":8.9,"SPX 5100C":42.1,"VIX 18P":3.2,
};

class CandleEngine {
  price: number;
  vol: number;
  history: any[];

  constructor(basePrice: number, vol=0.003) {
    this.price = basePrice;
    this.vol = vol;
    this.history = [];
    this._generateHistory(150);
  }
  _tick() {
    const mu = (Math.random()-0.489)*this.vol;
    this.price *= (1+mu);
    const o = this.price;
    const c = this.price*(1+(Math.random()-0.5)*this.vol*0.4);
    const h = Math.max(o,c)*(1+Math.random()*this.vol*0.3);
    const l = Math.min(o,c)*(1-Math.random()*this.vol*0.3);
    const v = Math.floor(Math.random()*800000+50000);
    return {o,c,h,l,v};
  }
  _generateHistory(n: number) {
    const now = Date.now();
    for(let i=n;i>=0;i--) {
      const {o,c,h,l,v} = this._tick();
      const t = new Date(now-i*5*60000);
      this.history.push({
        t: t.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}),
        ts: t.getTime(), open:o, close:c, high:h, low:l, vol:v
      });
    }
    this._calcIndicators();
  }
  _calcIndicators() {
    const closes = this.history.map(c=>c.close);
    for(let i=14;i<closes.length;i++) {
      let gains=0,losses=0;
      for(let j=i-13;j<=i;j++){const d=closes[j]-closes[j-1];if(d>0)gains+=d;else losses-=d;}
      const rs=gains/Math.max(losses,0.0001);
      this.history[i].rsi = 100-(100/(1+rs));
    }
    for(let i=0;i<closes.length;i++) {
      if(i>=8){const k=2/(9+1);this.history[i].ema9=this.history[i-1]?.ema9?closes[i]*k+this.history[i-1].ema9*(1-k):closes[i];}
      if(i>=19) this.history[i].sma20=closes.slice(i-19,i+1).reduce((a:number,b:number)=>a+b)/20;
      if(i>=49) this.history[i].sma50=closes.slice(i-49,i+1).reduce((a:number,b:number)=>a+b)/50;
      if(i>=19){const mean=closes.slice(i-19,i+1).reduce((a:number,b:number)=>a+b)/20;const sd=Math.sqrt(closes.slice(i-19,i+1).map((x:number)=>(x-mean)**2).reduce((a:number,b:number)=>a+b)/20);this.history[i].bb_u=mean+2*sd;this.history[i].bb_l=mean-2*sd;this.history[i].bb_m=mean;}
      if(i>=25){const ema12=closes.slice(i-11,i+1).reduce((a:number,b:number)=>a+b)/12;const ema26=closes.slice(i-25,i+1).reduce((a:number,b:number)=>a+b)/26;this.history[i].macd=ema12-ema26;if(i>=33)this.history[i].sig=closes.slice(i-8,i+1).map((_:any,j:number)=>this.history[i-8+j]?.macd||0).filter(Boolean).reduce((a:number,b:number)=>a+b)/9;}
      if(i>0){const tr=Math.max(this.history[i].high-this.history[i].low,Math.abs(this.history[i].high-closes[i-1]),Math.abs(this.history[i].low-closes[i-1]));this.history[i].atr=tr;}
    }
  }
  next() {
    const {o,c,h,l,v} = this._tick();
    const t = new Date();
    const candle = {t:t.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}),ts:t.getTime(),open:o,close:c,high:h,low:l,vol:v};
    this.history.push(candle);
    if(this.history.length>200) this.history.shift();
    this._calcIndicators();
    return [...this.history];
  }
  latest() { return this.history[this.history.length - 1]; }
}

const aiSignal = (candles: any[]) => {
  const c=candles[candles.length-1];const p=c.close;
  if(!c.rsi)return null;
  const s={conf:Math.floor(Math.random()*25+65),dir:"NEUTRAL",reason:"",entry:p,tp:p,sl:p,rr:0,time:new Date().toLocaleTimeString()};
  if(c.rsi<35&&p>c.bb_l){s.dir="LONG";s.reason="RSI Oversold + BB Bounce";s.tp=p*(1+0.015);s.sl=p*(1-0.005);s.rr=3;}
  else if(c.rsi>65&&p<c.bb_u){s.dir="SHORT";s.reason="RSI Overbought + BB Reject";s.tp=p*(1-0.015);s.sl=p*(1+0.005);s.rr=3;}
  else if(c.macd>c.sig&&c.close>c.ema9){s.dir="LONG";s.reason="MACD Cross + Trend Follow";s.tp=p*(1+0.02);s.sl=p*(1-0.01);s.rr=2;s.conf+=10;}
  else if(c.macd<c.sig&&c.close<c.ema9){s.dir="SHORT";s.reason="MACD Breakdown";s.tp=p*(1-0.02);s.sl=p*(1+0.01);s.rr=2;s.conf+=10;}
  if(s.dir==="NEUTRAL")return null;
  return s;
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// UI COMPONENTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function TradingEngine() {
  const [nav, setNav] = useState("dashboard");
  const [assetClass, setAssetClass] = useState<keyof typeof MARKETS>("crypto");
  const [asset, setAsset] = useState("BTC/USDT");
  const [candles, setCandles] = useState<any[]>([]);
  const [signal, setSignal] = useState<any>(null);
  const [scanRes, setScanRes] = useState<any[]>([]);
  const [tickers, setTickers] = useState<Record<string,number>>({});
  
  const [portfolio, setPortfolio] = useState({equity:124500,day:1240,pct:12.4,used:45000,avail:79500});
  const [positions, setPositions] = useState([{id:1,asset:"BTC/USDT",side:"LONG",size:1.5,entry:64200,pnl:2400,pct:3.7},{id:2,asset:"ETH/USDT",side:"SHORT",size:15,entry:3850,pnl:-450,pct:-1.2}]);
  const [orders, setOrders] = useState<any[]>([]);
  const [alerts, setAlerts] = useState([{id:1,msg:"BTC/USDT MACD Bullish Cross detected",time:"2m ago",type:"ai",read:false},{id:2,msg:"Portfolio risk exceeds 25% threshold",time:"15m ago",type:"risk",read:false}]);
  
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminAuth, setAdminAuth] = useState(false);
  const [adminSection, setAdminSection] = useState("deposit");
  
  const [adminCreds, setAdminCreds] = useState({u:"",p:""});
  const [adminLoginErr, setAdminLoginErr] = useState("");
  const [formMsg, setFormMsg] = useState("");

  const [depForm, setDepForm] = useState({user:"",amount:"",currency:"USD",method:"Bank Transfer",note:""});
  const [wdForm, setWdForm] = useState({user:"",amount:"",currency:"USD",method:"Bank Transfer",wallet:"",note:""});
  const [deposits, setDeposits] = useState([{id:1,user:"facility_001",amount:"50000",currency:"USD",method:"Wire",status:"Completed",date:"2025-03-01",txId:"TX-9021"},{id:2,user:"facility_002",amount:"15000",currency:"USDC",method:"Crypto",status:"Processing",date:"2025-03-10",txId:"TX-8841"}]);
  const [withdrawals, setWithdrawals] = useState([{id:1,user:"facility_003",amount:"12000",currency:"USD",method:"ACH",status:"Pending",date:"2025-03-11",txId:"WD-1022"}]);

  const engines = useRef<Record<string,CandleEngine>>({});

  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem("admin_token")) {
      window.location.href = "/login";
    }
  }, []);

  useEffect(() => {
    Object.keys(BASE_P).forEach(a => {
      let cl="crypto";
      for(const [k,v]of Object.entries(MARKETS)) if(v.assets.includes(a)) cl=k;
      engines.current[a] = new CandleEngine(BASE_P[a], MARKETS[cl as keyof typeof MARKETS].vol);
    });
    setCandles(engines.current[asset].history);
    
    const t = setInterval(() => {
      const up: Record<string,number> = {};
      Object.keys(engines.current).forEach(a => {
        engines.current[a].next();
        up[a] = engines.current[a].latest().close;
      });
      setTickers(up);
      if(engines.current[asset]) setCandles([...engines.current[asset].history]);
      
      const sig = aiSignal(engines.current[asset].history);
      if(sig) setSignal(sig);
      
      if(Math.random()<0.1) {
        const ra=Object.keys(BASE_P)[Math.floor(Math.random()*Object.keys(BASE_P).length)];
        const rs=aiSignal(engines.current[ra].history);
        if(rs) {
          setAlerts(p=>[{id:Date.now(),msg:`${ra} ${rs.dir} signal detected`,time:"Just now",type:"ai",read:false},...p].slice(0,50));
          setScanRes(p=>[{...rs,asset:ra,cls:"SYSTEM"},...p].slice(0,10));
        }
      }
    }, 1500);
    return () => clearInterval(t);
  }, [asset]);

  useEffect(() => {
    if(!assetClass) return;
    setAsset(MARKETS[assetClass].assets[0]);
  }, [assetClass]);

  const fmt = (n: number, d=2) => n.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
  const pclr = (n: number) => n>0?B.green:n<0?B.red:B.muted;

  const adminLogin = () => {
    if(_verifyAdmin(adminCreds.u,adminCreds.p)) {
      setAdminAuth(true);setAdminLoginErr("");_SEC.log("admin_login","admin","Success");
    } else {
      setAdminLoginErr("Invalid credentials");_SEC.log("admin_login","unknown","Failed attempt");
    }
  };

  const submitDeposit = () => {
    if(!depForm.user||!depForm.amount) { setFormMsg("Please fill required fields"); return; }
    setDeposits(p=>[{id:Date.now(),user:depForm.user,amount:depForm.amount,currency:depForm.currency,method:depForm.method,status:"Completed",date:new Date().toISOString().split("T")[0],txId:`TX-${Math.floor(Math.random()*10000)}`},...p]);
    setFormMsg("✓ Deposit initiated successfully");
    setTimeout(()=>setFormMsg(""),3000);
    setDepForm({user:"",amount:"",currency:"USD",method:"Bank Transfer",note:""});
  };

  const submitWithdrawal = () => {
    if(!wdForm.user||!wdForm.amount) { setFormMsg("Please fill required fields"); return; }
    setWithdrawals(p=>[{id:Date.now(),user:wdForm.user,amount:wdForm.amount,currency:wdForm.currency,method:wdForm.method,status:"Pending",date:new Date().toISOString().split("T")[0],txId:`WD-${Math.floor(Math.random()*10000)}`},...p]);
    setFormMsg("✓ Withdrawal queued for approval");
    setTimeout(()=>setFormMsg(""),3000);
    setWdForm({user:"",amount:"",currency:"USD",method:"Bank Transfer",wallet:"",note:""});
  };

  const approveWd = (id: number) => setWithdrawals(p=>p.map(w=>w.id===id?{...w,status:"Approved"}:w));
  const rejectWd = (id: number) => setWithdrawals(p=>p.map(w=>w.id===id?{...w,status:"Rejected"}:w));

  const statColor: Record<string, string> = { "Completed":B.green, "Approved":B.green, "Pending":B.orange, "Processing":B.yellow, "Rejected":B.red };

  return (
    <div style={{display:"flex",height:"100vh",background:B.bg,color:B.text,fontFamily:"'Plus Jakarta Sans',sans-serif",overflow:"hidden"}}>
      <style dangerouslySetInnerHTML={{__html:CSS}}/>

      {/* Sidebar */}
      <div style={{width:240,background:B.panel,borderRight:`1px solid ${B.border}`,display:"flex",flexDirection:"column",zIndex:10}}>
        <div style={{padding:"24px 20px",borderBottom:`1px solid ${B.border}`,display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:32,height:32,background:`linear-gradient(135deg,${B.accent},${B.purple})`,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,color:"#fff",fontSize:16}}>A</div>
          <div>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:14,fontWeight:800,letterSpacing:0.5,color:B.white}}>ADVANCIA</div>
            <div style={{fontSize:9,color:B.accent,letterSpacing:1,fontWeight:600,textTransform:"uppercase"}}>AI Trading Engine</div>
          </div>
        </div>

        <div style={{padding:"20px 12px",flex:1,display:"flex",flexDirection:"column",gap:4}}>
          {[
            {id:"dashboard",l:"Dashboard",i:"◱"},
            {id:"chart",l:"AI Terminal",i:"⤤"},
            {id:"scan",l:"Market Scanner",i:"⌖"},
            {id:"positions",l:"Positions",i:"◧"},
            {id:"orders",l:"Order Book",i:"≡"},
            {id:"risk",l:"Risk Manager",i:"◬"},
            {id:"backtest",l:"Backtester",i:"◂"}
          ].map(n=>(
            <div key={n.id} onClick={()=>setNav(n.id)} style={{
              padding:"10px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:12,borderRadius:8,
              background:nav===n.id?B.dim:"transparent",
              color:nav===n.id?B.white:B.muted,
              fontWeight:nav===n.id?600:500,
              transition:"all 0.2s"
            }}>
              <span style={{fontSize:16,color:nav===n.id?B.accent:B.muted}}>{n.i}</span>
              <span style={{fontSize:12}}>{n.l}</span>
            </div>
          ))}

          <div style={{marginTop:"auto",padding:16,background:`${B.accent}11`,borderRadius:8,border:`1px solid ${B.accent}22`}}>
            <div style={{fontSize:10,color:B.accent,fontWeight:700,marginBottom:8,display:"flex",alignItems:"center",gap:6}}><span className="pulse" style={{width:6,height:6,background:B.accent,borderRadius:"50%",display:"block"}}/>SYSTEM ONLINE</div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:B.muted,marginBottom:4}}><span>Latency</span><span style={{color:B.green}}>12ms</span></div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:B.muted}}><span>AI Core</span><span style={{color:B.green}}>Active</span></div>
          </div>

          <button onClick={()=>setAdminOpen(true)} style={{marginTop:12,padding:"10px",background:"transparent",border:`1px solid ${B.border}`,borderRadius:8,color:B.muted,fontSize:11,display:"flex",alignItems:"center",justifyContent:"center",gap:8,cursor:"pointer"}}>
            ⚙ Admin Control
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="main-wrapper" style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <div style={{padding:"16px 24px",borderBottom:`1px solid ${B.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",background:B.bg}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <Link href="/" style={{color:B.muted,textDecoration:"none",fontSize:14,fontWeight:600}}>← Hub</Link>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:700,color:B.white,textTransform:"capitalize"}}>{nav.replace("-"," ")}</div>
          </div>
          <div style={{display:"flex",gap:16,alignItems:"center"}}>
            <div className="hide-on-mobile" style={{display:"flex",alignItems:"center",gap:8,padding:"6px 12px",background:B.panel,border:`1px solid ${B.border}`,borderRadius:20,fontSize:11,color:B.muted}}>
              <span>Equity:</span><span style={{color:B.white,fontWeight:700,fontFamily:"'DM Mono'"}}>${fmt(portfolio.equity)}</span>
            </div>
            <div style={{position:"relative"}}>
              <div style={{cursor:"pointer",color:alerts.some(a=>!a.read)?B.white:B.muted,fontSize:18}}>🔔</div>
              {alerts.some(a=>!a.read)&&<div style={{position:"absolute",top:-2,right:-2,width:8,height:8,background:B.red,borderRadius:"50%"}} className="pulse"/>}
            </div>
            <div style={{width:32,height:32,background:B.dim,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",border:`1px solid ${B.border}`,fontSize:12,color:B.text}}>M</div>
          </div>
        </div>

        <div style={{flex:1,overflow:"auto",padding:24}}>
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BOTS TAB
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function BotsTab({bots,botForm,setBotForm,showBotForm,setShowBotForm,addBot,toggleBot,deleteBot,MARKETS,BOT_STRATEGIES,fmtN,fmtPx,PC,B}: any) {
  const allAssets = Object.values(MARKETS).flatMap((m:any)=>m.assets);
  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div><div className="syne" style={{fontSize:16,fontWeight:700,color:B.white}}>Bot Engine</div><div style={{fontSize:10,color:B.muted}}>Automated AI trading bots with SL/TP/Trailing-Stop execution</div></div>
        <button onClick={()=>setShowBotForm(!showBotForm)} style={{padding:"7px 18px",fontSize:11,background:"transparent",border:`1.5px solid ${B.accent}`,color:B.accent,fontWeight:600,borderRadius:6,cursor:"pointer"}}>+ Create Bot</button>
      </div>

      {showBotForm&&(
        <div className="fade" style={{background:B.panel,border:`1px solid ${B.border}`,borderRadius:10,padding:16}}>
          <div className="syne" style={{fontSize:13,fontWeight:700,color:B.white,marginBottom:14}}>Configure New Bot</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:12}}>
            {[{l:"Bot Name",k:"name",ph:"e.g. Alpha-Scalper"},{l:"Capital (USD)",k:"capital",ph:"e.g. 5000"},{l:"Stop Loss %",k:"sl",ph:"e.g. 2.0"},{l:"Take Profit %",k:"tp",ph:"e.g. 4.0"}].map(f=>(
              <div key={f.k}>
                <div style={{fontSize:9,color:B.muted,marginBottom:4}}>{f.l}</div>
                <input value={(botForm as any)[f.k]} onChange={e=>setBotForm((p:any)=>({...p,[f.k]:e.target.value}))} placeholder={f.ph} style={{width:"100%",padding:"8px 10px",background:B.bg,border:`1px solid ${B.border}`,borderRadius:6,color:B.text,fontSize:11}}/>
              </div>
            ))}
            <div>
              <div style={{fontSize:9,color:B.muted,marginBottom:4}}>Asset</div>
              <select value={botForm.asset} onChange={e=>setBotForm((p:any)=>({...p,asset:e.target.value}))} style={{width:"100%",padding:"8px 10px",background:B.bg,border:`1px solid ${B.border}`,borderRadius:6,color:B.text,fontSize:11}}>
                {allAssets.map(a=><option key={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <div style={{fontSize:9,color:B.muted,marginBottom:4}}>Strategy</div>
              <select value={botForm.strategy} onChange={e=>setBotForm((p:any)=>({...p,strategy:e.target.value}))} style={{width:"100%",padding:"8px 10px",background:B.bg,border:`1px solid ${B.border}`,borderRadius:6,color:B.text,fontSize:11}}>
                {BOT_STRATEGIES.map((s:string)=><option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
            <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontSize:11,color:B.text}}>
              <input type="checkbox" checked={botForm.trailSl} onChange={e=>setBotForm((p:any)=>({...p,trailSl:e.target.checked}))} style={{accentColor:B.accent}}/>
              Enable Trailing Stop Loss
            </label>
            <div style={{fontSize:9,color:B.muted}}>Bot will automatically adjust SL to lock in profits</div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={addBot} style={{padding:"8px 24px",fontSize:11,background:B.accent,border:"none",color:"#fff",fontWeight:700,borderRadius:6,cursor:"pointer"}}>⚙ Launch Bot</button>
            <button onClick={()=>setShowBotForm(false)} style={{padding:"8px 16px",fontSize:11,background:"transparent",border:`1.5px solid ${B.border}`,color:B.muted,fontWeight:500,borderRadius:6,cursor:"pointer"}}>Cancel</button>
          </div>
        </div>
      )}

      {bots.map((bot:any)=>(
        <div key={bot.id} style={{background:B.panel,border:`1px solid ${B.border}`,borderRadius:10,padding:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
            <div style={{display:"flex",gap:10,alignItems:"center"}}>
              <div style={{width:36,height:36,background:bot.status==="RUNNING"?B.green2:B.yellow2,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>⚙</div>
              <div>
                <div className="syne" style={{fontSize:14,fontWeight:700,color:B.white}}>{bot.name}</div>
                <div style={{fontSize:9,color:B.muted}}>{bot.id} · {bot.asset} · {bot.strategy}</div>
              </div>
            </div>
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              <span style={{padding:"2px 8px",borderRadius:12,background:(bot.status==="RUNNING"?B.green:B.yellow)+"18",color:bot.status==="RUNNING"?B.green:B.yellow,fontSize:9,fontWeight:700,letterSpacing:0.5}}>{bot.status}</span>
              {bot.trailSl&&<span style={{padding:"2px 8px",borderRadius:12,background:B.teal+"18",color:B.teal,fontSize:9,fontWeight:700,letterSpacing:0.5}}>TRAIL SL</span>}
              <button onClick={()=>toggleBot(bot.id)} style={{padding:"3px 12px",fontSize:9,background:"transparent",border:`1.5px solid ${bot.status==="RUNNING"?B.yellow:B.green}`,color:bot.status==="RUNNING"?B.yellow:B.green,fontWeight:600,borderRadius:6,cursor:"pointer"}}>{bot.status==="RUNNING"?"⏸ Pause":"▷ Resume"}</button>
              <button onClick={()=>deleteBot(bot.id)} style={{padding:"3px 10px",fontSize:9,background:B.red+"18",border:`1.5px solid ${B.red}33`,color:B.red,fontWeight:600,borderRadius:6,cursor:"pointer"}}>✕</button>
            </div>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:8,marginBottom:12}}>
            {[{l:"Capital",v:`$${fmtN(bot.capital)}`},{l:"Equity",v:`$${fmtN(bot.equity)}`},{l:"P&L",v:`${bot.pnl>=0?"+":""}$${fmtN(bot.pnl)}`,c:PC(bot.pnl)},{l:"Trades",v:bot.trades},{l:"Win Rate",v:bot.trades>0?`${Math.round(bot.wins/bot.trades*100)}%`:"—",c:B.green},{l:"SL/TP",v:`${bot.sl}%/${bot.tp}%`}].map((s,i)=>(
              <div key={i} style={{background:B.bg,borderRadius:6,padding:"8px 10px",textAlign:"center"}}>
                <div style={{fontSize:8,color:B.muted,marginBottom:3,textTransform:"uppercase"}}>{s.l}</div>
                <div className="mono" style={{fontSize:11,fontWeight:700,color:s.c||B.text}}>{s.v}</div>
              </div>
            ))}
          </div>

          {/* Bot position indicator */}
          {bot.currentPosition&&(
            <div style={{padding:"8px 12px",background:`rgba(0,87,255,0.08)`,border:`1px solid ${B.accent}22`,borderRadius:6,marginBottom:10,fontSize:10}}>
              <span style={{color:B.accent,fontWeight:600}}>ACTIVE POSITION </span>
              <span style={{color:bot.currentPosition.dir==="LONG"?B.green:B.red}}>{bot.currentPosition.dir}</span>
              <span style={{color:B.muted}}> @ {fmtPx(bot.currentPosition.entry,bot.asset)} · SL: {fmtPx(bot.currentPosition.sl,bot.asset)} · TP: {fmtPx(bot.currentPosition.tp,bot.asset)}</span>
            </div>
          )}

          {/* Bot log */}
          <div style={{background:B.bg,borderRadius:6,padding:8,maxHeight:72,overflow:"hidden"}}>
            {bot.log.slice(0,4).map((l:string,i:number)=>(
              <div key={i} className="mono" style={{fontSize:8,color:i===0?B.teal:B.muted,marginBottom:2}}>{l}</div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── STAKING TAB ──────────────────────────────────────────────────────────────
function StakingTab({stakes,stakeForm,setStakeForm,addStake,unstake,STAKE_POOLS,fmtN,B,totalEarned}: any) {
  const totalStaked = stakes.reduce((s:number,st:any)=>s+st.amount,0);
  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div><div className="syne" style={{fontSize:16,fontWeight:700,color:B.white}}>Staking Engine</div><div style={{fontSize:10,color:B.muted}}>Earn passive yield on your crypto holdings</div></div>
        <div style={{display:"flex",gap:16,fontSize:11}}>
          <div><span style={{color:B.muted}}>Total Staked </span><span className="mono syne" style={{color:B.purple,fontWeight:700}}>${fmtN(totalStaked)}</span></div>
          <div><span style={{color:B.muted}}>Total Earned </span><span className="mono syne" style={{color:B.green,fontWeight:700}}>+${fmtN(totalEarned,4)}</span></div>
        </div>
      </div>

      <div style={{background:B.panel,border:`1px solid ${B.border}`,borderRadius:10,padding:16}}>
        <div className="syne" style={{fontSize:13,fontWeight:700,color:B.white,marginBottom:12}}>New Stake</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr auto",gap:10,alignItems:"end"}}>
          <div>
            <div style={{fontSize:9,color:B.muted,marginBottom:4}}>Pool</div>
            <select value={stakeForm.pool} onChange={e=>setStakeForm((p:any)=>({...p,pool:e.target.value}))} style={{width:"100%",padding:"8px 10px",background:B.bg,border:`1px solid ${B.border}`,borderRadius:6,color:B.text,fontSize:11}}>
              {STAKE_POOLS.map((p:any)=><option key={p.id} value={p.id}>{p.label} · {p.apy}% APY {p.lock>0?`· ${p.lock}D lock`:""}</option>)}
            </select>
          </div>
          <div>
            <div style={{fontSize:9,color:B.muted,marginBottom:4}}>Amount</div>
            <input type="number" value={stakeForm.amount} onChange={e=>setStakeForm((p:any)=>({...p,amount:e.target.value}))} placeholder={`Min: ${STAKE_POOLS.find((p:any)=>p.id===stakeForm.pool)?.min||0}`} style={{width:"100%",padding:"8px 10px",background:B.bg,border:`1px solid ${B.border}`,borderRadius:6,color:B.text,fontSize:11}}/>
          </div>
          <button onClick={addStake} style={{padding:"8px 20px",fontSize:11,color:"#fff",background:B.purple,border:"none",fontWeight:700,borderRadius:6,cursor:"pointer"}}>◆ Stake</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:8,marginTop:12}}>
          {STAKE_POOLS.map((p:any)=>(
            <div key={p.id} onClick={()=>setStakeForm((s:any)=>({...s,pool:p.id}))} style={{padding:"10px 8px",background:stakeForm.pool===p.id?"rgba(123,92,245,0.12)":B.bg,border:`1px solid ${stakeForm.pool===p.id?B.purple:B.border}`,borderRadius:8,cursor:"pointer",textAlign:"center"}}>
              <div style={{fontSize:13,marginBottom:4}}>{p.asset==="BTC"?"₿":p.asset==="ETH"?"Ξ":p.asset==="SOL"?"◎":p.asset==="USDT"?"₮":"◆"}</div>
              <div style={{fontSize:9,fontWeight:700,color:B.text}}>{p.asset}</div>
              <div style={{fontSize:10,color:B.purple,fontWeight:700}}>{p.apy}%</div>
              <div style={{fontSize:8,color:B.muted}}>{p.lock>0?`${p.lock}D lock`:"Flexible"}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="syne" style={{fontSize:13,fontWeight:700,color:B.white}}>Active Positions</div>
      {stakes.map((s:any)=>{
        const progress=Math.min(100,s.days/Math.max(s.lock,1)*100);
        return (
          <div key={s.id} style={{background:B.panel,border:`1px solid ${B.border}`,borderRadius:10,padding:16}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
              <div style={{display:"flex",gap:10,alignItems:"center"}}>
                <div style={{width:38,height:38,background:"rgba(123,92,245,0.15)",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>
                  {s.asset==="BTC"?"₿":s.asset==="ETH"?"Ξ":s.asset==="SOL"?"◎":s.asset==="USDT"?"₮":"◆"}
                </div>
                <div>
                  <div className="syne" style={{fontSize:13,fontWeight:700,color:B.white}}>{s.label}</div>
                  <div style={{fontSize:9,color:B.muted}}>Started: {s.started} · {s.lock>0?`${s.lock}D lock`:"Flexible"}</div>
                </div>
              </div>
              <div style={{textAlign:"right"}}>
                <div className="syne" style={{fontSize:18,fontWeight:700,color:B.purple}}>+{s.earned.toFixed(6)}</div>
                <div style={{fontSize:9,color:B.muted}}>{s.asset} earned</div>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:12}}>
              {[{l:"Staked",v:`${s.amount} ${s.asset}`},{l:"APY",v:`${s.apy}%`,c:B.purple},{l:"Daily Est.",v:`~${(s.amount*s.apy/100/365).toFixed(4)} ${s.asset}`,c:B.green},{l:"Status",v:s.status,c:B.green}].map((m,i)=>(
                <div key={i} style={{background:B.bg,borderRadius:6,padding:"8px 10px",textAlign:"center"}}>
                  <div style={{fontSize:8,color:B.muted,marginBottom:3}}>{m.l}</div>
                  <div className="mono" style={{fontSize:10,color:m.c||B.text,fontWeight:600}}>{m.v}</div>
                </div>
              ))}
            </div>
            {s.lock>0&&(
              <div style={{marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:9,marginBottom:3}}><span style={{color:B.muted}}>Lock period</span><span className="mono" style={{color:B.text}}>{s.days}/{s.lock} days</span></div>
                <div style={{background:B.dim,borderRadius:3,height:5}}><div style={{width:`${progress}%`,height:"100%",background:B.purple,borderRadius:3}}/></div>
              </div>
            )}
            <button onClick={()=>unstake(s.id)} disabled={s.lock>0} style={{fontSize:10,padding:"6px 16px",background:s.lock>0?"transparent":B.red+"18",border:`1px solid ${s.lock>0?B.border:B.red+"33"}`,color:s.lock>0?B.muted:B.red,fontWeight:600,borderRadius:6,cursor:s.lock>0?"not-allowed":"pointer"}}>
              {s.lock>0?`Locked (${s.lock-s.days}d remaining)`:"Unstake + Rewards"}
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DASH TAB WRAPPER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function DashTab({candles,signal,portfolio,positions,bots,stakes,alerts,setAlerts,streamLog,fmtN,fmtP,fmtPx,PC,B,now,totalPortPnl,totalStakeEarned,totalBotPnl,tickers,asset}: any) {
  return (
    <Dashboard candles={candles} signal={signal} portfolio={portfolio} positions={positions} alerts={alerts} setAlerts={setAlerts} fmt={fmtN} pclr={PC} C={B} scanRes={[]} tickers={tickers}/>
  );
}

function ChartTab({candles,signal,asset,setAsset,assetClass,setAssetClass,MARKETS,fmtN,fmtPx,PC,B,tickers,streamLog}: any) {
  return (
    <ChartAI candles={candles} signal={signal} asset={asset} setAsset={setAsset} assetClass={assetClass} setAssetClass={setAssetClass} ASSETS={MARKETS} fmt={fmtN} C={B} tickers={tickers}/>
  );
}


      {/* ADMIN OVERLAY */}
      {adminOpen && (
        <div style={{position:"fixed",inset:0,background:"rgba(5,8,15,0.85)",backdropFilter:"blur(12px)",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center",animation:"fadeUp 0.2s ease"}}>
          <div style={{width:adminAuth?900:400,background:B.panel,border:`1px solid ${B.border}`,borderRadius:12,boxShadow:`0 20px 40px rgba(0,0,0,0.5), 0 0 0 1px ${B.border}`,overflow:"hidden",display:"flex",flexDirection:"column",transition:"width 0.3s ease",maxHeight:"90vh"}}>
            
            {/* Header */}
            <div style={{padding:"16px 20px",borderBottom:`1px solid ${B.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",background:B.panel2}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:28,height:28,background:B.red,borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:14}}>🛡️</div>
                <div>
                  <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:13,color:B.white}}>Control Center</div>
                  <div style={{fontSize:10,color:B.muted}}>Advancia Pay Ledger · Restricted Access</div>
                </div>
              </div>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                {adminAuth&&<div style={{display:"flex",alignItems:"center",gap:5,padding:"3px 10px",background:"rgba(0,230,118,0.1)",border:`1px solid ${B.green}33`,borderRadius:12,fontSize:10,color:B.green,fontWeight:600}}>● AUTHENTICATED</div>}
                <button onClick={()=>{setAdminOpen(false);setAdminAuth(false);}} style={{background:"transparent",border:"none",color:B.muted,fontSize:18,lineHeight:1,cursor:"pointer"}}>✕</button>
              </div>
            </div>

            {/* Login */}
            {!adminAuth?(
              <div style={{padding:32,display:"flex",flexDirection:"column",gap:16}}>
                <div style={{textAlign:"center",marginBottom:8}}>
                  <div style={{fontSize:28,marginBottom:8}}>🛡️</div>
                  <div style={{fontSize:14,color:B.text,fontWeight:600,marginBottom:4}}>Administrator Authentication</div>
                  <div style={{fontSize:11,color:B.muted}}>This section is restricted to authorized Advancia administrators only</div>
                </div>
                {[
                  {l:"Username", val:adminCreds.u, fn:(v:string)=>setAdminCreds(p=>({...p,u:v})), type:"text"},
                  {l:"Password", val:adminCreds.p, fn:(v:string)=>setAdminCreds(p=>({...p,p:v})), type:"password"}
                ].map((fld)=>(
                  <div key={fld.l}>
                    <div style={{fontSize:11,color:B.muted,marginBottom:6,letterSpacing:0.5}}>{fld.l}</div>
                    <input type={fld.type} value={fld.val} onChange={e=>fld.fn(e.target.value)} onKeyDown={e=>e.key==="Enter"&&adminLogin()} placeholder={`Enter ${fld.l.toLowerCase()}`} style={{width:"100%",padding:"10px 14px",background:B.bg,border:`1px solid ${B.border}`,borderRadius:6,color:B.text,fontSize:12}}/>
                  </div>
                ))}
                {adminLoginErr&&<div style={{fontSize:11,color:B.red,background:"rgba(255,31,75,0.08)",border:`1px solid ${B.red}22`,borderRadius:6,padding:"8px 12px"}}>⚠ {adminLoginErr}</div>}
                <button onClick={adminLogin} style={{padding:"11px 0",background:`linear-gradient(135deg,${B.accent},${B.purple})`,border:"none",borderRadius:8,color:"#fff",fontWeight:700,fontSize:13,letterSpacing:0.5,cursor:"pointer"}}>
                  Authenticate & Enter
                </button>
                <div style={{textAlign:"center",fontSize:10,color:B.muted}}>Unauthorized access attempts are logged and reported</div>
              </div>
            ):(
              <div style={{display:"flex",flex:1,overflow:"hidden"}}>
                {/* Admin sidebar */}
                <div style={{width:200,borderRight:`1px solid ${B.border}`,padding:"12px 0",flexShrink:0}}>
                  {[
                    {id:"deposit",icon:"↓",label:"Deposit Funds"},
                    {id:"withdrawal",icon:"↑",label:"Withdrawals"},
                    {id:"transactions",icon:"≡",label:"All Transactions"},
                    {id:"users",icon:"◉",label:"User Accounts"},
                    {id:"settings",icon:"⚙",label:"System Settings"},
                  ].map(s=>(
                    <div key={s.id} onClick={()=>setAdminSection(s.id)} style={{
                      padding:"10px 16px",cursor:"pointer",display:"flex",alignItems:"center",gap:8,fontSize:12,
                      background:adminSection===s.id?`rgba(0,87,255,0.1)`:"transparent",
                      borderLeft:adminSection===s.id?`2px solid ${B.accent}`:"2px solid transparent",
                      color:adminSection===s.id?B.accent:B.muted,fontWeight:adminSection===s.id?600:400
                    }}>
                      <span style={{width:18,textAlign:"center"}}>{s.icon}</span>{s.label}
                    </div>
                  ))}
                  <div style={{margin:"16px",padding:12,background:"rgba(255,208,0,0.05)",border:`1px solid ${B.yellow}22`,borderRadius:8}}>
                    <div style={{fontSize:9,color:B.yellow,fontWeight:700,letterSpacing:1,marginBottom:6}}>ADMIN SESSION</div>
                    <div style={{fontSize:10,color:B.muted}}>Logged in as:<br/><span style={{color:B.text}}>admin</span></div>
                    <button onClick={()=>{setAdminAuth(false);setAdminCreds({u:"",p:""});}} style={{marginTop:10,width:"100%",padding:"5px 0",fontSize:10,border:`1px solid ${B.red}44`,borderRadius:4,background:"rgba(255,31,75,0.05)",color:B.red,cursor:"pointer"}}>Sign Out</button>
                  </div>
                </div>

                {/* Admin content */}
                <div style={{flex:1,padding:20,overflow:"auto"}}>
                  {formMsg&&<div style={{marginBottom:12,padding:"8px 14px",background:formMsg.startsWith("✓")?"rgba(0,232,122,0.1)":"rgba(255,31,75,0.1)",border:`1px solid ${formMsg.startsWith("✓")?B.green:B.red}33`,borderRadius:6,fontSize:11,color:formMsg.startsWith("✓")?B.green:B.red}}>{formMsg}</div>}

                  {/* DEPOSIT */}
                  {adminSection==="deposit"&&(
                    <div className="fade">
                      <div style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:700,color:B.white,marginBottom:4}}>Deposit Funds</div>
                      <div style={{fontSize:11,color:B.muted,marginBottom:16}}>Credit funds to a facility or user account</div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
                        {[
                          {l:"Facility / User ID *",f:"user",ph:"e.g. facility_001"},
                          {l:"Amount *",f:"amount",ph:"e.g. 10000"},
                          {l:"Currency",f:"currency",type:"select",opts:["USD","ETH","BTC","USDT","SOL","MATIC"]},
                          {l:"Method",f:"method",type:"select",opts:["Bank Transfer","Crypto","Wire","ACH","SWIFT"]},
                        ].map(fld=>(
                          <div key={fld.f}>
                            <div style={{fontSize:11,color:B.muted,marginBottom:5}}>{fld.l}</div>
                            {fld.type==="select"
                              ?<select value={depForm[fld.f as keyof typeof depForm]} onChange={e=>setDepForm(p=>({...p,[fld.f]:e.target.value}))} style={{width:"100%",padding:"8px 12px",background:B.bg,border:`1px solid ${B.border}`,borderRadius:6,color:B.text,fontSize:12}}>
                                {fld.opts?.map(o=><option key={o}>{o}</option>)}
                              </select>
                              :<input value={depForm[fld.f as keyof typeof depForm]} onChange={e=>setDepForm(p=>({...p,[fld.f]:e.target.value}))} placeholder={fld.ph} style={{width:"100%",padding:"8px 12px",background:B.bg,border:`1px solid ${B.border}`,borderRadius:6,color:B.text,fontSize:12}}/>
                            }
                          </div>
                        ))}
                      </div>
                      <div style={{marginBottom:12}}>
                        <div style={{fontSize:11,color:B.muted,marginBottom:5}}>Internal Note (optional)</div>
                        <input value={depForm.note} onChange={e=>setDepForm(p=>({...p,note:e.target.value}))} placeholder="Add a note..." style={{width:"100%",padding:"8px 12px",background:B.bg,border:`1px solid ${B.border}`,borderRadius:6,color:B.text,fontSize:12}}/>
                      </div>
                      <button onClick={submitDeposit} style={{padding:"10px 24px",background:`linear-gradient(135deg,${B.green},#00B248)`,border:"none",borderRadius:8,color:"#000",fontWeight:700,fontSize:12,letterSpacing:0.5,cursor:"pointer"}}>↓ Initiate Deposit</button>

                      {/* Recent deposits */}
                      <div style={{marginTop:20,fontWeight:600,fontSize:13,color:B.text,marginBottom:10}}>Recent Deposits</div>
                      {deposits.map(d=>(
                        <div key={d.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:B.bg,borderRadius:8,marginBottom:6,border:`1px solid ${B.border}`}}>
                          <div style={{width:32,height:32,background:"rgba(0,232,122,0.1)",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:B.green,flexShrink:0}}>↓</div>
                          <div style={{flex:1}}>
                            <div style={{fontSize:12,color:B.text,fontWeight:500}}>{d.user} · {d.amount} {d.currency}</div>
                            <div style={{fontSize:10,color:B.muted}}>{d.method} · {d.date} · {d.txId}</div>
                          </div>
                          <div style={{padding:"2px 10px",borderRadius:12,background:`${statColor[d.status]||B.muted}15`,color:statColor[d.status]||B.muted,fontSize:10,fontWeight:600}}>{d.status}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* WITHDRAWAL */}
                  {adminSection==="withdrawal"&&(
                    <div className="fade">
                      <div style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:700,color:B.white,marginBottom:4}}>Withdrawal Management</div>
                      <div style={{fontSize:11,color:B.muted,marginBottom:16}}>Process and approve withdrawal requests</div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
                        {[
                          {l:"Facility / User ID *",f:"user",ph:"e.g. facility_001"},
                          {l:"Amount *",f:"amount",ph:"e.g. 5000"},
                          {l:"Currency",f:"currency",type:"select",opts:["USD","ETH","BTC","USDT","SOL","MATIC"]},
                          {l:"Method",f:"method",type:"select",opts:["Bank Transfer","Crypto","Wire","ACH","SWIFT"]},
                          {l:"Destination Wallet / Bank",f:"wallet",ph:"Wallet address or bank account"},
                        ].map(fld=>(
                          <div key={fld.f} style={fld.f==="wallet"?{gridColumn:"1/3"}:{}}>
                            <div style={{fontSize:11,color:B.muted,marginBottom:5}}>{fld.l}</div>
                            {fld.type==="select"
                              ?<select value={wdForm[fld.f as keyof typeof wdForm]} onChange={e=>setWdForm(p=>({...p,[fld.f]:e.target.value}))} style={{width:"100%",padding:"8px 12px",background:B.bg,border:`1px solid ${B.border}`,borderRadius:6,color:B.text,fontSize:12}}>
                                {fld.opts?.map(o=><option key={o}>{o}</option>)}
                              </select>
                              :<input value={wdForm[fld.f as keyof typeof wdForm]} onChange={e=>setWdForm(p=>({...p,[fld.f]:e.target.value}))} placeholder={fld.ph} style={{width:"100%",padding:"8px 12px",background:B.bg,border:`1px solid ${B.border}`,borderRadius:6,color:B.text,fontSize:12}}/>
                            }
                          </div>
                        ))}
                      </div>
                      <div style={{marginBottom:12}}>
                        <div style={{fontSize:11,color:B.muted,marginBottom:5}}>Internal Note</div>
                        <input value={wdForm.note} onChange={e=>setWdForm(p=>({...p,note:e.target.value}))} placeholder="Add a note..." style={{width:"100%",padding:"8px 12px",background:B.bg,border:`1px solid ${B.border}`,borderRadius:6,color:B.text,fontSize:12}}/>
                      </div>
                      <button onClick={submitWithdrawal} style={{padding:"10px 24px",background:`linear-gradient(135deg,${B.orange},${B.red})`,border:"none",borderRadius:8,color:"#fff",fontWeight:700,fontSize:12,letterSpacing:0.5,cursor:"pointer"}}>↑ Queue Withdrawal</button>

                      {/* Pending approvals */}
                      <div style={{marginTop:20,fontWeight:600,fontSize:13,color:B.text,marginBottom:10}}>Pending Approvals</div>
                      {withdrawals.map(w=>(
                        <div key={w.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:B.bg,borderRadius:8,marginBottom:6,border:`1px solid ${w.status==="Pending"?`${B.yellow}33`:B.border}`}}>
                          <div style={{width:32,height:32,background:"rgba(255,104,32,0.1)",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:B.orange,flexShrink:0}}>↑</div>
                          <div style={{flex:1}}>
                            <div style={{fontSize:12,color:B.text,fontWeight:500}}>{w.user} · {w.amount} {w.currency}</div>
                            <div style={{fontSize:10,color:B.muted}}>{w.method} · {w.date} · {w.txId}</div>
                          </div>
                          <div style={{padding:"2px 10px",borderRadius:12,background:`${statColor[w.status]||B.muted}15`,color:statColor[w.status]||B.muted,fontSize:10,fontWeight:600,marginRight:6}}>{w.status}</div>
                          {w.status==="Pending"&&<>
                            <button onClick={()=>approveWd(w.id)} style={{padding:"4px 10px",fontSize:10,border:`1px solid ${B.green}44`,borderRadius:5,background:"rgba(0,232,122,0.08)",color:B.green,cursor:"pointer",fontWeight:600}}>✓ Approve</button>
                            <button onClick={()=>rejectWd(w.id)} style={{padding:"4px 10px",fontSize:10,border:`1px solid ${B.red}44`,borderRadius:5,background:"rgba(255,31,75,0.08)",color:B.red,cursor:"pointer",fontWeight:600}}>✕ Reject</button>
                          </>}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* TRANSACTIONS */}
                  {adminSection==="transactions"&&(
                    <div className="fade">
                      <div style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:700,color:B.white,marginBottom:16}}>All Transactions</div>
                      {[...deposits.map(d=>({...d,type:"Deposit"})),...withdrawals.map(w=>({...w,type:"Withdrawal"}))].sort((a,b)=>b.id-a.id).map((tx,i)=>(
                        <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:B.bg,borderRadius:8,marginBottom:6,border:`1px solid ${B.border}`}}>
                          <div style={{width:32,height:32,background:tx.type==="Deposit"?"rgba(0,232,122,0.1)":"rgba(255,104,32,0.1)",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:tx.type==="Deposit"?B.green:B.orange,flexShrink:0}}>
                            {tx.type==="Deposit"?"↓":"↑"}
                          </div>
                          <div style={{flex:1}}>
                            <div style={{fontSize:12,color:B.text,fontWeight:500}}>{tx.user} · {tx.amount} {tx.currency}</div>
                            <div style={{fontSize:10,color:B.muted}}>{tx.type} · {tx.method} · {tx.date} · {tx.txId}</div>
                          </div>
                          <div style={{padding:"2px 10px",borderRadius:12,background:`${statColor[tx.status]||B.muted}15`,color:statColor[tx.status]||B.muted,fontSize:10,fontWeight:600}}>{tx.status}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* USERS */}
                  {adminSection==="users"&&(
                    <div className="fade">
                      <div style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:700,color:B.white,marginBottom:16}}>User Accounts</div>
                      {["facility_001","facility_002","facility_003","facility_005","facility_007"].map((u)=>(
                        <div key={u} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:B.bg,borderRadius:8,marginBottom:6,border:`1px solid ${B.border}`}}>
                          <div style={{width:36,height:36,background:`linear-gradient(135deg,${B.accent},${B.purple})`,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,color:"#fff",fontWeight:700,flexShrink:0}}>{u[0].toUpperCase()}</div>
                          <div style={{flex:1}}>
                            <div style={{fontSize:13,color:B.text,fontWeight:600}}>{u}</div>
                            <div style={{fontSize:10,color:B.muted}}>Healthcare Facility · Active · Joined 2024</div>
                          </div>
                          <div style={{fontSize:12,color:B.text,textAlign:"right"}}>
                            <div style={{color:B.green,fontWeight:600}}>${(Math.random()*50000+5000).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g,",")}</div>
                            <div style={{fontSize:10,color:B.muted}}>Balance</div>
                          </div>
                          <div style={{padding:"3px 10px",borderRadius:12,background:"rgba(0,232,122,0.1)",color:B.green,fontSize:10,fontWeight:600}}>Active</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* SETTINGS */}
                  {adminSection==="settings"&&(
                    <div className="fade">
                      <div style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:700,color:B.white,marginBottom:16}}>System Settings</div>
                      {[["Trading Engine","Enabled — 25 AI Agents Active",B.green],["Blockchain Networks","SOL, ETH, MATIC, Base — All Online",B.green],["Payment Processing","Stripe + Crypto — Active",B.green],["HIPAA Compliance","Certified — Last audit: Feb 2025",B.accent],["PCI-DSS","Level 1 Compliant",B.accent],["Auto-Withdrawal Limit","$50,000 per transaction",B.yellow],["AI Fraud Detection","Active — 99.2% accuracy",B.green]].map(([k,v,cl])=>(
                        <div key={k} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 14px",background:B.bg,borderRadius:8,marginBottom:6,border:`1px solid ${B.border}`}}>
                          <span style={{fontSize:12,color:B.muted}}>{k}</span>
                          <span style={{fontSize:12,color:cl,fontWeight:600}}>{v}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({candles,signal,portfolio,positions,alerts,setAlerts,fmt,pclr,C,scanRes,tickers}: any) {
  const eq=candles.slice(-30).map((c:any,i:number)=>({t:c.t,v:24000+i*120+(Math.random()-0.3)*300}));
  return (
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
      {[{l:"Total Equity",v:`$${fmt(portfolio.equity)}`,s:`+${fmt(portfolio.pct)}% overall`,cl:C.accent},
        {l:"Day P&L",v:`${portfolio.day>=0?"+":""}$${fmt(portfolio.day)}`,s:"Today's net performance",cl:pclr(portfolio.day)},
        {l:"Open Positions",v:positions.length,s:`$${fmt(positions.reduce((s:number,p:any)=>s+p.pnl,0))} unrealized`,cl:C.yellow}
      ].map((k,i)=>(
        <div key={i} style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:10,padding:16}}>
          <div style={{fontSize:10,color:C.muted,letterSpacing:0.5,marginBottom:8,textTransform:"uppercase"}}>{k.l}</div>
          <div style={{fontFamily:"'Syne',sans-serif",fontSize:26,fontWeight:700,color:k.cl,marginBottom:4}}>{k.v}</div>
          <div style={{fontSize:10,color:C.muted}}>{k.s}</div>
        </div>
      ))}
      <div style={{gridColumn:"1/3",background:C.panel,border:`1px solid ${C.border}`,borderRadius:10,padding:16}}>
        <div style={{fontSize:10,color:C.muted,letterSpacing:0.5,marginBottom:10,textTransform:"uppercase"}}>Equity Curve</div>
        <ResponsiveContainer width="100%" height={130}>
          <AreaChart data={eq}>
            <defs><linearGradient id="eq" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.accent} stopOpacity={0.3}/><stop offset="100%" stopColor={C.accent} stopOpacity={0}/></linearGradient></defs>
            <XAxis dataKey="t" hide/><YAxis hide domain={["auto","auto"]}/>
            <Tooltip contentStyle={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:6,fontSize:10}} formatter={(v:number)=>`$${v.toLocaleString()}`}/>
            <Area type="monotone" dataKey="v" stroke={C.accent} fill="url(#eq)" strokeWidth={2} dot={false}/>
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {signal&&(
        <div style={{background:C.panel,border:`1px solid ${signal.dir==="LONG"?C.green:signal.dir==="SHORT"?C.red:C.border}33`,borderRadius:10,padding:16}}>
          <div style={{fontSize:10,color:C.muted,letterSpacing:0.5,marginBottom:10,textTransform:"uppercase"}}>AI Signal</div>
          <div style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:700,color:signal.dir==="LONG"?C.green:signal.dir==="SHORT"?C.red:C.muted,marginBottom:6}}>{signal.dir}</div>
          <div style={{marginBottom:8}}>
            <div style={{background:C.border,borderRadius:3,height:5}}>
              <div style={{width:`${signal.conf}%`,height:"100%",background:signal.dir==="LONG"?C.green:signal.dir==="SHORT"?C.red:C.muted,borderRadius:3}}/>
            </div>
            <div style={{fontSize:10,color:C.muted,marginTop:4}}>{signal.conf}% confidence · {signal.reason}</div>
          </div>
          {[["TP",signal.tp,C.green],["SL",signal.sl,C.red],["R:R",`1:${signal.rr}`,C.accent]].map(([l,v,cl])=>(
            <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:11,padding:"4px 0",borderBottom:`1px solid ${C.border}22`}}>
              <span style={{color:C.muted}}>{l}</span><span style={{color:cl,fontFamily:"'DM Mono'"}}>{typeof v==="number"?fmt(v,2):v}</span>
            </div>
          ))}
        </div>
      )}
      <div style={{gridColumn:"1/3",background:C.panel,border:`1px solid ${C.border}`,borderRadius:10,padding:16}}>
        <div style={{fontSize:10,color:C.muted,letterSpacing:0.5,marginBottom:10,textTransform:"uppercase"}}>Open Positions</div>
        {positions.map((p:any)=>(
          <div key={p.id} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0",borderBottom:`1px solid ${C.border}22`,fontSize:11}}>
            <span style={{color:p.side==="LONG"?C.green:C.red,width:38,fontWeight:600}}>{p.side}</span>
            <span style={{flex:1,color:C.text}}>{p.asset}</span>
            <span style={{color:C.muted,marginRight:4}}>×{p.size}</span>
            <span style={{color:pclr(p.pnl),fontWeight:600}}>{p.pnl>=0?"+":""}{fmt(p.pnl)} ({fmt(p.pct)}%)</span>
          </div>
        ))}
      </div>
      <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:10,padding:16}}>
        <div style={{fontSize:10,color:C.muted,letterSpacing:0.5,marginBottom:10,textTransform:"uppercase"}}>Alerts</div>
        {alerts.slice(0,4).map((a:any)=>(
          <div key={a.id} onClick={()=>setAlerts((p:any)=>p.map((x:any)=>x.id===a.id?{...x,read:true}:x))} style={{padding:"5px 0",borderBottom:`1px solid ${C.border}22`,cursor:"pointer",opacity:a.read?0.45:1}}>
            <div style={{display:"flex",gap:6}}>
              <span style={{fontSize:8,marginTop:3,color:a.type==="ai"?C.accent:a.type==="risk"?C.yellow:C.muted}}>●</span>
              <div><div style={{fontSize:10,color:C.text,lineHeight:1.4}}>{a.msg}</div><div style={{fontSize:9,color:C.muted,marginTop:2}}>{a.time}</div></div>
            </div>
          </div>
        ))}
      </div>
      <div style={{gridColumn:"2/4",background:C.panel,border:`1px solid ${C.border}`,borderRadius:10,padding:16}}>
        <div style={{fontSize:10,color:C.muted,letterSpacing:0.5,marginBottom:10,textTransform:"uppercase"}}>AI Scanner Preview</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {scanRes.slice(0,4).map((r:any,i:number)=>(
            <div key={i} style={{padding:10,background:C.bg,borderRadius:8,border:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div><div style={{fontSize:11,color:C.text,marginBottom:2,fontWeight:500}}>{r.asset}</div><div style={{fontSize:9,color:C.muted}}>{r.reason}</div></div>
              <div style={{textAlign:"right"}}><div style={{fontSize:12,fontWeight:700,color:r.dir==="LONG"?C.green:r.dir==="SHORT"?C.red:C.muted}}>{r.dir}</div><div style={{fontSize:9,color:C.muted}}>{r.conf}%</div></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── CHART AI ─────────────────────────────────────────────────────────────────
function ChartAI({candles,signal,asset,setAsset,assetClass,setAssetClass,ASSETS,fmt,C,tickers}: any) {
  const [ind, setInd]=useState("RSI");
  const price=tickers[asset]||0;
  return (
    <div style={{display:"grid",gridTemplateColumns:"1fr 270px",gap:12,height:"calc(100vh - 110px)"}}>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
          {Object.keys(ASSETS).map((cl)=>(
            <button key={cl} onClick={()=>setAssetClass(cl)} style={{padding:"3px 12px",fontSize:10,letterSpacing:0.5,border:`1px solid ${assetClass===cl?C.accent:C.border}`,borderRadius:5,background:assetClass===cl?`rgba(0,87,255,0.1)`:"transparent",color:assetClass===cl?C.accent:C.muted,textTransform:"capitalize",cursor:"pointer"}}>{cl}</button>
          ))}
          <div style={{flex:1}}/>
          {ASSETS[assetClass].assets.map((a:string)=>(
            <button key={a} onClick={()=>setAsset(a)} style={{padding:"3px 10px",fontSize:10,border:`1px solid ${asset===a?C.accent:C.border}`,borderRadius:5,background:asset===a?"rgba(0,87,255,0.1)":"transparent",color:asset===a?C.accent:C.muted,cursor:"pointer"}}>{a}</button>
          ))}
        </div>
        <div style={{display:"flex",alignItems:"baseline",gap:10}}>
          <span style={{fontFamily:"'Syne',sans-serif",fontSize:30,fontWeight:700,color:C.white}}>{price<10?price.toFixed(5):price<1000?price.toFixed(3):fmt(price,0)}</span>
          <span style={{fontSize:11,color:C.muted}}>{asset}</span>
        </div>
        <div style={{flex:1,background:C.panel,border:`1px solid ${C.border}`,borderRadius:10,padding:12,minHeight:260}}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={candles}>
              <defs><linearGradient id="ca" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.accent} stopOpacity={0.2}/><stop offset="100%" stopColor={C.accent} stopOpacity={0}/></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke={`${C.border}66`}/>
              <XAxis dataKey="t" tick={{fill:C.muted,fontSize:9}} tickLine={false}/>
              <YAxis tick={{fill:C.muted,fontSize:9}} tickLine={false} axisLine={false} width={65} domain={["auto","auto"]} tickFormatter={v=>v<10?v.toFixed(4):v<1000?v.toFixed(2):v.toFixed(0)}/>
              <Tooltip contentStyle={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:6,fontSize:10}} labelStyle={{color:C.muted}}/>
              <Area type="monotone" dataKey="close" stroke={C.accent} fill="url(#ca)" strokeWidth={2} dot={false}/>
              <Line type="monotone" dataKey="sma20" stroke={`${C.yellow}66`} strokeWidth={1} dot={false} strokeDasharray="5 2"/>
              <Line type="monotone" dataKey="ema9" stroke={`${C.teal}66`} strokeWidth={1} dot={false}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:10,padding:12,height:110}}>
          <div style={{display:"flex",gap:6,marginBottom:8}}>
            {["RSI","MACD","Volume"].map(i=>(
              <button key={i} onClick={()=>setInd(i)} style={{fontSize:9,letterSpacing:0.5,padding:"2px 10px",border:`1px solid ${ind===i?C.accent:C.border}`,borderRadius:4,background:"transparent",color:ind===i?C.accent:C.muted,cursor:"pointer"}}>{i}</button>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={65}>
            {ind==="Volume"
              ?<BarChart data={candles.slice(-40)}><Bar dataKey="vol" fill={`${C.accent}44`}/><XAxis hide/><YAxis hide/></BarChart>
              :<LineChart data={candles.slice(-40)}>
                {ind==="RSI"&&<ReferenceLine y={70} stroke={`${C.red}55`} strokeDasharray="3 3"/>}
                {ind==="RSI"&&<ReferenceLine y={30} stroke={`${C.green}55`} strokeDasharray="3 3"/>}
                <Line type="monotone" dataKey={ind==="RSI"?"rsi":"macd"} stroke={C.accent} strokeWidth={1.5} dot={false}/>
                {ind==="MACD"&&<Line type="monotone" dataKey="sig" stroke={C.purple} strokeWidth={1} dot={false}/>}
                <XAxis hide/><YAxis hide/>
              </LineChart>
            }
          </ResponsiveContainer>
        </div>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {signal&&(
          <div style={{background:C.panel,border:`1px solid ${signal.dir==="LONG"?C.green:signal.dir==="SHORT"?C.red:C.border}33`,borderRadius:10,padding:16}}>
            <div style={{fontSize:10,color:C.muted,letterSpacing:0.5,marginBottom:10,textTransform:"uppercase"}}>AI Signal Analysis</div>
            <div style={{textAlign:"center",marginBottom:14}}>
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:24,fontWeight:700,color:signal.dir==="LONG"?C.green:signal.dir==="SHORT"?C.red:C.muted}}>{signal.dir}</div>
              <div style={{fontSize:10,color:C.muted,marginTop:4}}>{signal.reason}</div>
            </div>
            <div style={{marginBottom:12}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:10,marginBottom:4}}><span style={{color:C.muted}}>Confidence</span><span style={{color:C.text,fontWeight:600}}>{signal.conf}%</span></div>
              <div style={{background:C.border,borderRadius:3,height:5}}><div style={{width:`${signal.conf}%`,height:"100%",background:signal.dir==="LONG"?C.green:signal.dir==="SHORT"?C.red:C.muted,borderRadius:3}}/></div>
            </div>
            {[["ENTRY",signal.entry,C.text],["TAKE PROFIT",signal.tp,C.green],["STOP LOSS",signal.sl,C.red],["RISK:REWARD",`1:${signal.rr}`,C.accent]].map(([l,v,cl])=>(
              <div key={l as string} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${C.border}22`,fontSize:11}}>
                <span style={{color:C.muted,fontSize:9,letterSpacing:0.5}}>{l as string}</span>
                <span style={{color:cl as string,fontFamily:"'DM Mono'",fontWeight:500}}>{typeof v==="number"?fmt(v,2):v}</span>
              </div>
            ))}
          </div>
        )}
        <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:10,padding:16,flex:1}}>
          <div style={{fontSize:10,color:C.muted,letterSpacing:0.5,marginBottom:12,textTransform:"uppercase"}}>Key Levels</div>
          {[["R3",price*1.04,C.red],["R2",price*1.025,C.orange],["R1",price*1.012,C.yellow],["PIVOT",price,C.muted],["S1",price*0.989,C.teal],["S2",price*0.977,C.green+"aa"],["S3",price*0.963,C.green]].map(lv=>(
            <div key={lv[0] as string} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:`1px solid ${C.border}22`,fontSize:10}}>
              <span style={{color:lv[2] as string,width:40}}>{lv[0] as string}</span>
              <span style={{color:C.text,fontFamily:"'DM Mono'"}}>{(lv[1] as number)<10?(lv[1] as number).toFixed(5):(lv[1] as number)<1000?(lv[1] as number).toFixed(3):fmt(lv[1] as number,0)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── SCANNER ──────────────────────────────────────────────────────────────────
function Scanner({scanRes,setScanRes,C,ASSETS}: any) {
  const [filter,setFilter]=useState("ALL");const [scanning,setScanning]=useState(false);
  const run=()=>{
    setScanning(true);
    setTimeout(()=>{
      setScanRes(Object.entries(ASSETS).flatMap(([cl,as]: [string, any])=>as.assets.map((a:string)=>{
        const engine = new CandleEngine(BASE_P[a]||10, as.vol);
        const sg=aiSignal(engine.history) || { dir: "NEUTRAL", conf: 0, reason: "Insufficient momentum", entry: BASE_P[a], tp: BASE_P[a], sl: BASE_P[a] };
        return{...sg,asset:a,cls:cl};
      })));
      setScanning(false);
    },1400);
  };
  const fr=filter==="ALL"?scanRes:scanRes.filter((r:any)=>r.dir===filter);
  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        <span style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:700,color:C.white}}>AI Market Scanner</span>
        <div style={{flex:1}}/>
        {["ALL","LONG","SHORT","NEUTRAL"].map(f=>(
          <button key={f} onClick={()=>setFilter(f)} style={{padding:"4px 12px",fontSize:10,border:`1px solid ${filter===f?C.accent:C.border}`,borderRadius:5,background:filter===f?"rgba(0,87,255,0.1)":"transparent",color:filter===f?C.accent:C.muted,cursor:"pointer"}}>{f}</button>
        ))}
        <button onClick={run} disabled={scanning} style={{padding:"5px 16px",fontSize:10,fontWeight:600,border:`1px solid ${C.accent}`,borderRadius:5,background:"rgba(0,87,255,0.1)",color:C.accent,cursor:"pointer"}}>{scanning?"Scanning...":"▷ Run Scan"}</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:10}}>
        {fr.map((r:any,i:number)=>(
          <div key={i} className="fade" style={{background:C.panel,border:`1px solid ${r.dir==="LONG"?C.green:r.dir==="SHORT"?C.red:C.border}22`,borderRadius:10,padding:14,animationDelay:`${i*0.04}s`,opacity:0}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
              <div><div style={{fontSize:13,color:C.text,fontWeight:600}}>{r.asset}</div><div style={{fontSize:9,color:C.muted,textTransform:"uppercase",letterSpacing:0.5}}>{r.cls}</div></div>
              <div style={{textAlign:"right"}}><div style={{fontSize:13,fontFamily:"'Syne',sans-serif",fontWeight:700,color:r.dir==="LONG"?C.green:r.dir==="SHORT"?C.red:C.muted}}>{r.dir}</div><div style={{fontSize:9,color:C.muted}}>{r.conf}%</div></div>
            </div>
            <div style={{background:C.border,borderRadius:2,height:3,marginBottom:8}}><div style={{width:`${r.conf}%`,height:"100%",background:r.dir==="LONG"?C.green:r.dir==="SHORT"?C.red:C.muted,borderRadius:2}}/></div>
            <div style={{fontSize:9,color:C.muted,marginBottom:8}}>{r.reason}</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:4,fontSize:9}}>
              {[["Entry",r.entry,C.text],["TP",r.tp,C.green],["SL",r.sl,C.red]].map(([l,v,cl])=>(
                <div key={l as string}><div style={{color:C.muted,marginBottom:2}}>{l as string}</div><div style={{color:cl as string,fontFamily:"'DM Mono'"}}>{(v as number)<10?(v as number).toFixed(4):(v as number)<1000?(v as number).toFixed(2):(v as number).toFixed(0)}</div></div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── BACKTEST ─────────────────────────────────────────────────────────────────
function Backtest({bt,fmt,C}: any) {
  if(!bt)return null;
  const ec=bt.trades.map((t:any,i:number)=>({i,equity:t.equity}));
  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:700,color:C.white}}>Strategy Backtester</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10}}>
        {[["Final Equity",`$${fmt(bt.equity)}`,bt.equity>50000?C.green:C.red],["Win Rate",`${bt.wr}%`,bt.wr>50?C.green:C.red],["Sharpe",fmt(bt.sharpe),bt.sharpe>1?C.green:C.yellow],["Max DD",`-${bt.maxdd}%`,C.red],["Trades",bt.total,C.accent]].map(([l,v,cl])=>(
          <div key={l as string} style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:10,padding:14,textAlign:"center"}}>
            <div style={{fontSize:9,color:C.muted,letterSpacing:0.5,marginBottom:8,textTransform:"uppercase"}}>{l as string}</div>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:700,color:cl as string}}>{v as string|number}</div>
          </div>
        ))}
      </div>
      <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:10,padding:16,height:200}}>
        <div style={{fontSize:10,color:C.muted,letterSpacing:0.5,marginBottom:8,textTransform:"uppercase"}}>Equity Curve</div>
        <ResponsiveContainer width="100%" height={150}>
          <AreaChart data={ec}>
            <defs><linearGradient id="bt" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.green} stopOpacity={0.25}/><stop offset="100%" stopColor={C.green} stopOpacity={0}/></linearGradient></defs>
            <XAxis dataKey="i" hide/><YAxis tick={{fill:C.muted,fontSize:9}} tickLine={false} axisLine={false} tickFormatter={v=>`$${(v/1000).toFixed(0)}K`} width={55} domain={["auto","auto"]}/>
            <Tooltip contentStyle={{background:C.panel,border:`1px solid ${C.border}`,fontSize:10}} formatter={(v:number)=>`$${fmt(v)}`}/>
            <Area type="monotone" dataKey="equity" stroke={C.green} fill="url(#bt)" strokeWidth={2} dot={false}/>
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:10,padding:16}}>
        <div style={{fontSize:10,color:C.muted,letterSpacing:0.5,marginBottom:10,textTransform:"uppercase"}}>Trade Log</div>
        <div style={{display:"grid",gridTemplateColumns:"40px 50px 80px 80px 80px 80px",gap:4,fontSize:9,color:C.muted,marginBottom:6,paddingBottom:6,borderBottom:`1px solid ${C.border}`}}>
          {["#","DIR","ENTRY","EXIT","P&L","EQUITY"].map(h=><span key={h}>{h}</span>)}
        </div>
        {bt.trades.slice(-18).reverse().map((t:any,i:number)=>(
          <div key={i} style={{display:"grid",gridTemplateColumns:"40px 50px 80px 80px 80px 80px",gap:4,fontSize:9,padding:"3px 0",borderBottom:`1px solid ${C.border}22`}}>
            <span style={{color:C.muted}}>{bt.trades.length-i}</span>
            <span style={{color:t.dir==="LONG"?C.green:C.red}}>{t.dir}</span>
            <span style={{color:C.muted,fontFamily:"'DM Mono'"}}>{t.entry.toFixed(2)}</span>
            <span style={{color:C.muted,fontFamily:"'DM Mono'"}}>{t.exit.toFixed(2)}</span>
            <span style={{color:t.pnl>0?C.green:C.red,fontFamily:"'DM Mono'"}}>{t.pnl>0?"+":""}{t.pnl}%</span>
            <span style={{color:C.text,fontFamily:"'DM Mono'"}}>${fmt(t.equity)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── POSITIONS ────────────────────────────────────────────────────────────────
function Positions({positions,setPositions,fmt,pclr,C}: any) {
  const total=positions.reduce((s:number,p:any)=>s+p.pnl,0);
  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:700,color:C.white}}>Open Positions</span>
        <span style={{fontSize:12,color:pclr(total),fontWeight:600}}>Unrealized P&L: {total>=0?"+":""}${fmt(total)}</span>
      </div>
      {positions.length===0&&<div style={{textAlign:"center",padding:80,color:C.muted}}>No open positions</div>}
      {positions.map((p:any)=>(
        <div key={p.id} style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:10,padding:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div style={{display:"flex",gap:10,alignItems:"center"}}>
              <div style={{padding:"3px 12px",background:p.side==="LONG"?"rgba(0,232,122,0.1)":"rgba(255,31,75,0.1)",borderRadius:5,color:p.side==="LONG"?C.green:C.red,fontSize:11,fontWeight:700}}>{p.side}</div>
              <div><div style={{fontSize:14,color:C.text,fontWeight:600}}>{p.asset}</div><div style={{fontSize:10,color:C.muted}}>Entry: {fmt(p.entry)} · Size: {p.size}</div></div>
            </div>
            <div style={{textAlign:"right"}}><div style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:700,color:pclr(p.pnl)}}>{p.pnl>=0?"+":""}{fmt(p.pnl)}</div><div style={{fontSize:11,color:pclr(p.pct)}}>{p.pct>=0?"+":""}{fmt(p.pct)}%</div></div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>setPositions((prev:any)=>prev.filter((x:any)=>x.id!==p.id))} style={{flex:1,padding:"7px 0",fontSize:11,fontWeight:600,border:`1px solid ${C.red}44`,borderRadius:6,background:"rgba(255,31,75,0.08)",color:C.red,cursor:"pointer"}}>✕ Close Position</button>
            <button style={{padding:"7px 16px",fontSize:11,border:`1px solid ${C.border}`,borderRadius:6,background:"transparent",color:C.muted,cursor:"pointer"}}>Partial</button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── ORDERS ───────────────────────────────────────────────────────────────────
function Orders({orders,setOrders,ASSETS,tickers,fmt,C}: any) {
  const all=Object.values(ASSETS).flatMap((v:any)=>v.assets);
  const [f,setF]=useState({asset:"BTC/USDT",side:"BUY",type:"MARKET",qty:"0.1",price:"",sl:"",tp:""});
  const place=()=>{
    setOrders((p:any)=>[{id:Date.now(),asset:f.asset,type:f.type,side:f.side,price:parseFloat(f.price)||tickers[f.asset]||0,qty:parseFloat(f.qty)||0,status:"PENDING",time:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})},...p]);
  };
  return (
    <div style={{display:"grid",gridTemplateColumns:"320px 1fr",gap:12}}>
      <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:10,padding:16,height:"fit-content"}}>
        <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:14,color:C.white,marginBottom:14}}>Place Order</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:12}}>
          {["BUY","SELL"].map(s=>(
            <button key={s} onClick={()=>setF(p=>({...p,side:s}))} style={{padding:"8px 0",fontSize:12,fontWeight:700,border:`1px solid ${f.side===s?(s==="BUY"?C.green:C.red):C.border}`,borderRadius:6,background:f.side===s?(s==="BUY"?"rgba(0,232,122,0.1)":"rgba(255,31,75,0.1)"):"transparent",color:f.side===s?(s==="BUY"?C.green:C.red):C.muted,cursor:"pointer"}}>{s}</button>
          ))}
        </div>
        {[{l:"Asset",k:"asset",sel:true,opts:all},{l:"Type",k:"type",sel:true,opts:["MARKET","LIMIT","STOP","STOP_LIMIT"]},{l:"Quantity",k:"qty",ph:"0.00"},
          ...(f.type!=="MARKET"?[{l:"Price",k:"price",ph:fmt(tickers[f.asset]||0)}]:[]),
          {l:"Stop Loss",k:"sl",ph:"Optional"},{l:"Take Profit",k:"tp",ph:"Optional"},
        ].map(fd=>(
          <div key={fd.k} style={{marginBottom:10}}>
            <div style={{fontSize:10,color:C.muted,marginBottom:4}}>{fd.l}</div>
            {fd.sel?<select value={(f as any)[fd.k]} onChange={e=>setF(p=>({...p,[fd.k]:e.target.value}))} style={{width:"100%",padding:"8px 10px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,fontSize:12}}>
              {fd.opts?.map(o=><option key={o}>{o}</option>)}
            </select>:<input value={(f as any)[fd.k]} onChange={e=>setF(p=>({...p,[fd.k]:e.target.value}))} placeholder={fd.ph} style={{width:"100%",padding:"8px 10px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,fontSize:12}}/>}
          </div>
        ))}
        <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:C.muted,padding:"8px 0",borderTop:`1px solid ${C.border}`,marginBottom:12}}><span>Market Price</span><span style={{color:C.accent,fontWeight:600}}>{fmt(tickers[f.asset]||0)}</span></div>
        <button onClick={place} style={{width:"100%",padding:"10px 0",fontSize:12,fontWeight:700,border:"none",borderRadius:8,background:f.side==="BUY"?C.green:C.red,color:"#000",cursor:"pointer"}}>{f.side} {f.qty} {f.asset}</button>
      </div>
      <div>
        <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:14,color:C.white,marginBottom:12}}>Pending Orders</div>
        {orders.length===0&&<div style={{textAlign:"center",padding:60,color:C.muted}}>No pending orders</div>}
        {orders.map((o:any)=>(
          <div key={o.id} style={{display:"flex",alignItems:"center",gap:10,background:C.panel,border:`1px solid ${C.border}`,borderRadius:10,padding:14,marginBottom:8}}>
            <div style={{padding:"3px 10px",background:o.side==="BUY"?"rgba(0,232,122,0.1)":"rgba(255,31,75,0.1)",borderRadius:5,color:o.side==="BUY"?C.green:C.red,fontSize:10,fontWeight:700}}>{o.side}</div>
            <div style={{flex:1}}><div style={{fontSize:13,color:C.text,fontWeight:600,marginBottom:2}}>{o.asset}</div><div style={{fontSize:10,color:C.muted}}>{o.type} · Qty {o.qty} · @ {fmt(o.price)} · {o.time}</div></div>
            <div style={{padding:"3px 10px",background:"rgba(255,208,0,0.08)",borderRadius:12,color:C.yellow,fontSize:9,fontWeight:600}}>{o.status}</div>
            <button onClick={()=>setOrders((p:any)=>p.filter((x:any)=>x.id!==o.id))} style={{padding:"4px 10px",fontSize:10,border:`1px solid ${C.border}`,borderRadius:5,background:"transparent",color:C.red,cursor:"pointer"}}>Cancel</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── RISK ─────────────────────────────────────────────────────────────────────
function Risk({portfolio,positions,fmt,C}: any) {
  const exp=positions.length*15000;const rp=(exp/portfolio.equity*100).toFixed(1);const rl=Number(rp)<20?"LOW":Number(rp)<50?"MEDIUM":"HIGH";const rc=rl==="LOW"?C.green:rl==="MEDIUM"?C.yellow:C.red;
  const vd=Array.from({length:20},(_,i)=>({i,v:-(Math.random()*4000+500)}));
  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:700,color:C.white}}>Risk Manager</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
        {[["Exposure",`$${fmt(exp)}`,C.text],["Risk %",`${rp}%`,rc],["Risk Level",rl,rc],["Available Margin",`$${fmt(portfolio.avail)}`,C.green],["Used Margin",`$${fmt(portfolio.used)}`,C.yellow],["Margin Level","340%",C.green]].map(([l,v,cl])=>(
          <div key={l} style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:10,padding:14}}><div style={{fontSize:9,color:C.muted,letterSpacing:0.5,marginBottom:8,textTransform:"uppercase"}}>{l}</div><div style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:700,color:cl}}>{v}</div></div>
        ))}
      </div>
      <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:10,padding:16}}>
        <div style={{fontSize:10,color:C.muted,letterSpacing:0.5,marginBottom:10,textTransform:"uppercase"}}>Portfolio Risk Gauge</div>
        <div style={{background:C.border,borderRadius:6,height:18,overflow:"hidden",marginBottom:6}}><div style={{width:`${rp}%`,height:"100%",background:`linear-gradient(90deg,${C.green},${C.yellow},${C.red})`,transition:"width 0.5s"}}/></div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:C.muted}}><span>0% Safe</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></div>
      </div>
      <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:10,padding:16,height:190}}>
        <div style={{fontSize:10,color:C.muted,letterSpacing:0.5,marginBottom:8,textTransform:"uppercase"}}>Value at Risk (95%)</div>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={vd}><Bar dataKey="v" fill={`${C.red}55`} radius={2}/><XAxis hide/><YAxis tick={{fill:C.muted,fontSize:9}} tickFormatter={v=>`-$${Math.abs(v).toFixed(0)}`} width={55}/><Tooltip contentStyle={{background:C.panel,border:`1px solid ${C.border}`,fontSize:10}} formatter={(v:number)=>`-$${Math.abs(v).toFixed(0)}`}/><ReferenceLine y={0} stroke={C.border}/></BarChart>
        </ResponsiveContainer>
      </div>
      <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:10,padding:16}}>
        <div style={{fontSize:10,color:C.muted,letterSpacing:0.5,marginBottom:10,textTransform:"uppercase"}}>Position Risk</div>
        {positions.map((p:any)=>{const r=Math.random()*14+2;return(
          <div key={p.id} style={{marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:4}}><span style={{color:C.text,fontWeight:500}}>{p.asset}</span><span style={{color:r>10?C.red:r>5?C.yellow:C.green,fontWeight:600}}>{r.toFixed(1)}% risk</span></div>
            <div style={{background:C.border,borderRadius:2,height:4}}><div style={{width:`${r*5}%`,height:"100%",background:r>10?C.red:r>5?C.yellow:C.green,borderRadius:2}}/></div>
          </div>
        );})}
        {positions.length===0&&<div style={{color:C.muted,fontSize:11}}>No open positions</div>}
      </div>
    </div>
  );
}
