// ==============================
// analyse.js – Krypto 200 Coins mit KI & Chart
// ==============================

let ASSETS = [];
let chart = null;
let analysisRunning = false;

// DOM Elemente
let assetSelect, analyseBtn, currentPriceDiv, warningDiv, progressBar, progressText, statusDiv, outTable, chartCanvas;

// ---------------------
// Hilfsfunktionen
// ---------------------
function isCrypto(sym){ return true; } // Nur Krypto
function getRandomAsset(){ return ASSETS[Math.floor(Math.random()*ASSETS.length)]; }

// USD -> CHF Umrechnung
async function fetchUsdChf(){
  try{
    const r = await fetch("https://api.exchangerate.host/latest?base=USD&symbols=CHF");
    const j = await r.json();
    return j?.rates?.CHF || 0.93;
  }catch{return 0.93;}
}

// Krypto-Liste von CoinGecko (ca. 200 Coins)
async function getAllCryptos() {
  try{
    const response = await fetch("https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=200&page=1");
    const data = await response.json();
    return data.map(c => ({ symbol: c.id, name: c.name }));
  }catch(err){
    console.error("Fehler beim Laden der Krypto-Liste", err);
    return [];
  }
}

// Aktueller Krypto-Preis
async function fetchCurrentPrice(sym){
  const fx = await fetchUsdChf();
  try{
    const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${sym}&vs_currencies=usd`);
    const j = await r.json();
    return (j[sym]?.usd || 0) * fx;
  }catch{return 0;}
}

// Historische Daten
async function fetchHistoricalData(sym, days=365){
  const fx = await fetchUsdChf();
  let hist = [];
  try{
    const r = await fetch(`https://api.coingecko.com/api/v3/coins/${sym}/market_chart?vs_currency=usd&days=${days}`);
    const j = await r.json();
    if(j.prices && j.prices.length > 0){
      hist = j.prices.map(p => p[1] * fx);
    } else { console.log(`Keine historischen Daten für ${sym}`); }
  }catch(err){
    console.error(`Fehler beim Abrufen historischer Daten für ${sym}`, err);
  }
  if(hist.length===0) statusDiv.textContent = `Fehler: Keine historischen Daten für ${sym}`;
  return hist;
}

// ---------------------
// Debug-Funktion
// ---------------------
function debugLog(msg,data){
  console.log(msg,data||'');
  const debugDiv = document.getElementById("debug");
  if(debugDiv){
    const p = document.createElement("p");
    p.textContent = msg + (data ? ` -> ${JSON.stringify(data).substring(0,150)}...` : '');
    debugDiv.appendChild(p);
  }
}

// ---------------------
// KI-Prognosen
// ---------------------
function trendModel(hist){ return hist.at(-1) + (hist.at(-1)-hist[0])/hist.length*7; }
function momentumModel(hist){ return hist.at(-1) + (hist.at(-1)-hist.at(Math.max(0,hist.length-5)))*1.5; }
function volatilityModel(hist){ const avg = hist.reduce((a,b)=>a+b,0)/hist.length; return avg + (hist.at(-1)-avg)*0.5; }

async function ensemble(hist){
  const kiTrend = trendModel(hist);
  const kiMomentum = momentumModel(hist);
  const kiVol = volatilityModel(hist);
  const bestPrediction = (kiTrend+kiMomentum+kiVol)/3;
  return { kiTrend, kiMomentum, kiVol, bestPrediction };
}

// ---------------------
// Signale & Warnungen
// ---------------------
function getSignal(diff){ return diff>0.05?"KAUFEN":diff<-0.05?"VERKAUFEN":"HALTEN"; }
function getConfidence(diff){ return Math.abs(diff)>0.1?"Hoch":Math.abs(diff)>0.05?"Mittel":"Niedrig"; }
function checkWarnings(hist){
  if(hist.length<2) return "Keine akute Warnung";
  const lastReturn = (hist.at(-1)-hist[0])/hist[0];
  if(lastReturn>0.15) return "⚠️ Starker Anstieg prognostiziert!";
  if(lastReturn<-0.15) return "⚠️ Starker Rückgang prognostiziert!";
  return "Keine akute Warnung";
}

// ---------------------
// Chart
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
// Analyse
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
    drawChart(hist,ensemblePrediction);

    const now = new Date().toLocaleString();
    const diff = (ensemblePrediction.bestPrediction-live)/live;
    const sig = getSignal(diff);

    outTable.innerHTML=`
      <tr><td>Trend</td><td>${ensemblePrediction.kiTrend.toFixed(2)}</td><td>${getSignal((ensemblePrediction.kiTrend-live)/live)}</td><td>▲${(((ensemblePrediction.kiTrend-live)/live)*100).toFixed(1)}%</td><td>${getConfidence((ensemblePrediction.kiTrend-live)/live)}</td><td>${now}</td></tr>
      <tr><td>Momentum</td><td>${ensemblePrediction.kiMomentum.toFixed(2)}</td><td>${getSignal((ensemblePrediction.kiMomentum-live)/live)}</td><td>▲${(((ensemblePrediction.kiMomentum-live)/live)*100).toFixed(1)}%</td><td>${getConfidence((ensemblePrediction.kiMomentum-live)/live)}</td><td>${now}</td></tr>
      <tr><td>Volatilität</td><td>${ensemblePrediction.kiVol.toFixed(2)}</td><td>${getSignal((ensemblePrediction.kiVol-live)/live)}</td><td>▲${(((ensemblePrediction.kiVol-live)/live)*100).toFixed(1)}%</td><td>${getConfidence((ensemblePrediction.kiVol-live)/live)}</td><td>${now}</td></tr>
      <tr><td>Best Prediction</td><td>${ensemblePrediction.bestPrediction.toFixed(2)}</td><td>${sig}</td><td>▲${(diff*100).toFixed(1)}%</td><td>${getConfidence(diff)}</td><td>${now}</td></tr>
    `;

    progressBar.value=100; progressText.textContent="Fertig"; statusDiv.textContent="Analyse abgeschlossen";

  } finally { analysisRunning=false; }
}

// ---------------------
// DOM Setup
// ---------------------
document.addEventListener("DOMContentLoaded", async()=>{
  assetSelect=document.getElementById("assetSelect");
  analyseBtn=document.getElementById("analyseBtn");
  currentPriceDiv=document.getElementById("currentPrice");
  warningDiv=document.getElementById("warning");
  progressBar=document.getElementById("progressBar");
  progressText=document.getElementById("progressText");
  statusDiv=document.getElementById("status");
  outTable=document.getElementById("out");
  chartCanvas=document.getElementById("chart");

  // Assets laden
  ASSETS.push(...await getAllCryptos());
  ASSETS.forEach(a=>{
    const o=document.createElement("option");
    o.value=a.symbol;
    o.textContent=`${a.name} (${a.symbol})`;
    assetSelect.appendChild(o);
  });

  // Button Event
  analyseBtn.addEventListener("click", async()=>{ if(assetSelect.value) await runAnalysis(assetSelect.value); });

  // Automatische Startanalyse
  const randomAsset=getRandomAsset().symbol;
  assetSelect.value=randomAsset;
  await runAnalysis(randomAsset);
});
