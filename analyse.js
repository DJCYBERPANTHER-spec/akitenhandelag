// ==============================
// analyse.js – Finale Version (alle Funktionen)
// Multi-KI Analyse + Kontinuierliches LSTM-Lernen
// ==============================

const API_KEY = "d5qi0c9r01qhn30fr1r0d5qi0c9r01qhn30fr1rg"; // Finnhub API Key einsetzen

// --- Assets (Aktien + Kryptos)
const ASSETS = [
  { symbol: "AAPL", name: "Apple Inc." },
  { symbol: "MSFT", name: "Microsoft Corp." },
  { symbol: "NVDA", name: "NVIDIA Corp." },
  { symbol: "AMZN", name: "Amazon.com Inc." },
  { symbol: "GOOGL", name: "Alphabet Inc." },
  { symbol: "TSLA", name: "Tesla Inc." },
  { symbol: "META", name: "Meta Platforms" },
  { symbol: "NFLX", name: "Netflix" },
  { symbol: "INTC", name: "Intel Corp." },
  { symbol: "ORCL", name: "Oracle Corp." },
  { symbol: "IBM", name: "IBM" },
  { symbol: "DIS", name: "Disney" },
  { symbol: "ADBE", name: "Adobe Inc." },
  { symbol: "PYPL", name: "PayPal Holdings" },
  { symbol: "SAP", name: "SAP SE" },
  { symbol: "BABA", name: "Alibaba" },
  // Kryptos
  { symbol: "BTC-USD", name: "Bitcoin" },
  { symbol: "ETH-USD", name: "Ethereum" },
  { symbol: "BNB-USD", name: "Binance Coin" },
  { symbol: "SOL-USD", name: "Solana" },
  { symbol: "ADA-USD", name: "Cardano" },
  { symbol: "DOGE-USD", name: "Dogecoin" },
  { symbol: "XRP-USD", name: "Ripple" },
  { symbol: "LTC-USD", name: "Litecoin" },
  { symbol: "DOT-USD", name: "Polkadot" },
  { symbol: "LINK-USD", name: "Chainlink" },
  { symbol: "AVAX-USD", name: "Avalanche" },
  { symbol: "MATIC-USD", name: "Polygon" },
  { symbol: "ATOM-USD", name: "Cosmos" },
  { symbol: "FTM-USD", name: "Fantom" },
  { symbol: "ALGO-USD", name: "Algorand" }
];

// --- DOM Elemente
const assetSelect = document.getElementById("assetSelect");
const analyseBtn = document.getElementById("analyseBtn");
const currentPriceDiv = document.getElementById("currentPrice");
const warningDiv = document.getElementById("warning");
const progressBar = document.getElementById("progressBar");
const progressText = document.getElementById("progressText");
const statusDiv = document.getElementById("status");
const outTable = document.getElementById("out");
const chartCanvas = document.getElementById("chart");

let chart = null;
let liveInterval = null;
let lstmModel = null; // Kontinuierliches LSTM-Modell

// --- Helfer
function isCrypto(sym){ return sym.includes("USD"); }
function getRandomAsset(){ return ASSETS[Math.floor(Math.random()*ASSETS.length)]; }

// --- USD -> CHF
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
    const map = { "BTC-USD":"bitcoin","ETH-USD":"ethereum","BNB-USD":"binancecoin","SOL-USD":"solana","ADA-USD":"cardano","DOGE-USD":"dogecoin","XRP-USD":"ripple","LTC-USD":"litecoin","DOT-USD":"polkadot","LINK-USD":"chainlink","AVAX-USD":"avalanche-2","MATIC-USD":"matic-network","ATOM-USD":"cosmos","FTM-USD":"fantom","ALGO-USD":"algorand"};
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

// --- Historische Daten (365 Tage)
async function fetchHistoricalData(sym, days=365){
  const fx = await fetchUsdChf();
  let hist = [];
  if(isCrypto(sym)){
    const map = { "BTC-USD":"bitcoin","ETH-USD":"ethereum","BNB-USD":"binancecoin","SOL-USD":"solana","ADA-USD":"cardano","DOGE-USD":"dogecoin","XRP-USD":"ripple","LTC-USD":"litecoin","DOT-USD":"polkadot","LINK-USD":"chainlink","AVAX-USD":"avalanche-2","MATIC-USD":"matic-network","ATOM-USD":"cosmos","FTM-USD":"fantom","ALGO-USD":"algorand" };
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

// --- KI Modelle
function trendModel(hist){ return hist.at(-1) + (hist.at(-1)-hist[0])/hist.length*7; }
function momentumModel(hist){ return hist.at(-1) + (hist.at(-1)-hist.at(Math.max(0,hist.length-5)))*1.5; }
function volatilityModel(hist){ const avg = hist.reduce((a,b)=>a+b,0)/hist.length; return avg + (hist.at(-1)-avg)*0.5; }

// --- Kontinuierliches LSTM-Lernen
async function trainLSTM(hist, period=7){
  const X=[],Y=[];
  for(let i=0;i<hist.length-period;i++){
    X.push(hist.slice(i,i+period).map(v=>[v]));
    Y.push([hist[i+period]]);
  }
  if(X.length===0) return hist.at(-1);

  const xs = tf.tensor3d(X), ys = tf.tensor2d(Y);

  if(!lstmModel){
    lstmModel = tf.sequential();
    lstmModel.add(tf.layers.lstm({units:20,inputShape:[period,1]}));
    lstmModel.add(tf.layers.dense({units:1}));
    lstmModel.compile({optimizer:"adam",loss:"meanSquaredError"});
  }

  await lstmModel.fit(xs,ys,{epochs:10,verbose:0});
  return lstmModel.predict(tf.tensor3d([X.at(-1)])).dataSync()[0];
}

// --- Ensemble Funktion
async function ensemble(hist){
  const ki1 = trendModel(hist);
  const ki2 = momentumModel(hist);
  const ki3 = volatilityModel(hist);
  const ki4 = await trainLSTM(hist,7);
  return { ki1, ki2, ki3, ki4 };
}

// --- Signale & Konfidenz
function getSignal(diff){ return diff>0.05?"KAUFEN":diff<-0.05?"VERKAUFEN":"HALTEN"; }
function getConfidence(diff){ return Math.abs(diff)>0.1?"Hoch":Math.abs(diff)>0.05?"Mittel":"Niedrig"; }

// --- Warnungen
function checkWarnings(hist){
  if(hist.length<2) return "Keine akute Warnung";
  const lastReturn = (hist.at(-1)-hist[0])/hist[0];
  if(lastReturn>0.15) return "⚠️ Starker Anstieg prognostiziert!";
  if(lastReturn<-0.15) return "⚠️ Starker Rückgang prognostiziert!";
  return "Keine akute Warnung";
}

// --- Chart zeichnen
function drawChart(hist, prognosen){
  if(chart) chart.destroy();
  const avg = (prognosen.ki1+prognosen.ki2+prognosen.ki3+prognosen.ki4)/4;
  chart = new Chart(chartCanvas,{
    type:"line",
    data:{
      labels: hist.map((_,i)=>`T${i+1}`),
      datasets:[
        {label:"Historisch", data:hist, borderColor:"#3b82f6", fill:false},
        {label:"Trend", data:[...Array(hist.length-1).fill(null),prognosen.ki1], borderColor:"#22c55e", fill:false},
        {label:"Momentum", data:[...Array(hist.length-1).fill(null),prognosen.ki2], borderColor:"#3b82f6", fill:false},
        {label:"Volatilität", data:[...Array(hist.length-1).fill(null),prognosen.ki3], borderColor:"#f97316", fill:false},
        {label:"LSTM", data:[...Array(hist.length-1).fill(null),prognosen.ki4], borderColor:"#facc15", fill:false},
        {label:"Durchschnitt", data:[...Array(hist.length-1).fill(null),avg], borderColor:"#ffffff", fill:false}
      ]
    },
    options:{responsive:true}
  });
}

// --- Analyse starten
async function runAnalysis(sym){
  progressBar.value=0; progressText.textContent="Berechnung startet…";
  statusDiv.textContent="Analyse läuft…";

  const hist = await fetchHistoricalData(sym,365);
  const live = await fetchCurrentPrice(sym);
  currentPriceDiv.textContent=`Aktueller Kurs: ${live.toFixed(2)} CHF`;
  warningDiv.textContent = checkWarnings(hist);

  progressBar.value = 30; progressText.textContent="KI-Prognosen werden erstellt…";
  const prognosen = await ensemble(hist);

  progressBar.value = 70; progressText.textContent="Chart wird gezeichnet…";
  drawChart(hist, prognosen);

  const now = new Date().toLocaleString();
  let html = "";
  const avg = (prognosen.ki1+prognosen.ki2+prognosen.ki3+prognosen.ki4)/4;
  const diffAvg = (avg-live)/live;

  ["ki1","ki2","ki3","ki4"].forEach((k,i)=>{
    const p = prognosen[k];
    const diff = (p-live)/live;
    const sig = getSignal(diff);
    html+=`<tr><td>KI${i+1}</td><td>${p.toFixed(2)}</td><td class="${sig.toLowerCase()}">${sig}</td><td>▲${(diff*100).toFixed(1)}%</td><td class="conf">${getConfidence(diff)}</td><td>${now}</td></tr>`;
  });

  const sigAvg = getSignal(diffAvg);
  html+=`<tr><td>Durchschnitt</td><td>${avg.toFixed(2)}</td><td class="${sigAvg.toLowerCase()}">${sigAvg}</td><td>▲${(diffAvg*100).toFixed(1)}%</td><td class="conf">${getConfidence(diffAvg)}</td><td>${now}</td></tr>`;

  outTable.innerHTML = html;

  progressBar.value=100; progressText.textContent="Fertig";
  statusDiv.textContent="Analyse abgeschlossen";

  // --- 7-Tage-Check
  setTimeout(async ()=>{
    const newLive = await fetchCurrentPrice(sym);
    const diff7 = ((newLive - avg)/avg*100).toFixed(2);
    console.log(`Prognose für ${sym} nach 7 Tagen: Abweichung ${diff7}%`);
  },7*24*60*60*1000);
}

// --- Dropdown & Buttons
ASSETS.forEach(a=>{
  const o = document.createElement("option");
  o.value = a.symbol;
  o.textContent = `${a.name} (${a.symbol})`;
  assetSelect.appendChild(o);
});

assetSelect.addEventListener("change",async e=>{
  if(liveInterval) clearInterval(liveInterval);
  const sym = e.target.value;
  liveInterval = setInterval(async ()=>{
    const live = await fetchCurrentPrice(sym);
    currentPriceDiv.textContent=`Aktueller Kurs: ${live.toFixed(2)} CHF`;
  },5000);
});

analyseBtn.addEventListener("click", async ()=>{
  const sym = assetSelect.value;
  if(!sym){ alert("Bitte Asset auswählen!"); return; }
  await runAnalysis(sym);
});

// --- Kauf-Links
function openYahoo(){ window.open(`https://finance.yahoo.com/quote/${assetSelect.value}`,"_blank"); }
function openTradingView(){ window.open(`https://www.tradingview.com/symbols/${assetSelect.value}/`,"_blank"); }
function openSwissquote(){ window.open(`https://www.swissquote.ch/sqw-en/private/trading/instruments/search?query=${assetSelect.value}`,"_blank"); }

// --- Start-Prognose zufälliges Asset
document.addEventListener("DOMContentLoaded", async ()=>{
  const randomAsset = getRandomAsset().symbol;
  assetSelect.value = randomAsset;
  await runAnalysis(randomAsset);
  liveInterval = setInterval(async ()=>{
    const live = await fetchCurrentPrice(randomAsset);
    currentPriceDiv.textContent=`Aktueller Kurs: ${live.toFixed(2)} CHF`;
  },5000);
});
