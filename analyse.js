// ==============================
// analyse.js – Finale Version: Multi-KI Analyse mit 365 Tagen Historie
// ==============================

const API_KEY = "HIER_DEIN_FINNHUB_KEY"; // Finnhub API Key einsetzen

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

// --- Helfer
function isCrypto(sym){ return sym.includes("USD"); }
function getRandomAsset(){ return ASSETS[Math.floor(Math.random()*ASSETS.length)]; }

// --- Live-Kurs
async function fetchQuote(sym){
  try{
    if(isCrypto(sym)){
      const map = { "BTC-USD":"bitcoin","ETH-USD":"ethereum","BNB-USD":"binancecoin","SOL-USD":"solana","ADA-USD":"cardano","DOGE-USD":"dogecoin","XRP-USD":"ripple","LTC-USD":"litecoin","DOT-USD":"polkadot","LINK-USD":"chainlink","AVAX-USD":"avalanche-2","MATIC-USD":"matic-network","ATOM-USD":"cosmos","FTM-USD":"fantom","ALGO-USD":"algorand"};
      const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${map[sym]}&vs_currencies=usd`);
      const j = await r.json();
      return j[map[sym]]?.usd || 0;
    } else {
      const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${sym}&token=${API_KEY}`);
      const j = await r.json();
      return j.c || 0;
    }
  }catch(e){ console.error(e); return 0; }
}

// --- Historische Daten (365 Tage)
async function fetchHistory(sym, days=365){
  try{
    if(isCrypto(sym)){
      const map = { "BTC-USD":"bitcoin","ETH-USD":"ethereum","BNB-USD":"binancecoin","SOL-USD":"solana","ADA-USD":"cardano","DOGE-USD":"dogecoin","XRP-USD":"ripple","LTC-USD":"litecoin","DOT-USD":"polkadot","LINK-USD":"chainlink","AVAX-USD":"avalanche-2","MATIC-USD":"matic-network","ATOM-USD":"cosmos","FTM-USD":"fantom","ALGO-USD":"algorand" };
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
  }catch(e){ console.error(e); return []; }
}

// --- KI Modelle
function trendModel(hist){ return hist.at(-1) + (hist.at(-1)-hist[0])/hist.length*7; }
function momentumModel(hist){ return hist.at(-1) + (hist.at(-1)-hist.at(Math.max(0,hist.length-5)))*1.5; }
function volatilityModel(hist){ const avg = hist.reduce((a,b)=>a+b,0)/hist.length; return avg + (hist.at(-1)-avg)*0.5; }

// --- LSTM (kontinuierliches Lernen)
async function trainLSTM(hist, period=7, key="default"){
  const X=[],Y=[];
  for(let i=0;i<hist.length-period;i++){
    X.push(hist.slice(i,i+period).map(v=>[v]));
    Y.push([hist[i+period]]);
  }
  if(X.length===0) return hist.at(-1);
  const xs=tf.tensor3d(X), ys=tf.tensor2d(Y);
  const model=tf.sequential();
  model.add(tf.layers.lstm({units:20,inputShape:[period,1]}));
  model.add(tf.layers.dense({units:1}));
  model.compile({optimizer:"adam",loss:"meanSquaredError"});
  await model.fit(xs,ys,{epochs:10,verbose:0});
  const pred = model.predict(tf.tensor3d([X.at(-1)])).dataSync()[0];
  return pred;
}

// --- Ensemble
async function ensemble(hist, assetKey){
  const ki1=trendModel(hist);
  const ki2=momentumModel(hist);
  const ki3=volatilityModel(hist);
  const ki4=await trainLSTM(hist,7,assetKey);
  return {ki1,ki2,ki3,ki4};
}

// --- UI & Analyse
document.addEventListener("DOMContentLoaded", async ()=>{
  const assetSelect=document.getElementById("assetSelect");
  const analyseBtn=document.getElementById("analyseBtn");
  const currentPriceDiv=document.getElementById("currentPrice");
  const warningDiv=document.getElementById("warning");
  const statusDiv=document.getElementById("status");
  const chartCanvas=document.getElementById("chart");
  const outTable=document.getElementById("out");
  let chart=null, liveInterval=null;

  // --- Dropdown füllen
  assetSelect.innerHTML="";
  ASSETS.forEach(a=>{
    const o=document.createElement("option");
    o.value=a.symbol;
    o.textContent=`${a.name} (${a.symbol})`;
    assetSelect.appendChild(o);
  });
  assetSelect.value=getRandomAsset().symbol;

  // --- Live-Kurs Update
  async function updateLivePrice(sym){
    const live = await fetchQuote(sym);
    currentPriceDiv.textContent=`Aktueller Kurs: ${live.toFixed(2)} ${isCrypto(sym)?"USD":"CHF"}`;
  }

  assetSelect.addEventListener("change", async e=>{
    const sym=e.target.value;
    if(liveInterval) clearInterval(liveInterval);
    await updateLivePrice(sym);
    liveInterval=setInterval(()=>updateLivePrice(sym),5000);
  });

  // --- Signal & Konfidenz
  function getSignal(val, live){ const diff=(val-live)/live; return diff>0.05?"KAUFEN":diff<-0.05?"VERKAUFEN":"HALTEN"; }
  function getConfidence(val, live){ const diff=Math.abs((val-live)/live); return diff>0.1?"Hoch":diff>0.05?"Mittel":"Niedrig"; }

  // --- Warnung bei starkem Anstieg
  function strongRiseWarning(preds, live){
    const maxPred = Math.max(...Object.values(preds));
    if((maxPred-live)/live>0.15) return `⚠️ Stark steigender Trend prognostiziert! Δ ${(maxPred-live)/live*100|0}%`;
    return "Keine akute Warnung";
  }

  // --- Chart zeichnen
  function drawChart(hist,preds){
    if(chart) chart.destroy();
    const avg=Object.values(preds).reduce((a,b)=>a+b,0)/4;
    chart=new Chart(chartCanvas,{
      type:"line",
      data:{
        labels:hist.map((_,i)=>`T${i+1}`),
        datasets:[
          {label:"Historisch", data:hist, borderColor:"#3b82f6", fill:false},
          {label:"KI1", data:[...Array(hist.length-1).fill(null),preds.ki1], borderColor:"#22c55e", fill:false},
          {label:"KI2", data:[...Array(hist.length-1).fill(null),preds.ki2], borderColor:"#3b82f6", fill:false},
          {label:"KI3", data:[...Array(hist.length-1).fill(null),preds.ki3], borderColor:"#f97316", fill:false},
          {label:"KI4", data:[...Array(hist.length-1).fill(null),preds.ki4], borderColor:"#facc15", fill:false},
          {label:"Durchschnitt", data:[...Array(hist.length-1).fill(null),avg], borderColor:"#ffffff", fill:false}
        ]
      },
      options:{responsive:true}
    });
  }

  // --- Analyse starten
  async function runAnalysis(assetSym){
    const sym = assetSym || assetSelect.value;
    statusDiv.textContent="Analyse läuft…";
    const hist=await fetchHistory(sym,365);
    if(hist.length===0){ statusDiv.textContent="Keine historischen Daten verfügbar"; return; }
    const live = await fetchQuote(sym);
    updateLivePrice(sym);
    const preds=await ensemble(hist,sym);
    drawChart(hist,preds);
    warningDiv.textContent=strongRiseWarning(preds,live);

    const now=new Date().toLocaleString();
    const avg=Object.values(preds).reduce((a,b)=>a+b,0)/4;

    const rows=Object.entries(preds).map(([ki,val])=>{
      const sig=getSignal(val,live);
      const conf=getConfidence(val,live);
      const diff=((val-live)/live*100).toFixed(1);
      return `<tr><td>${ki.toUpperCase()}</td><td>${val.toFixed(2)}</td><td class="${sig.includes("KAUFEN")?"buy":sig.includes("VERKAUFEN")?"sell":"hold"}">${sig}</td><td>${diff}%</td><td class="conf">${conf}</td><td>${now}</td></tr>`;
    });
    const diffAvg=((avg-live)/live*100).toFixed(1);
    const sigAvg=getSignal(avg,live);
    const confAvg=getConfidence(avg,live);
    rows.push(`<tr><td>DURCHSCHNITT</td><td>${avg.toFixed(2)}</td><td class="${sigAvg.includes("KAUFEN")?"buy":sigAvg.includes("VERKAUFEN")?"sell":"hold"}">${sigAvg}</td><td>${diffAvg}%</td><td class="conf">${confAvg}</td><td>${now}</td></tr>`);
    outTable.innerHTML=rows.join("");
    statusDiv.textContent="Analyse abgeschlossen";

    // --- 7-Tage Check
    setTimeout(async ()=>{
      const newLive=await fetchQuote(sym);
      const diff7=((newLive-avg)/avg*100).toFixed(2);
      console.log(`7-Tage Check für ${sym}: Abweichung ${diff7}%`);
    },7*24*60*60*1000);
  }

  analyseBtn.addEventListener("click",()=>runAnalysis());

  // --- Start-Prognose direkt beim Laden
  await runAnalysis(assetSelect.value);

  // --- Kauf-Links
  window.openYahoo=()=>window.open(`https://finance.yahoo.com/quote/${assetSelect.value}`,"_blank");
  window.openTradingView=()=>window.open(`https://www.tradingview.com/symbols/${assetSelect.value}/`,"_blank");
  window.openSwissquote=()=>window.open(`https://www.swissquote.ch/sqw-en/private/trading/instruments/search?query=${assetSelect.value}`,"_blank");
});
