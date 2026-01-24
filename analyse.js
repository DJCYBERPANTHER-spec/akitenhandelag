// ==============================
// analyse.js – Debug, KI und historische Daten
// ==============================

const API_KEY = "d5qi0c9r01qhn30fr1r0d5qi0c9r01qhn30fr1rg";

// ✅ Alle Aktien + Kryptowährungen
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

// DOM Elemente
let assetSelect, analyseBtn, currentPriceDiv, warningDiv, progressBar, progressText, statusDiv, outTable, chartCanvas;
let chart = null;
let lstmModel = null;
let analysisRunning = false;

// ---------------------
// Hilfsfunktionen
// ---------------------
function isCrypto(sym){ return sym.includes("USD"); }
function getRandomAsset(){ return ASSETS[Math.floor(Math.random()*ASSETS.length)]; }

// USD -> CHF Umrechnung
async function fetchUsdChf(){
  try{
    const r = await fetch("https://api.exchangerate.host/latest?base=USD&symbols=CHF");
    const j = await r.json();
    return j?.rates?.CHF || 0.93;
  }catch{return 0.93;}
}

// Live-Kurse
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

// ---------------------
// Historische Daten mit Debug
// ---------------------
async function fetchHistoricalData(sym, days=365) {
  const fx = await fetchUsdChf();
  let hist = [];

  if(isCrypto(sym)){
    const map = { "BTC-USD":"bitcoin","ETH-USD":"ethereum","BNB-USD":"binancecoin","SOL-USD":"solana","ADA-USD":"cardano","DOGE-USD":"dogecoin","XRP-USD":"ripple","LTC-USD":"litecoin" };
    try{
      const r = await fetch(`https://api.coingecko.com/api/v3/coins/${map[sym]}/market_chart?vs_currency=usd&days=${days}`);
      const j = await r.json();
      debugLog(`CoinGecko Response für ${sym}`, j);
      if(j.prices && j.prices.length>0){
        hist = j.prices.map(p=>p[1]*fx);
      } else {
        debugLog(`Keine historischen Daten von CoinGecko für ${sym}`);
      }
    } catch(err){
      debugLog(`Fehler beim Abrufen von CoinGecko für ${sym}`, err);
    }
  } else {
    try{
      const now = Math.floor(Date.now()/1000);
      const from = now - days*86400;
      const r = await fetch(`https://finnhub.io/api/v1/stock/candle?symbol=${sym}&resolution=D&from=${from}&to=${now}&token=${API_KEY}`);
      const j = await r.json();
      debugLog(`Finnhub Response für ${sym}`, j);
      if(j.c && j.c.length>0){
        hist = j.c.map(v=>v*fx);
      } else {
        debugLog(`Keine historischen Daten von Finnhub für ${sym}`);
      }
    } catch(err){
      debugLog(`Fehler beim Abrufen von Finnhub für ${sym}`, err);
    }
  }

  if(hist.length===0) statusDiv.textContent = `Fehler: Keine historischen Daten für ${sym}`;
  return hist;
}

// ---------------------
// Debug-Funktion: zeigt API-Antworten
// ---------------------
function debugLog(message, data){
  console.log(message, data || '');
  const debugDiv = document.getElementById("debug");
  if(debugDiv){
    const p = document.createElement("p");
    p.textContent = message + (data ? ` -> ${JSON.stringify(data).substring(0,150)}...` : '');
    debugDiv.appendChild(p);
  }
}

// ---------------------
// Klassische KIs
// ---------------------
function trendModel(hist){ return hist.at(-1) + (hist.at(-1)-hist[0])/hist.length*7; }
function momentumModel(hist){ return hist.at(-1) + (hist.at(-1)-hist.at(Math.max(0,hist.length-5)))*1.5; }
function volatilityModel(hist){ const avg = hist.reduce((a,b)=>a+b,0)/hist.length; return avg + (hist.at(-1)-avg)*0.5; }

// ---------------------
// LSTM KI
// ---------------------
async function trainLSTM(hist, period=7){
  if(hist.length<period) return hist.at(-1);
  const histLSTM = hist.slice(-365);
  const X=[], Y=[];
  for(let i=0;i<histLSTM.length-period;i++){
    X.push(histLSTM.slice(i,i+period).map(v=>[v]));
    Y.push([histLSTM[i+period]]);
  }
  const xs = tf.tensor3d(X);
  const ys = tf.tensor2d(Y);
  if(!lstmModel){
    lstmModel = tf.sequential();
    lstmModel.add(tf.layers.lstm({units:32,inputShape:[period,1]}));
    lstmModel.add(tf.layers.dense({units:1}));
    lstmModel.compile({optimizer:"adam",loss:"meanSquaredError"});
  }
  await lstmModel.fit(xs,ys,{epochs:10,verbose:0});
  return lstmModel.predict(tf.tensor3d([X.at(-1)])).dataSync()[0];
}

// ---------------------
// Ensemble KI
// ---------------------
async function ensemble(hist){
  const kiTrend = trendModel(hist);
  const kiMomentum = momentumModel(hist);
  const kiVol = volatilityModel(hist);
  const kiLSTM = await trainLSTM(hist,7);
  const bestPrediction = (kiTrend + kiMomentum + kiVol + kiLSTM)/4;
  return { kiTrend, kiMomentum, kiVol, kiLSTM, bestPrediction };
}

// ---------------------
// Signale & Warnungen
// ---------------------
function getSignal(diff){
  return diff>0.05?"KAUFEN":diff<-0.05?"VERKAUFEN":"HALTEN";
}
function getConfidence(diff){
  return Math.abs(diff)>0.1?"Hoch":Math.abs(diff)>0.05?"Mittel":"Niedrig";
}
function checkWarnings(hist){
  if(hist.length<2) return "Keine akute Warnung";
  const lastReturn = (hist.at(-1)-hist[0])/hist[0];
  if(lastReturn>0.15) return "⚠️ Starker Anstieg prognostiziert!";
  if(lastReturn<-0.15) return "⚠️ Starker Rückgang prognostiziert!";
  return "Keine akute Warnung";
}

// ---------------------
// Chart zeichnen
// ---------------------
function drawChart(hist, ensemblePrediction){
  if(chart) chart.destroy();
  chart = new Chart(chartCanvas,{
    type:"line",
    data:{
      labels: hist.map((_,i)=>`T${i+1}`),
      datasets:[
        {label:"Historisch", data:hist, borderColor:"#3b82f6", fill:false},
        {label:"Trend", data:[...Array(hist.length-1).fill(null),ensemblePrediction.kiTrend], borderColor:"#22c55e", fill:false},
        {label:"Momentum", data:[...Array(hist.length-1).fill(null),ensemblePrediction.kiMomentum], borderColor:"#3b82f6", fill:false},
        {label:"Volatilität", data:[...Array(hist.length-1).fill(null),ensemblePrediction.kiVol], borderColor:"#f97316", fill:false},
        {label:"LSTM", data:[...Array(hist.length-1).fill(null),ensemblePrediction.kiLSTM], borderColor:"#facc15", fill:false},
        {label:"Durchschnitt", data:[...Array(hist.length-1).fill(null),ensemblePrediction.bestPrediction], borderColor:"#ffffff", fill:false}
      ]
    },
    options:{
      responsive:true,
      animation:{duration:0},
      plugins:{legend:{labels:{color:"#ffffff"}}},
      scales:{x:{ticks:{color:"#ffffff"}},y:{ticks:{color:"#ffffff"}}}
    }
  });
}

// ---------------------
// Analyse starten
// ---------------------
async function runAnalysis(sym){
  if(analysisRunning) return;
  analysisRunning = true;
  progressBar.value=0; progressText.textContent="Analyse startet…";
  statusDiv.textContent="Analyse läuft…";

  try{
    const hist = await fetchHistoricalData(sym,365);
    if(hist.length<2){ alert("Keine historischen Daten verfügbar!"); return; }

    const live = await fetchCurrentPrice(sym);
    currentPriceDiv.textContent=`Aktueller Kurs: ${live.toFixed(2)} CHF`;
    warningDiv.textContent = checkWarnings(hist);

    progressBar.value=30; progressText.textContent="KI-Prognosen werden erstellt…";

    const ensemblePrediction = await ensemble(hist);

    progressBar.value=70; progressText.textContent="Chart wird gezeichnet…";
    drawChart(hist, ensemblePrediction);

    const now = new Date().toLocaleString();
    const diff = (ensemblePrediction.bestPrediction-live)/live;
    const sig = getSignal(diff);

    outTable.innerHTML = `
      <tr>
        <td>Trend</td><td>${ensemblePrediction.kiTrend.toFixed(2)}</td><td>${getSignal((ensemblePrediction.kiTrend-live)/live)}</td><td>▲${(((ensemblePrediction.kiTrend-live)/live)*100).toFixed(1)}%</td><td>${getConfidence((ensemblePrediction.kiTrend-live)/live)}</td><td>${now}</td>
      </tr>
      <tr>
        <td>Momentum</td><td>${ensemblePrediction.kiMomentum.toFixed(2)}</td><td>${getSignal((ensemblePrediction.kiMomentum-live)/live)}</td><td>▲${(((ensemblePrediction.kiMomentum-live)/live)*100).toFixed(1)}%</td><td>${getConfidence((ensemblePrediction.kiMomentum-live)/live)}</td><td>${now}</td>
      </tr>
      <tr>
        <td>Volatilität</td><td>${ensemblePrediction.kiVol.toFixed(2)}</td><td>${getSignal((ensemblePrediction.kiVol-live)/live)}</td><td>▲${(((ensemblePrediction.kiVol-live)/live)*100).toFixed(1)}%</td><td>${getConfidence((ensemblePrediction.kiVol-live)/live)}</td><td>${now}</td>
      </tr>
      <tr>
        <td>LSTM</td><td>${ensemblePrediction.kiLSTM.toFixed(2)}</td><td>${getSignal((ensemblePrediction.kiLSTM-live)/live)}</td><td>▲${(((ensemblePrediction.kiLSTM-live)/live)*100).toFixed(1)}%</td><td>${getConfidence((ensemblePrediction.kiLSTM-live)/live)}</td><td>${now}</td>
      </tr>
      <tr>
        <td>Best Prediction</td><td>${ensemblePrediction.bestPrediction.toFixed(2)}</td><td>${sig}</td><td>▲${(diff*100).toFixed(1)}%</td><td>${getConfidence(diff)}</td><td>${now}</td>
      </tr>
    `;

    progressBar.value=100; progressText.textContent="Fertig"; statusDiv.textContent="Analyse abgeschlossen";

  } finally {
    analysisRunning = false;
  }
}

// ---------------------
// DOM Setup & Events
// ---------------------
document.addEventListener("DOMContentLoaded", async ()=>{
  assetSelect = document.getElementById("assetSelect");
  analyseBtn = document.getElementById("analyseBtn");
  currentPriceDiv = document.getElementById("currentPrice");
  warningDiv = document.getElementById("warning");
  progressBar = document.getElementById("progressBar");
  progressText = document.getElementById("progressText");
  statusDiv = document.getElementById("status");
  outTable = document.getElementById("out");
  chartCanvas = document.getElementById("chart");

  // Dropdown füllen
  ASSETS.forEach(a=>{
    const o = document.createElement("option");
    o.value = a.symbol;
    o.textContent = `${a.name} (${a.symbol})`;
    assetSelect.appendChild(o);
  });

  // Button Event – manuelle Analyse
  analyseBtn.addEventListener("click", async ()=>{
    if(!assetSelect.value){ alert("Bitte Asset auswählen!"); return; }
    await runAnalysis(assetSelect.value);
  });

  // Automatische Startanalyse mit zufälligem Asset
  const randomAsset = getRandomAsset().symbol;
  assetSelect.value = randomAsset;
  await runAnalysis(randomAsset);
});

