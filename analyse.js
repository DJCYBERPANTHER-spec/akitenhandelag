// ==============================
// analyse.js – Teil 1: Kernlogik & Dropdown + Multi-KI
// ==============================

// --- API Key
const API_KEY = "d5ohqjhr01qjast6qrjgd5ohqjhr01qjast6qrk0"; // Finnhub API Key einsetzen

// --- Assets (Aktien + Kryptos)
const ASSETS = [
  { symbol: "AAPL", name: "Apple" }, { symbol: "MSFT", name: "Microsoft" },
  { symbol: "NVDA", name: "Nvidia" }, { symbol: "AMZN", name: "Amazon" },
  { symbol: "GOOGL", name: "Alphabet" }, { symbol: "META", name: "Meta" },
  { symbol: "TSLA", name: "Tesla" },
  { symbol: "BTC-USD", name: "Bitcoin" }, { symbol: "ETH-USD", name: "Ethereum" },
  { symbol: "BNB-USD", name: "Binance Coin" }, { symbol: "SOL-USD", name: "Solana" },
  { symbol: "ADA-USD", name: "Cardano" }, { symbol: "XRP-USD", name: "Ripple" },
  { symbol: "DOGE-USD", name: "Dogecoin" }, { symbol: "LTC-USD", name: "Litecoin" },
  { symbol: "DOT-USD", name: "Polkadot" }, { symbol: "LINK-USD", name: "Chainlink" }
];

// --- Hilfsfunktionen
function getRandomAsset(){ return ASSETS[Math.floor(Math.random()*ASSETS.length)]; }
function isCrypto(sym){ return sym.includes("USD"); }

// --- Live-Kurs abrufen
async function fetchQuote(sym){
  try{
    if(isCrypto(sym)){
      const map = {
        "BTC-USD":"bitcoin","ETH-USD":"ethereum","BNB-USD":"binancecoin",
        "SOL-USD":"solana","ADA-USD":"cardano","XRP-USD":"ripple",
        "DOGE-USD":"dogecoin","LTC-USD":"litecoin","DOT-USD":"polkadot","LINK-USD":"chainlink"
      };
      const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${map[sym]}&vs_currencies=usd`);
      const j = await r.json();
      return j[map[sym]]?.usd || 0;
    } else {
      const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${sym}&token=${API_KEY}`);
      const j = await r.json();
      return j.c || 0;
    }
  }catch(e){ console.error("fetchQuote error:", e); return 0; }
}

// --- Historische Daten abrufen
async function fetchHistory(sym, days=60){
  try{
    if(isCrypto(sym)){
      const map = {
        "BTC-USD":"bitcoin","ETH-USD":"ethereum","BNB-USD":"binancecoin",
        "SOL-USD":"solana","ADA-USD":"cardano","XRP-USD":"ripple",
        "DOGE-USD":"dogecoin","LTC-USD":"litecoin","DOT-USD":"polkadot","LINK-USD":"chainlink"
      };
      const r = await fetch(`https://api.coingecko.com/api/v3/coins/${map[sym]}/market_chart?vs_currency=usd&days=${days}`);
      const j = await r.json();
      return j.prices.map(p=>p[1]);
    } else {
      const now = Math.floor(Date.now()/1000);
      const from = now - days*86400;
      const r = await fetch(`https://finnhub.io/api/v1/stock/candle?symbol=${sym}&resolution=D&from=${from}&to=${now}&token=${API_KEY}`);
      const j = await r.json();
      return j.c || [];
    }
  }catch(e){ console.error("fetchHistory error:", e); return []; }
}

// --- Klassische Modelle
function trendModel(p){ return p.at(-1) + (p.at(-1)-p[0])/p.length*7; }
function momentumModel(p){ return p.at(-1) + (p.at(-1)-p.at(Math.max(0,p.length-5)))*1.5; }
function volatilityModel(p){ 
  const avg = p.reduce((a,b)=>a+b,0)/p.length; 
  return avg + (p.at(-1)-avg)*0.5; 
}

// --- LSTM Modell (kontinuierliches Lernen)
async function trainLSTM(hist, period=7, assetKey="default"){
  const tfHist = hist.map(v=>[v]);
  let X=[], Y=[];
  for(let i=0;i<tfHist.length-period;i++){
    X.push(tfHist.slice(i,i+period));
    Y.push([tfHist[i+period][0]]);
  }
  if(X.length===0) return hist.at(-1);

  const xs = tf.tensor3d(X);
  const ys = tf.tensor2d(Y);

  const model = tf.sequential();
  model.add(tf.layers.lstm({units:20,inputShape:[period,1]}));
  model.add(tf.layers.dense({units:1}));
  model.compile({optimizer:"adam",loss:"meanSquaredError"});

  // Gewichte aus localStorage laden
  try{ await model.loadWeights(`localstorage://${assetKey}_lstm`); }catch(e){}

  await model.fit(xs,ys,{epochs:10,verbose:0});

  const lastX = tf.tensor3d([tfHist.slice(-period)]);
  const pred = model.predict(lastX).dataSync()[0];

  await model.save(`localstorage://${assetKey}_lstm`);

  return pred;
}

// --- Ensemble Funktion
async function ensemble(hist, assetKey){
  const ki1 = trendModel(hist);
  const ki2 = momentumModel(hist);
  const ki3 = volatilityModel(hist);
  const ki4 = await trainLSTM(hist,7,assetKey);
  return {ki1, ki2, ki3, ki4};
}

// --- Signal & Konfidenz
function getSignal(pred, live){
  const diff = (pred-live)/live;
  if(diff>0.05) return "KAUFEN 🔼";
  if(diff<-0.05) return "VERKAUFEN 🔽";
  return "HALTEN ⏺";
}
function getConfidence(pred, live){
  const diff = Math.abs((pred-live)/live);
  return diff>0.1?"Hoch":diff>0.05?"Mittel":"Niedrig";
}

// --- Warnungen
function strongRiseWarning(preds, live){
  const avg = (preds.ki1+preds.ki2+preds.ki3+preds.ki4)/4;
  if((avg-live)/live*100>15) return "⚠️ Starker Anstieg prognostiziert!";
  if((avg-live)/live*100<-15) return "⚠️ Starker Rückgang prognostiziert!";
  return "Keine Warnung";
}

// --- Chart
function drawChart(hist, preds, chartCanvas){
  if(window.chart) window.chart.destroy();
  const avg = (preds.ki1+preds.ki2+preds.ki3+preds.ki4)/4;
  window.chart = new Chart(chartCanvas,{
    type:"line",
    data:{
      labels: hist.map((_,i)=>`T${i+1}`),
      datasets:[
        {label:"Historisch",data:hist,borderColor:"#3b82f6",fill:false},
        {label:"KI Ø",data:[...Array(hist.length-1).fill(null),avg],borderColor:"#22c55e",fill:false}
      ]
    },
    options:{responsive:true}
  });
}

// --- Dropdown füllen
function fillDropdown(){
  const assetSelect = document.getElementById("assetSelect");
  if(!assetSelect) return;
  assetSelect.innerHTML = "";
  ASSETS.forEach(a => {
    const option = document.createElement("option");
    option.value = a.symbol;
    option.textContent = `${a.name} (${a.symbol})`;
    assetSelect.appendChild(option);
  });
  const randomAsset = getRandomAsset();
  assetSelect.value = randomAsset.symbol;
}
// ==============================
// analyse.js – Teil 2: UI, Analyse starten, 7-Tage-Check, Tabelle, Kauf-Links
// ==============================

document.addEventListener("DOMContentLoaded", async () => {
  fillDropdown(); // Dropdown korrekt füllen

  const assetSelect = document.getElementById("assetSelect");
  const analyseBtn = document.getElementById("analyseBtn");
  const currentPriceDiv = document.getElementById("currentPrice");
  const warningDiv = document.getElementById("warning");
  const statusDiv = document.getElementById("status");
  const chartCanvas = document.getElementById("chart");
  const outTable = document.getElementById("out");

  let liveInterval = null;

  // --- Live-Kurs aktualisieren
  async function updateLivePrice(sym){
    const live = await fetchQuote(sym);
    currentPriceDiv.textContent = `Aktueller Kurs: ${live.toFixed(2)} ${isCrypto(sym)?"USD":"CHF"}`;
  }

  assetSelect.addEventListener("change", async (e)=>{
    const sym = e.target.value;
    if(liveInterval) clearInterval(liveInterval);
    await updateLivePrice(sym);
    liveInterval = setInterval(()=>updateLivePrice(sym),5000);
  });

  // --- Analyse starten
  async function runAnalysis(assetSym){
    const sym = assetSym || assetSelect.value;
    statusDiv.textContent = "Analyse läuft…";
    const live = await fetchQuote(sym);
    const hist = await fetchHistory(sym,60);

    const preds = await ensemble(hist, sym);
    drawChart(hist, preds, chartCanvas);
    warningDiv.textContent = strongRiseWarning(preds, live);

    const now = new Date().toLocaleString();
    const avg = (preds.ki1 + preds.ki2 + preds.ki3 + preds.ki4)/4;

    const rows = Object.entries(preds).map(([ki,val])=>{
      const sig = getSignal(val, live);
      const conf = getConfidence(val, live);
      const diff = ((val-live)/live*100).toFixed(1);
      return `<tr>
        <td>${ki.toUpperCase()}</td>
        <td>${val.toFixed(2)}</td>
        <td class="${sig.includes("KAUFEN")?"buy":sig.includes("VERKAUFEN")?"sell":"hold"}">${sig}</td>
        <td>${diff}%</td>
        <td class="conf">${conf}</td>
        <td>${now}</td>
      </tr>`;
    });

    const diffAvg = ((avg-live)/live*100).toFixed(1);
    const sigAvg = getSignal(avg, live);
    const confAvg = getConfidence(avg, live);
    rows.push(`<tr>
      <td>DURCHSCHNITT</td>
      <td>${avg.toFixed(2)}</td>
      <td class="${sigAvg.includes("KAUFEN")?"buy":sigAvg.includes("VERKAUFEN")?"sell":"hold"}">${sigAvg}</td>
      <td>${diffAvg}%</td>
      <td class="conf">${confAvg}</td>
      <td>${now}</td>
    </tr>`);

    outTable.innerHTML = rows.join("");
    statusDiv.textContent = "Analyse abgeschlossen";

    // --- 7-Tage Check
    setTimeout(async ()=>{
      const newLive = await fetchQuote(sym);
      const diff7 = ((newLive - avg)/avg*100).toFixed(2);
      console.log(`7-Tage Check für ${sym}: Abweichung ${diff7}%`);
    },7*24*60*60*1000);
  }

  analyseBtn.addEventListener("click",()=>runAnalysis());

  // --- Start-Prognose direkt beim Laden
  await runAnalysis(assetSelect.value);

  // --- Kauf-Links
  window.openYahoo = ()=>window.open(`https://finance.yahoo.com/quote/${assetSelect.value}`,"_blank");
  window.openTradingView = ()=>window.open(`https://www.tradingview.com/symbols/${assetSelect.value}/`,"_blank");
  window.openSwissquote = ()=>window.open(`https://www.swissquote.ch/sqw-en/private/trading/instruments/search?query=${assetSelect.value}`,"_blank");
});
