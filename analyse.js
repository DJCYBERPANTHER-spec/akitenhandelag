// ==============================
// analyse.js – finale stabile Version 2026
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

// --- Historische Daten (max 100 Tage für LSTM)
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

// --- LSTM async, Hintergrund
async function trainLSTM(hist, period=7){
  if(hist.length<period) return hist.at(-1);
  const histLSTM = hist.slice(-100); // max 100 Tage
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
// --- Ensemble & KI-Auswertung
async function ensemble(hist){
  const ki1 = trendModel(hist);
  const ki2 = momentumModel(hist);
  const ki3 = volatilityModel(hist);
  const ki4Promise = trainLSTM(hist,7); // async, läuft im Hintergrund
  return { ki1, ki2, ki3, ki4Promise };
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
  const ki4 = prognosen.ki4 || hist.at(-1);
  const avg = (prognosen.ki1 + prognosen.ki2 + prognosen.ki3 + ki4)/4;

  chart = new Chart(chartCanvas,{
    type:"line",
    data:{
      labels: hist.map((_,i)=>`T${i+1}`),
      datasets:[
        {label:"Historisch", data:hist, borderColor:"#3b82f6", fill:false},
        {label:"Trend", data:[...Array(hist.length-1).fill(null),prognosen.ki1], borderColor:"#22c55e", fill:false},
        {label:"Momentum", data:[...Array(hist.length-1).fill(null),prognosen.ki2], borderColor:"#3b82f6", fill:false},
        {label:"Volatilität", data:[...Array(hist.length-1).fill(null),prognosen.ki3], borderColor:"#f97316", fill:false},
        {label:"LSTM", data:[...Array(hist.length-1).fill(null),ki4], borderColor:"#facc15", fill:false},
        {label:"Durchschnitt", data:[...Array(hist.length-1).fill(null),avg], borderColor:"#ffffff", fill:false}
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

// --- Analyse starten
async function runAnalysis(sym){
  if(analysisRunning) return;
  analysisRunning = true;
  progressBar.value=0; progressText.textContent="Analyse startet…";
  statusDiv.textContent="Analyse läuft…";

  try{
    const hist = await fetchHistoricalData(sym,100);
    if(!hist || hist.length<2){ alert("Keine historischen Daten verfügbar!"); return; }

    const live = await fetchCurrentPrice(sym);
    if(!live || live===0){ alert("Kursdaten konnten nicht abgerufen werden!"); return; }

    currentPriceDiv.textContent=`Aktueller Kurs: ${live.toFixed(2)} CHF`;
    warningDiv.textContent = checkWarnings(hist);

    progressBar.value = 30; progressText.textContent="KI-Prognosen werden erstellt…";

    const prognosen = await ensemble(hist);

    // Chart sofort mit klassischen KIs zeichnen
    progressBar.value = 70; progressText.textContent="Chart wird gezeichnet…";
    drawChart(hist, prognosen);

    // Tabelle mit klassischen KIs
    const now = new Date().toLocaleString();
    let html = "";
    const ki4Val = hist.at(-1);
    const avg = (prognosen.ki1+prognosen.ki2+prognosen.ki3+ki4Val)/4;

    ["ki1","ki2","ki3"].forEach((k,i)=>{
      const p = prognosen[k];
      const diff = (p-live)/live;
      const sig = getSignal(diff);
      html+=`<tr><td>KI${i+1}</td><td>${p.toFixed(2)}</td><td class="${sig.toLowerCase()}">${sig}</td><td>▲${(diff*100).toFixed(1)}%</td><td class="conf">${getConfidence(diff)}</td><td>${now}</td></tr>`;
    });
    html+=`<tr><td>Durchschnitt</td><td>${avg.toFixed(2)}</td><td>-</td><td>-</td><td>-</td><td>${now}</td></tr>`;
    outTable.innerHTML = html;

    progressBar.value=100; progressText.textContent="Fertig"; statusDiv.textContent="Analyse abgeschlossen";

    // LSTM async Update Chart & Tabelle
    prognosen.ki4Promise.then(ki4=>{
      prognosen.ki4 = ki4;
      drawChart(hist, prognosen);

      const diff = (ki4-live)/live;
      const sig = getSignal(diff);
      html += `<tr><td>LSTM</td><td>${ki4.toFixed(2)}</td><td class="${sig.toLowerCase()}">${sig}</td><td>▲${(diff*100).toFixed(1)}%</td><td class="conf">${getConfidence(diff)}</td><td>${now}</td></tr>`;
      outTable.innerHTML = html;
    });

    // 7-Tage Check (optional)
    setTimeout(async ()=>{
      const newLive = await fetchCurrentPrice(sym);
      const diff7 = ((newLive-avg)/avg*100).toFixed(2);
      console.log(`Prognose für ${sym} nach 7 Tagen: Abweichung ${diff7}%`);
    },7*24*60*60*1000);

  } finally {
    analysisRunning = false;
  }
}

// --- DOM Setup
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

  // Live Kurs Interval
  liveInterval = setInterval(async ()=>{
    if(assetSelect.value){
      const live = await fetchCurrentPrice(assetSelect.value);
      currentPriceDiv.textContent=`Aktueller Kurs: ${live.toFixed(2)} CHF`;
    }
  },5000);

  // Automatische Startanalyse
  const randomAsset = getRandomAsset().symbol;
  assetSelect.value = randomAsset;
  await runAnalysis(randomAsset);
});

// --- Kauf-Links
function openYahoo(){ window.open(`https://finance.yahoo.com/quote/${assetSelect.value}`,"_blank"); }
function openTradingView(){ window.open(`https://www.tradingview.com/symbols/${assetSelect.value}/`,"_blank"); }
function openSwissquote(){ window.open(`https://www.swissquote.ch/sqw-en/private/trading/instruments/search?query=${assetSelect.value}`,"_blank"); }
