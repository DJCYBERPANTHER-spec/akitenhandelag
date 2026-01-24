// ==============================
// analyse_crypto.js – Teil 1/3 – Krypto Assets & Datenabruf
// ==============================

// Krypto Assets
const CRYPTOS = [
  {symbol:"BTC-USD",name:"Bitcoin"},
  {symbol:"ETH-USD",name:"Ethereum"},
  {symbol:"BNB-USD",name:"Binance Coin"},
  {symbol:"SOL-USD",name:"Solana"},
  {symbol:"ADA-USD",name:"Cardano"},
  {symbol:"DOGE-USD",name:"Dogecoin"},
  {symbol:"XRP-USD",name:"Ripple"},
  {symbol:"LTC-USD",name:"Litecoin"},
  {symbol:"DOT-USD",name:"Polkadot"},
  {symbol:"LINK-USD",name:"Chainlink"},
  {symbol:"AVAX-USD",name:"Avalanche"},
  {symbol:"MATIC-USD",name:"Polygon"},
  {symbol:"ATOM-USD",name:"Cosmos"},
  {symbol:"FTM-USD",name:"Fantom"},
  {symbol:"ALGO-USD",name:"Algorand"},
  {symbol:"NEAR-USD",name:"NEAR Protocol"},
  {symbol:"FIL-USD",name:"Filecoin"},
  {symbol:"ICP-USD",name:"Internet Computer"},
  {symbol:"VET-USD",name:"VeChain"},
  {symbol:"THETA-USD",name:"Theta Network"},
  {symbol:"TRX-USD",name:"TRON"},
  {symbol:"XLM-USD",name:"Stellar"},
  {symbol:"EOS-USD",name:"EOS"},
  {symbol:"AAVE-USD",name:"Aave"},
  {symbol:"SUSHI-USD",name:"SushiSwap"},
  {symbol:"UNI-USD",name:"Uniswap"},
  {symbol:"CAKE-USD",name:"PancakeSwap"},
  {symbol:"GRT-USD",name:"The Graph"},
  {symbol:"MKR-USD",name:"Maker"},
  {symbol:"COMP-USD",name:"Compound"},
  {symbol:"SNX-USD",name:"Synthetix"},
  {symbol:"KSM-USD",name:"Kusama"},
  {symbol:"EGLD-USD",name:"Elrond"},
  {symbol:"RUNE-USD",name:"THORChain"},
  {symbol:"ONE-USD",name:"Harmony"},
  {symbol:"NEO-USD",name:"Neo"},
  {symbol:"MIOTA-USD",name:"IOTA"},
  {symbol:"ZIL-USD",name:"Zilliqa"},
  {symbol:"HNT-USD",name:"Helium"},
  {symbol:"CELO-USD",name:"Celo"},
  {symbol:"CHZ-USD",name:"Chiliz"},
  {symbol:"ENJ-USD",name:"Enjin Coin"},
  {symbol:"BAT-USD",name:"Basic Attention Token"},
  {symbol:"DASH-USD",name:"Dash"},
  {symbol:"XMR-USD",name:"Monero"},
  {symbol:"ETC-USD",name:"Ethereum Classic"},
  {symbol:"OMG-USD",name:"OMG Network"},
  {symbol:"QTUM-USD",name:"Qtum"},
  {symbol:"ICX-USD",name:"ICON"},
  {symbol:"KNC-USD",name:"Kyber Network"},
  {symbol:"ZRX-USD",name:"0x"},
  {symbol:"REN-USD",name:"Ren Protocol"}
  // …weitere Kryptos falls benötigt
];

// DOM Elemente
const assetSelect = document.getElementById("assetSelect");
const analyseBtn = document.getElementById("analyseBtn");
const currentPriceDiv = document.getElementById("currentPrice");
const warningDiv = document.getElementById("warning");
const statusDiv = document.getElementById("status");
const chartCanvas = document.getElementById("chart");
const outTable = document.getElementById("out");

let chart = null;
let liveInterval = null;

// Hilfsfunktionen
function isCrypto(sym){ return CRYPTOS.some(c=>c.symbol===sym); }
function getRandomCrypto(){ return CRYPTOS[Math.floor(Math.random()*CRYPTOS.length)]; }

// Dropdown füllen
CRYPTOS.forEach(c=>{
  const opt = document.createElement("option");
  opt.value = c.symbol;
  opt.textContent = `${c.name} (${c.symbol})`;
  assetSelect.appendChild(opt);
});

// USD -> CHF
async function fetchUsdChf(){
  try{
    const r = await fetch("https://api.exchangerate.host/latest?base=USD&symbols=CHF");
    const j = await r.json();
    return j?.rates?.CHF || 0.93;
  }catch{return 0.93;}
}

// Krypto live Kurs
async function fetchCrypto(sym){
  try{
    const id = CRYPTOS.find(c=>c.symbol===sym).name.toLowerCase().replace(/\s/g,'');
    const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`);
    const j = await r.json();
    return j[id]?.usd || 0;
  }catch{return 0;}
}

// Aktueller Kurs in CHF
async function fetchCurrentPrice(sym){
  const fx = await fetchUsdChf();
  const price = await fetchCrypto(sym);
  return price * fx;
}

// Historische Daten in CHF
async function fetchHistoricalData(sym, days=365){
  const fx = await fetchUsdChf();
  let hist = [];
  const id = CRYPTOS.find(c=>c.symbol===sym).name.toLowerCase().replace(/\s/g,'');
  try{
    const r = await fetch(`https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=${days}`);
    const j = await r.json();
    hist = j.prices.map(p=>p[1]);
  }catch{ hist = []; }
  return hist.map(v=>v*fx);
}
// ==============================
// analyse_crypto.js – Teil 2/3 – KI-Modelle & Prognosen
// ==============================

let lstmModel = null;

// -----------------
// KI-Modelle
// -----------------

// Trend-Modell: Linearer Trend
function trendModel(hist, period=7){
  const start = hist[0];
  const end = hist.at(-1);
  return end + (end-start)/hist.length * period;
}

// Momentum-Modell: Neueste Bewegung verstärken
function momentumModel(hist, period=7){
  const start = hist.at(Math.max(0, hist.length-5));
  const end = hist.at(-1);
  return end + (end-start)*1.5;
}

// Volatilität-Modell: Durchschnitt + letzte Bewegung
function volatilityModel(hist){
  const avg = hist.reduce((a,b)=>a+b,0)/hist.length;
  return avg + (hist.at(-1)-avg)*0.5;
}

// LSTM-Modell: Kontinuierliches Lernen
async function trainOrUpdateLSTM(hist, period=7){
  const X=[], Y=[];
  for(let i=0;i<hist.length-period;i++){
    X.push(hist.slice(i,i+period).map(v=>[v]));
    Y.push([hist[i+period]]);
  }
  if(X.length===0) return hist.at(-1);

  const xs = tf.tensor3d(X);
  const ys = tf.tensor2d(Y);

  if(!lstmModel){
    lstmModel = tf.sequential();
    lstmModel.add(tf.layers.lstm({units:20, inputShape:[period,1]}));
    lstmModel.add(tf.layers.dense({units:1}));
    lstmModel.compile({optimizer:"adam", loss:"meanSquaredError"});
    await lstmModel.fit(xs, ys, {epochs:20, verbose:0});
  } else {
    await lstmModel.fit(xs, ys, {epochs:5, verbose:0});
  }

  const pred = lstmModel.predict(tf.tensor3d([X.at(-1)])).dataSync()[0];
  return pred;
}

// -----------------
// Ensemble Funktion: alle KIs kombinieren
// -----------------
async function ensemble(hist, period=7){
  const ki1 = trendModel(hist, period);
  const ki2 = momentumModel(hist, period);
  const ki3 = volatilityModel(hist);
  const ki4 = await trainOrUpdateLSTM(hist, period);
  return {ki1, ki2, ki3, ki4};
}

// -----------------
// Prognosen für verschiedene Zeiträume
// -----------------
async function generateForecasts(sym){
  const periods = {
    "24h": 1,
    "1 Monat": 30,
    "3 Monate": 90,
    "6 Monate": 180,
    "1 Jahr": 365,
    "3 Jahre": 365*3,
    "5 Jahre": 365*5,
    "10 Jahre": 365*10
  };

  const results = {};
  for(const [label, days] of Object.entries(periods)){
    const hist = await fetchHistoricalData(sym, Math.min(days, 365)); // max 365 Tage für Historie
    const ensembleResult = await ensemble(hist, Math.min(days, 30));
    // Durchschnittliche Prognose der 4 KIs
    results[label] = (ensembleResult.ki1 + ensembleResult.ki2 + ensembleResult.ki3 + ensembleResult.ki4)/4;
  }

  return results;
}

// -----------------
// Signal & Konfidenz
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
// ==============================
// analyse_crypto.js – Teil 3/3 – UI, Chart & Analyse
// ==============================

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
const progressBar = document.getElementById("progressBar");
const progressText = document.getElementById("progressText");

let chart = null;
let liveInterval = null;

// -----------------
// Dropdown befüllen
// -----------------
CRYPTOS.forEach(c=>{
  const opt = document.createElement("option");
  opt.value = c.symbol;
  opt.textContent = `${c.name} (${c.symbol})`;
  assetSelect.appendChild(opt);
});

// -----------------
// Chart zeichnen
// -----------------
function drawChart(hist, forecasts){
  if(chart) chart.destroy();
  const labels = hist.map((_,i)=>`T${i+1}`);
  const avgForecast = Object.values(forecasts)[0]; // für Anzeige aktueller Wert
  chart = new Chart(chartCanvas, {
    type:"line",
    data:{
      labels,
      datasets:[
        {label:"Historisch", data:hist, borderColor:"#3b82f6", fill:false},
        {label:"KI-Prognose", data:[...Array(hist.length-1).fill(null), avgForecast], borderColor:"#22c55e", fill:false}
      ]
    },
    options:{responsive:true}
  });
}

// -----------------
// Analyse ausführen
// -----------------
async function runAnalysis(sym){
  statusDiv.textContent = "Analyse läuft…";
  progressBar.value = 0;
  progressText.textContent = "Daten abrufen…";

  const hist = await fetchHistoricalData(sym, 365);
  const currentPrice = await fetchCurrentPrice(sym);
  currentPriceDiv.textContent = `Aktueller Kurs: ${currentPrice.toFixed(2)} CHF`;
  warningDiv.textContent = checkWarnings(hist);
  progressBar.value = 30;
  progressText.textContent = "KI-Prognosen berechnen…";

  const forecasts = await generateForecasts(sym);
  progressBar.value = 70;
  progressText.textContent = "Chart und Tabelle aktualisieren…";

  drawChart(hist, forecasts);

  // Tabelle aktualisieren
  const now = new Date().toLocaleString();
  const html = Object.entries(forecasts).map(([period,val])=>{
    const diff = (val - currentPrice)/currentPrice;
    return `<tr>
      <td>${period}</td>
      <td>${val.toFixed(2)}</td>
      <td class="${getSignalClass(diff)}">${getSignal(diff)}</td>
      <td>Δ ${(diff*100).toFixed(1)}%</td>
      <td class="conf">${getConfidence(diff)}</td>
      <td>${now}</td>
    </tr>`;
  }).join('');
  outTable.innerHTML = html;

  progressBar.value = 100;
  progressText.textContent = "Analyse abgeschlossen";
  statusDiv.textContent = "Bereit";
}

// -----------------
// Event Listener
// -----------------
analyseBtn.addEventListener("click", async ()=>{
  const sym = assetSelect.value;
  if(!sym) { alert("Bitte Kryptowährung auswählen!"); return; }
  await runAnalysis(sym);
});

// -----------------
// Live-Update: aktueller Preis alle 5s
// -----------------
assetSelect.addEventListener("change", async e=>{
  if(liveInterval) clearInterval(liveInterval);
  const sym = e.target.value;
  liveInterval = setInterval(async ()=>{
    const price = await fetchCurrentPrice(sym);
    currentPriceDiv.textContent = `Aktueller Kurs: ${price.toFixed(2)} CHF`;
  }, 5000);
});

// -----------------
// Automatische Analyse beim Start
// -----------------
document.addEventListener("DOMContentLoaded", async ()=>{
  const randomAsset = CRYPTOS[Math.floor(Math.random()*CRYPTOS.length)];
  assetSelect.value = randomAsset.symbol;
  await runAnalysis(randomAsset.symbol);
});
