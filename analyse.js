// ==============================
// analyse.js – finale Version 2026
// ==============================

const API_KEY = "HIER_DEIN_FINNHUB_KEY";

const ASSETS = [
  { symbol: "AAPL", name: "Apple Inc." },
  { symbol: "MSFT", name: "Microsoft Corp." },
  { symbol: "NVDA", name: "NVIDIA Corp." },
  { symbol: "AMZN", name: "Amazon.com Inc." },
  { symbol: "GOOGL", name: "Alphabet Inc." },
  { symbol: "TSLA", name: "Tesla Inc." },
  { symbol: "META", name: "Meta Platforms" },
  { symbol: "BTC-USD", name: "Bitcoin" },
  { symbol: "ETH-USD", name: "Ethereum" },
  { symbol: "BNB-USD", name: "Binance Coin" },
  { symbol: "SOL-USD", name: "Solana" },
  { symbol: "ADA-USD", name: "Cardano" },
  { symbol: "DOGE-USD", name: "Dogecoin" },
  { symbol: "XRP-USD", name: "Ripple" },
  { symbol: "LTC-USD", name: "Litecoin" }
];

let assetSelect, analyseBtn, currentPriceDiv, warningDiv, progressBar, progressText, statusDiv, outTable, chartCanvas;
let chart = null;
let liveInterval = null;
let lstmModel = null;
let analysisRunning = false;

// --- Helfer
function isCrypto(sym){ return sym.includes("USD"); }
function getRandomAsset(){ return ASSETS[Math.floor(Math.random()*ASSETS.length)]; }

// --- Fetch USD -> CHF
async function fetchUsdChf(){
  try{
    const r = await fetch("https://api.exchangerate.host/latest?base=USD&symbols=CHF");
    const j = await r.json();
    return j?.rates?.CHF || 0.93;
  }catch{return 0.93;}
}

// --- Live-Kurse
async function fetchStock(sym){
  try{
    const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${sym}&token=${API_KEY}`);
    const j = await r.json();
    return j.c || 0;
  }catch{return 0;}
}
async function fetchCrypto(sym){
  try{
    const map = { "BTC-USD":"bitcoin","ETH-USD":"ethereum","BNB-USD":"binancecoin","SOL-USD":"solana","ADA-USD":"cardano","DOGE-USD":"dogecoin","XRP-USD":"ripple","LTC-USD":"litecoin" };
    const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${map[sym]}&vs_currencies=usd`);
    const j = await r.json();
    return j[map[sym]]?.usd || 0;
  }catch{return 0;}
}

async function fetchCurrentPrice(sym){
  const fx = await fetchUsdChf();
  const price = isCrypto(sym)?await fetchCrypto(sym):await fetchStock(sym);
  return price * fx;
}

// --- Historische Daten max 100 Tage für LSTM
async function fetchHistoricalData(sym, days=100){
  const fx = await fetchUsdChf();
  let hist = [];
  if(isCrypto(sym)){
    const map = { "BTC-USD":"bitcoin","ETH-USD":"ethereum","BNB-USD":"binancecoin","SOL-USD":"solana","ADA-USD":"cardano","DOGE-USD":"dogecoin","XRP-USD":"ripple","LTC-USD":"litecoin" };
    try{
      const r = await fetch(`https://api.coingecko.com/api/v3/coins/${map[sym]}/market_chart?vs_currency=usd&days=${days}`);
      const j = await r.json();
      hist = j.prices.map(p=>p[1]);
    }catch{ hist = [];}
  } else {
    try{
      const now = Math.floor(Date.now()/1000);
      const from = now - days*86400;
      const r = await fetch(`https://finnhub.io/api/v1/stock/candle?symbol=${sym}&resolution=D&from=${from}&to=${now}&token=${API_KEY}`);
      const j = await r.json();
      hist = j.c || [];
    }catch{ hist = [];}
  }
  return hist.map(v=>v*fx);
}

// --- Klassische KIs
function trendModel(hist){ return hist.at(-1) + (hist.at(-1)-hist[0])/hist.length*7; }
function momentumModel(hist){ return hist.at(-1) + (hist.at(-1)-hist.at(Math.max(0,hist.length-5)))*1.5; }
function volatilityModel(hist){ const avg = hist.reduce((a,b)=>a+b,0)/hist.length; return avg + (hist.at(-1)-avg)*0.5; }

// --- LSTM async Hintergrund
async function trainLSTM(hist, period=7){
  if(hist.length<period) return hist.at(-1);
  const histLSTM = hist.slice(-100);
  const X=[], Y=[];
  for(let i=0;i<histLSTM.length-period;i++){
    X.push(histLSTM.slice(i,i+period).map(v=>[v]));
    Y.push([histLSTM[i+period]]);
  }
  const xs = tf.tensor3d(X);
  const ys = tf.tensor2d(Y);
  if(!lstmModel){
    lstmModel = tf.sequential();
    lstmModel.add(tf.layers.lstm({units:20,inputShape:[period,1]}));
    lstmModel.add(tf.layers.dense({units:1}));
    lstmModel.compile({optimizer:"adam",loss:"meanSquaredError"});
  }
  await lstmModel.fit(xs,ys,{epochs:5,verbose:0});
  return lstmModel.predict(tf.tensor3d([X.at(-1)])).dataSync()[0];
}
