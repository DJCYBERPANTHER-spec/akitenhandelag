// ==============================
// analyse.js – Teil 1 von 2 – Alle Funktionen + Assets
// ==============================

const API_KEY = "d5ohqjhr01qjast6qrjgd5ohqjhr01qjast6qrk0";

// -----------------
// Assets
// -----------------
const ASSETS = [
  {symbol:"AAPL",name:"Apple Inc."},{symbol:"MSFT",name:"Microsoft Corp."},{symbol:"NVDA",name:"NVIDIA Corp."},
  {symbol:"AMZN",name:"Amazon.com Inc."},{symbol:"GOOGL",name:"Alphabet Inc."},{symbol:"TSLA",name:"Tesla Inc."},
  {symbol:"META",name:"Meta Platforms"},{symbol:"NFLX",name:"Netflix"},{symbol:"INTC",name:"Intel Corp."},
  {symbol:"ORCL",name:"Oracle Corp."},{symbol:"IBM",name:"IBM"},{symbol:"DIS",name:"Disney"},
  // ... weitere Aktien auf 100 ergänzen
];

const CRYPTOS = [
  {symbol:"BTC-USD",name:"Bitcoin"},{symbol:"ETH-USD",name:"Ethereum"},{symbol:"BNB-USD",name:"Binance Coin"},
  {symbol:"SOL-USD",name:"Solana"},{symbol:"ADA-USD",name:"Cardano"},{symbol:"DOGE-USD",name:"Dogecoin"},
  {symbol:"XRP-USD",name:"Ripple"},{symbol:"LTC-USD",name:"Litecoin"},{symbol:"DOT-USD",name:"Polkadot"},
  // ... weitere Kryptos auf 100 ergänzen
];

// -----------------
// CoinGecko Mapping
// -----------------
const CRYPTO_MAP = {
  "BTC-USD":"bitcoin",
  "ETH-USD":"ethereum",
  "BNB-USD":"binancecoin",
  "SOL-USD":"solana",
  "ADA-USD":"cardano",
  "DOGE-USD":"dogecoin",
  "XRP-USD":"ripple",
  "LTC-USD":"litecoin",
  "DOT-USD":"polkadot",
  // ... alle weiteren Kryptos
};

// -----------------
// Kombinierte Assets
// -----------------
const ALL_ASSETS = [...ASSETS, ...CRYPTOS];

// -----------------
// DOM Elemente
// -----------------
const assetSelect = document.getElementById("assetSelect");
const analyseBtn = document.getElementById("analyseBtn");
const currentPriceDiv = document.getElementById("currentPrice");
const warningDiv = document.getElementById("warning");
const statusDiv = document.getElementById("status");
const chartCanvas = document.getElementById("chart");
const outTable = document.getElementById("out");
let chart = null;
let liveInterval = null;

// -----------------
// Hilfsfunktionen
// -----------------
function isCrypto(sym){ return CRYPTOS.some(c=>c.symbol===sym); }
function getRandomAsset(){ return ALL_ASSETS[Math.floor(Math.random()*ALL_ASSETS.length)]; }

// -----------------
// USD → CHF
// -----------------
async function fetchUsdChf(){
  try{
    const r = await fetch("https://api.exchangerate.host/latest?base=USD&symbols=CHF");
    const j = await r.json();
    return j?.rates?.CHF || 0.93;
  }catch{return 0.93;}
}

// -----------------
// Live-Kurs
// -----------------
async function fetchStock(sym){
  try{
    const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${sym}&token=${API_KEY}`);
    const j = await r.json();
    return j.c || 0;
  }catch{return 0;}
}

async function fetchCrypto(sym){
  const id = CRYPTO_MAP[sym];
  if(!id) return 0;
  try{
    const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`);
    const j = await r.json();
    return j[id]?.usd || 0;
  }catch{return 0;}
}

async function fetchCurrentPrice(sym){
  const fx = await fetchUsdChf();
  const price = isCrypto(sym)? await fetchCrypto(sym) : await fetchStock(sym);
  return price * fx;
}

// -----------------
// Historische Daten 365 Tage
// -----------------
async function fetchHistoricalData(sym, days=365){
  const fx = await fetchUsdChf();
  let hist = [];
  if(isCrypto(sym)){
    const id = CRYPTO_MAP[sym];
    if(!id) return [];
    try{
      const r = await fetch(`https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=${days}`);
      const j = await r.json();
      hist = j.prices.map(p=>p[1]);
    }catch{ hist = []; }
  } else {
    try{
      const now = Math.floor(Date.now()/1000);
      const from = now - days*86400;
      const r = await fetch(`https://finnhub.io/api/v1/stock/candle?symbol=${sym}&resolution=D&from=${from}&to=${now}&token=${API_KEY}`);
      const j = await r.json();
      hist = j.c || [];
    }catch{ hist = []; }
  }
  return hist.map(v=>v*fx);
}

// -----------------
// KI-Modelle
// -----------------
function trendModel(hist){ return hist.at(-1) + (hist.at(-1)-hist[0])/hist.length*7; }
function momentumModel(hist){ return hist.at(-1) + (hist.at(-1)-hist.at(Math.max(0,hist.length-5)))*1.5; }
function volatilityModel(hist){ const avg = hist.reduce((a,b)=>a+b,0)/hist.length; return avg + (hist.at(-1)-avg)*0.5; }

let lstmModel = null;
async function trainOrUpdateLSTM(hist, period=7){
  const X=[],Y=[];
  for(let i=0;i<hist.length-period;i++){ X.push(hist.slice(i,i+period).map(v=>[v])); Y.push([hist[i+period]]); }
  if(X.length===0) return hist.at(-1);
  const xs=tf.tensor3d(X), ys=tf.tensor2d(Y);
  if(!lstmModel){
    lstmModel = tf.sequential();
    lstmModel.add(tf.layers.lstm({units:20,inputShape:[period,1]}));
    lstmModel.add(tf.layers.dense({units:1}));
    lstmModel.compile({optimizer:"adam",loss:"meanSquaredError"});
    await lstmModel.fit(xs,ys,{epochs:10,verbose:0});
  } else { await lstmModel.fit(xs,ys,{epochs:5,verbose:0}); }
  return lstmModel.predict(tf.tensor3d([X.at(-1)])).dataSync()[0];
}

async function ensemble(hist){
  const ki1 = trendModel(hist);
  const ki2 = momentumModel(hist);
  const ki3 = volatilityModel(hist);
  const ki4 = await trainOrUpdateLSTM(hist,7);
  return {ki1,ki2,ki3,ki4};
}

// -----------------
// Dropdown vorbereiten
// -----------------
ALL_ASSETS.forEach(a=>{
  const opt = document.createElement("option");
  opt.value = a.symbol;
  opt.textContent = `${a.name} (${a.symbol})`;
  assetSelect.appendChild(opt);
});
// ==============================
// analyse.js – Teil 2 von 2 – UI, Chart, Signale, Analyse
// ==============================

let chart = null;
let liveInterval = null;

// -----------------
// Signale
// -----------------
function getSignal(diff){
  if(diff>0.05) return "KAUFEN";
  if(diff<-0.05) return "VERKAUFEN";
  return "HALTEN";
}
function getSignalClass(diff){
  if(diff>0.05) return "buy";
  if(diff<-0.05) return "sell";
  return "hold";
}
function getConfidence(diff){
  const d = Math.abs(diff);
  if(d>0.1) return "Hoch";
  if(d>0.05) return "Mittel";
  return "Niedrig";
}

// -----------------
// Warnungen
// -----------------
function checkWarnings(hist){
  if(hist.length<2) return "Keine Daten";
  const change = (hist.at(-1)-hist.at(0))/hist.at(0);
  if(change<-0.15) return `⚠️ Starker Rückgang: ${(change*100).toFixed(1)}%`;
  if(change>0.2) return `⚠️ Starker Anstieg: ${(change*100).toFixed(1)}%`;
  return "Keine akute Warnung";
}

// -----------------
// Chart zeichnen
// -----------------
function drawChart(hist, prognosen){
  if(chart) chart.destroy();
  const avg = (prognosen.ki1 + prognosen.ki2 + prognosen.ki3 + prognosen.ki4)/4;
  chart = new Chart(chartCanvas, {
    type:"line",
    data:{
      labels:hist.map((_,i)=>`T${i+1}`),
      datasets:[
        {label:"Historisch", data:hist, borderColor:"#3b82f6", fill:false},
        {label:"KI1 (Trend)", data:[...Array(hist.length-1).fill(null), prognosen.ki1], borderColor:"#22c55e", fill:false},
        {label:"KI2 (Momentum)", data:[...Array(hist.length-1).fill(null), prognosen.ki2], borderColor:"#f97316", fill:false},
        {label:"KI3 (Volatilität)", data:[...Array(hist.length-1).fill(null), prognosen.ki3], borderColor:"#facc15", fill:false},
        {label:"KI4 (LSTM)", data:[...Array(hist.length-1).fill(null), prognosen.ki4], borderColor:"#8b5cf6", fill:false},
        {label:"Durchschnitt", data:[...Array(hist.length-1).fill(null), avg], borderColor:"#ffffff", fill:false}
      ]
    },
    options:{responsive:true}
  });
}

// -----------------
// Analyse starten
// -----------------
async function runAnalysis(){
  const sym = assetSelect.value;
  if(!sym){ alert("Bitte Asset auswählen!"); return; }

  statusDiv.textContent = "Analyse läuft…";
  const hist = await fetchHistoricalData(sym,365);
  currentPriceDiv.textContent = `Aktueller Kurs: ${(await fetchCurrentPrice(sym)).toFixed(2)} CHF`;
  warningDiv.textContent = checkWarnings(hist);

  const prognosen = await ensemble(hist);

  drawChart(hist, prognosen);

  // Tabelle erstellen
  const now = new Date().toLocaleString();
  const currentPrice = hist.at(-1);
  const html = Object.entries(prognosen).map(([key,val])=>{
    const diff = (val-currentPrice)/currentPrice;
    return `<tr>
      <td>${key}</td>
      <td>${val.toFixed(2)}</td>
      <td class="${getSignalClass(diff)}">${getSignal(diff)}</td>
      <td>Δ ${(diff*100).toFixed(1)}%</td>
      <td class="conf">${getConfidence(diff)}</td>
      <td>${now}</td>
    </tr>`;
  }).join('');
  outTable.innerHTML = html;

  statusDiv.textContent = "Analyse abgeschlossen";
}

// -----------------
// 7-Tage Prognose
// -----------------
async function sevenDayForecast(sym){
  const period = 7;
  const hist = await fetchHistoricalData(sym, period*2);
  const currentPrice = hist.at(-1);

  const prognosen = await ensemble(hist);
  const avgForecast = (prognosen.ki1 + prognosen.ki2 + prognosen.ki3 + prognosen.ki4)/4;

  const accuracy = ((1 - Math.abs(avgForecast - currentPrice)/currentPrice)*100).toFixed(2);
  console.log(`7-Tage Prognose für ${sym}: ${(avgForecast).toFixed(2)} CHF – Genauigkeit aktuell: ${accuracy}%`);

  if(avgForecast > currentPrice*1.2) console.warn(`⚠️ Hoher Anstieg prognostiziert für ${sym}`);
  if(avgForecast < currentPrice*0.85) console.warn(`⚠️ Starker Rückgang prognostiziert für ${sym}`);

  setTimeout(async ()=>{
    const newPrice = await fetchCurrentPrice(sym);
    const newAccuracy = ((1 - Math.abs(avgForecast - newPrice)/newPrice)*100).toFixed(2);
    console.log(`Prognose für ${sym} nach 7 Tagen: neuer Kurs ${(newPrice).toFixed(2)} CHF – Abweichung ${newAccuracy}%`);
  }, period*24*60*60*1000); // 7 Tage
}

// -----------------
// Event Listener
// -----------------
analyseBtn.addEventListener("click", runAnalysis);

assetSelect.addEventListener("change", async e=>{
  if(liveInterval) clearInterval(liveInterval);
  const sym = e.target.value;
  liveInterval = setInterval(async ()=>{
    currentPriceDiv.textContent = `Aktueller Kurs: ${(await fetchCurrentPrice(sym)).toFixed(2)} CHF`;
  },5000);
});

// -----------------
// Automatische Analyse beim Start (nur ein Asset)
// -----------------
document.addEventListener("DOMContentLoaded", async ()=>{
  const asset = getRandomAsset();
  assetSelect.value = asset.symbol;
  await runAnalysis();
});
