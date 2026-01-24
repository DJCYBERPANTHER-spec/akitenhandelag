/***********************
 * KONFIGURATION
 ***********************/
const API_KEY = "d5ohqjhr01qjast6qrjgd5ohqjhr01qjast6qrk0"; // Finnhub
let chart = null;

/***********************
 * ASSETS (erweitert)
 ***********************/
const ASSETS = [
  // Aktien
  { symbol: "AAPL", name: "Apple" },
  { symbol: "MSFT", name: "Microsoft" },
  { symbol: "NVDA", name: "Nvidia" },
  { symbol: "AMZN", name: "Amazon" },
  { symbol: "GOOGL", name: "Alphabet" },
  { symbol: "META", name: "Meta" },
  { symbol: "TSLA", name: "Tesla" },

  // Kryptos
  { symbol: "BTC-USD", name: "Bitcoin" },
  { symbol: "ETH-USD", name: "Ethereum" },
  { symbol: "BNB-USD", name: "Binance Coin" },
  { symbol: "SOL-USD", name: "Solana" },
  { symbol: "ADA-USD", name: "Cardano" },
  { symbol: "XRP-USD", name: "Ripple" },
  { symbol: "DOGE-USD", name: "Dogecoin" }
];

/***********************
 * DOM
 ***********************/
const assetSelect = document.getElementById("assetSelect");
const analyseBtn = document.getElementById("analyseBtn");
const statusDiv = document.getElementById("status");
const warningDiv = document.getElementById("warning");
const outTable = document.getElementById("out");
const chartCanvas = document.getElementById("chart");

/***********************
 * DROPDOWN
 ***********************/
ASSETS.forEach(a => {
  const o = document.createElement("option");
  o.value = a.symbol;
  o.textContent = `${a.name} (${a.symbol})`;
  assetSelect.appendChild(o);
});

/***********************
 * HILFSFUNKTIONEN
 ***********************/
function getRandomAsset(){
  return ASSETS[Math.floor(Math.random() * ASSETS.length)];
}

function isCrypto(sym){
  return sym.includes("USD");
}

/***********************
 * KURSE
 ***********************/
async function fetchQuote(sym){
  try{
    if(isCrypto(sym)){
      const map = {
        "BTC-USD":"bitcoin","ETH-USD":"ethereum","BNB-USD":"binancecoin",
        "SOL-USD":"solana","ADA-USD":"cardano","XRP-USD":"ripple","DOGE-USD":"dogecoin"
      };
      const id = map[sym];
      const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`);
      const j = await r.json();
      return j[id].usd;
    }else{
      const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${sym}&token=${API_KEY}`);
      const j = await r.json();
      return j.c;
    }
  }catch{
    return 0;
  }
}

async function fetchHistory(sym, days = 30){
  try{
    if(isCrypto(sym)){
      const map = {
        "BTC-USD":"bitcoin","ETH-USD":"ethereum","BNB-USD":"binancecoin",
        "SOL-USD":"solana","ADA-USD":"cardano","XRP-USD":"ripple","DOGE-USD":"dogecoin"
      };
      const id = map[sym];
      const r = await fetch(`https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=${days}`);
      const j = await r.json();
      return j.prices.map(p => p[1]);
    }else{
      const now = Math.floor(Date.now()/1000);
      const from = now - days*86400;
      const r = await fetch(`https://finnhub.io/api/v1/stock/candle?symbol=${sym}&resolution=D&from=${from}&to=${now}&token=${API_KEY}`);
      const j = await r.json();
      return j.c;
    }
  }catch{
    return [];
  }
}

/***********************
 * KI-MODELLE
 ***********************/
function trendModel(p){
  return p.at(-1) + (p.at(-1) - p[0]) / p.length * 7;
}

function momentumModel(p){
  return p.at(-1) + (p.at(-1) - p.at(-5)) * 1.5;
}

function volatilityModel(p){
  const avg = p.reduce((a,b)=>a+b,0)/p.length;
  return avg + (p.at(-1)-avg)*0.5;
}

function ensemble(p){
  return {
    ki1: trendModel(p),
    ki2: momentumModel(p),
    ki3: volatilityModel(p)
  };
}

/***********************
 * GENAUIGKEIT
 ***********************/
function accuracy(pred, real){
  const err = Math.abs(pred - real) / real;
  return Math.max(0, Math.round((1 - err) * 100));
}

/***********************
 * WARNUNG
 ***********************/
function strongRiseWarning(preds, live){
  const avg = (preds.ki1 + preds.ki2 + preds.ki3)/3;
  const diff = (avg - live)/live*100;
  if(diff > 15){
    return "⚠️ Starker Anstieg prognostiziert – erhöhte Volatilität!";
  }
  return "Keine besondere Warnung";
}

/***********************
 * CHART
 ***********************/
function drawChart(hist, preds){
  if(chart) chart.destroy();
  chart = new Chart(chartCanvas,{
    type:"line",
    data:{
      labels: hist.map((_,i)=>`T${i+1}`),
      datasets:[
        { label:"Historisch", data:hist, borderColor:"#3b82f6" },
        { label:"KI Ø", data:[...Array(hist.length-1).fill(null),
          (preds.ki1+preds.ki2+preds.ki3)/3], borderColor:"#22c55e" }
      ]
    }
  });
}

/***********************
 * AUTOMATISCHER START
 ***********************/
document.addEventListener("DOMContentLoaded", async ()=>{
  const stored = localStorage.getItem("ki7d");

  if(stored){
    const d = JSON.parse(stored);
    if(Date.now() - d.date > 7*86400000){
      const real = await fetchQuote(d.symbol);
      const acc1 = accuracy(d.preds.ki1, real);
      const acc2 = accuracy(d.preds.ki2, real);
      const acc3 = accuracy(d.preds.ki3, real);
      const avgAcc = Math.round((acc1+acc2+acc3)/3);

      statusDiv.innerHTML = `🎯 KI-Auswertung für ${d.symbol}<br>Durchschnittliche Genauigkeit: <b>${avgAcc}%</b>`;
      localStorage.removeItem("ki7d");
      return;
    }
  }

  const asset = getRandomAsset();
  assetSelect.value = asset.symbol;
  const hist = await fetchHistory(asset.symbol);
  const preds = ensemble(hist);

  localStorage.setItem("ki7d", JSON.stringify({
    symbol: asset.symbol,
    preds,
    date: Date.now()
  }));

  statusDiv.innerHTML = `📊 Automatische 7-Tage-Prognose gestartet für <b>${asset.name}</b>`;
});

/***********************
 * MANUELLE ANALYSE
 ***********************/
analyseBtn.addEventListener("click", async ()=>{
  const sym = assetSelect.value;
  const hist = await fetchHistory(sym);
  const live = await fetchQuote(sym);
  const preds = ensemble(hist);

  warningDiv.textContent = strongRiseWarning(preds, live);
  drawChart(hist, preds);

  outTable.innerHTML = `
    <tr><td>KI 1</td><td>${preds.ki1.toFixed(2)}</td></tr>
    <tr><td>KI 2</td><td>${preds.ki2.toFixed(2)}</td></tr>
    <tr><td>KI 3</td><td>${preds.ki3.toFixed(2)}</td></tr>
  `;
});

