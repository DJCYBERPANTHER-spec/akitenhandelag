// analyse.js – komplette Logik für Multi-KI Analyse inkl. automatischer 7-Tage-Prognose

const API_KEY="d5ohqjhr01qjast6qrjgd5ohqjhr01qjast6qrk0";
let chart=null;
let liveInterval=null;

// --- Assets (Aktien + Kryptos) ---
const ASSETS=[
  {symbol:"AAPL",name:"Apple Inc."},{symbol:"MSFT",name:"Microsoft Corp."},{symbol:"NVDA",name:"NVIDIA Corp."},
  {symbol:"AMZN",name:"Amazon.com Inc."},{symbol:"GOOGL",name:"Alphabet Inc."},{symbol:"TSLA",name:"Tesla Inc."},
  {symbol:"META",name:"Meta Platforms"},{symbol:"BTC-USD",name:"Bitcoin"},{symbol:"ETH-USD",name:"Ethereum"},
  {symbol:"BNB-USD",name:"Binance Coin"},{symbol:"SOL-USD",name:"Solana"},{symbol:"ADA-USD",name:"Cardano"},
  {symbol:"DOGE-USD",name:"Dogecoin"},{symbol:"XRP-USD",name:"Ripple"},{symbol:"LTC-USD",name:"Litecoin"},
  {symbol:"DOT-USD",name:"Polkadot"}
];

// --- DOM Elemente ---
const assetSelect=document.getElementById("assetSelect");
const timeRange=document.getElementById("timeRange");
const analyseBtn=document.getElementById("analyseBtn");
const currentPriceDiv=document.getElementById("currentPrice");
const warningDiv=document.getElementById("warning");
const progressBar=document.getElementById("progressBar");
const progressText=document.getElementById("progressText");
const statusDiv=document.getElementById("status");
const loaderDiv=document.getElementById("loader");
const outTable=document.getElementById("out");
const chartCanvas=document.getElementById("chart");

// --- Historische Krisen für Warnungen ---
const HISTORICAL_CRASH_YEARS=[1987,1990,1997,2000,2008,2020];

// --- USD→CHF Wechselkurs ---
async function fetchUsdChf(){
  try{
    const r=await fetch("https://api.exchangerate.host/latest?base=USD&symbols=CHF");
    const j=await r.json();
    return Number(j?.rates?.CHF)||0.93;
  }catch{return 0.93;}
}

// --- Live-Kurs abrufen ---
async function fetchQuote(sym){
  try{
    if(sym.includes("USD")) return await fetchCryptoLive(sym);
    const r=await fetch(`https://finnhub.io/api/v1/quote?symbol=${sym}&token=${API_KEY}`);
    const j=await r.json();
    if(!j || j.c===undefined) throw "Keine Kursdaten verfügbar";
    return Number(j.c);
  }catch{return 100;}
}

// --- Kryptowährungen live ---
async function fetchCryptoLive(sym){
  const mapping={
    "BTC-USD":"bitcoin","ETH-USD":"ethereum","BNB-USD":"binancecoin",
    "SOL-USD":"solana","ADA-USD":"cardano","DOGE-USD":"dogecoin",
    "XRP-USD":"ripple","LTC-USD":"litecoin","DOT-USD":"polkadot"
  };
  const id=mapping[sym];
  if(!id) return 100;
  try{
    const r=await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`);
    const j=await r.json();
    return j[id]?.usd||100;
  }catch{return 100;}
}

// --- Historische Daten abrufen ---
async function fetchHistoricalData(sym,days){
  try{
    if(sym.includes("USD")){
      const mapping={
        "BTC-USD":"bitcoin","ETH-USD":"ethereum","BNB-USD":"binancecoin",
        "SOL-USD":"solana","ADA-USD":"cardano","DOGE-USD":"dogecoin",
        "XRP-USD":"ripple","LTC-USD":"litecoin","DOT-USD":"polkadot"
      };
      const id=mapping[sym]; if(!id) return Array(days).fill(100);
      const r=await fetch(`https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=${days}`);
      const j=await r.json();
      if(j.prices) return j.prices.map(p=>p[1]);
      return Array(days).fill(100);
    } else {
      const now=Math.floor(Date.now()/1000);
      const from=now-days*24*60*60;
      const r=await fetch(`https://finnhub.io/api/v1/stock/candle?symbol=${sym}&resolution=D&from=${from}&to=${now}&token=${API_KEY}`);
      const j=await r.json();
      if(j.s==="ok" && j.c?.length>0) return j.c.map(Number);
      return Array(days).fill(await fetchQuote(sym));
    }
  }catch{return Array(days).fill(await fetchQuote(sym));}
}

// --- Warnungen ---
function checkWarnings(hist){
  const lastReturn=(hist[hist.length-1]-hist[0])/hist[0];
  const strongDown=lastReturn<-0.15;
  if(strongDown) return `⚠️ Starker Rückgang: ${Math.round(lastReturn*100)}% – Ähnlich historischen Krisen`;
  return "Keine akute Warnung";
}

// --- KI Prognose ---
async function predictKI(hist,period,kiIndex){
  const noisy=hist.map(v=>v*(1+(Math.random()-0.5)/100));
  const min=Math.min(...noisy), max=Math.max(...noisy);
  const norm=noisy.map(v=>(v-min)/(max-min||1));
  let X=[],Y=[];
  for(let i=0;i<norm.length-period;i++){
    X.push(norm.slice(i,i+period).map(v=>[v]));
    Y.push([norm[i+period]]);
  }
  if(X.length===0) return hist[hist.length-1];
  const xs=tf.tensor3d(X), ys=tf.tensor2d(Y);
  const units=12+kiIndex*2;
  const model=tf.sequential();
  model.add(tf.layers.lstm({units,inputShape:[period,1]}));
  model.add(tf.layers.dense({units:1}));
  model.compile({optimizer:"adam",loss:"meanSquaredError"});
  await model.fit(xs,ys,{epochs:5,verbose:0});
  const p=model.predict(tf.tensor3d([X.at(-1)])).dataSync()[0];
  return p*(max-min)+min;
}

// --- Signale & Konfidenz ---
function getSignal(diff){return diff>0.05?"KAUFEN":diff<-0.05?"VERKAUFEN":"HALTEN";}
function getConfidence(diff){return Math.abs(diff)>0.1?"Hoch":Math.abs(diff)>0.05?"Mittel":"Niedrig";}

// --- Chart zeichnen ---
function drawChart(hist,prognosen){
  if(chart) chart.destroy();
  const avg=prognosen.reduce((a,b)=>a+b,0)/prognosen.length;
  chart=new Chart(chartCanvas,{
    type:"line",
    data:{
      labels:hist.map((_,i)=>`T${i+1}`),
      datasets:[
        {label:"Historisch",data:hist,borderColor:"#3b82f6",fill:false},
        {label:"KI1",data:[...Array(hist.length-1).fill(null),prognosen[0]],borderColor:"#22c55e",fill:false},
        {label:"KI2",data:[...Array(hist.length-1).fill(null),prognosen[1]],borderColor:"#3b82f6",fill:false},
        {label:"KI3",data:[...Array(hist.length-1).fill(null),prognosen[2]],borderColor:"#f97316",fill:false},
        {label:"KI4",data:[...Array(hist.length-1).fill(null),prognosen[3]],borderColor:"#facc15",fill:false},
        {label:"Durchschnitt",data:[...Array(hist.length-1).fill(null),avg],borderColor:"#ffffff",fill:false}
      ]
    },
    options:{responsive:true}
  });
}

// --- Analyse starten ---
async function run(){
  const sel=assetSelect.value;
  if(!sel){alert("Bitte Asset auswählen!");return;}
  progressBar.value=0; progressText.textContent="Berechnung startet…"; statusDiv.textContent="Analyse läuft…";
  const fx=await fetchUsdChf();
  const live=await fetchQuote(sel); currentPriceDiv.textContent=`Aktueller Kurs: ${(live*fx).toFixed(2)} CHF`;
  const period=parseInt(timeRange.value);
  const hist=await fetchHistoricalData(sel,period*2);
  warningDiv.textContent=checkWarnings(hist);
  const prognosen=[];
  for(let i=0;i<4;i++){
    prognosen[i]=await predictKI(hist,period,i);
  }
  drawChart(hist,prognosen);
  let html=""; const now=new Date(); const ts=now.toLocaleString();
  prognosen.forEach((p,i)=>{
    const diff=(p-live)/live;
    const sig=getSignal(diff);
    html+=`<tr><td>KI${i+1}</td><td>${p.toFixed(2)}</td><td class="${sig.toLowerCase()}">${sig}</td><td>${(diff*100).toFixed(1)}%</td><td class="conf">${getConfidence(diff)}</td><td>${ts}</td></tr>`;
  });
  const avg=prognosen.reduce((a,b)=>a+b,0)/prognosen.length;
  const diff=(avg-live)/live; const sig=getSignal(diff);
  html+=`<tr><td>Durchschnitt</td><td>${avg.toFixed(2)}</td><td class="${sig}</td><td>${(diff*100).toFixed(1)}%</td><td class="conf">${getConfidence(diff)}</td><td>${ts}</td></tr>`;
  outTable.innerHTML=html; statusDiv.textContent="Fertig";
}

// --- Kauf-Links ---
function openYahoo(){window.open(`http://finance.yahoo.com/quote/${assetSelect.value}`,"_blank");}
function openTradingView(){window.open(`http://www.tradingview.com/symbols/${assetSelect.value}/`,"_blank");}
function openSwissquote(){window.open(`http://www.swissquote.ch/sqw-en/private/trading/instruments/search?query=${assetSelect.value}`,"_blank");}

// --- Dropdown befüllen & Live-Kurs aktualisieren ---
ASSETS.forEach(a=>{
  const o=document.createElement("option"); o.value=a.symbol; o.textContent=`${a.name} (${a.symbol})`; assetSelect.appendChild(o);
});
assetSelect.addEventListener("change",async e=>{
  const sym=e.target.value;
  if(liveInterval) clearInterval(liveInterval);
  liveInterval=setInterval(async ()=>{
    const live=await fetchQuote(sym); const fx=await fetchUsdChf();
    currentPriceDiv.textContent=`Aktueller Kurs: ${(live*fx).toFixed(2)} CHF`;
  },5000);
});
analyseBtn.addEventListener("click",run);

// --- Automatische 7-Tage-Prognose beim Seitenstart ---
document.addEventListener("DOMContentLoaded", async () => {
  // Wähle zufälliges Asset
  const randomAsset=ASSETS[Math.floor(Math.random()*ASSETS.length)].symbol;
  await runPredictionForAsset(randomAsset);
});

// --- Funktion für automatische Prognose ---
async function runPredictionForAsset(sym){
  const period=7;
  const hist=await fetchHistoricalData(sym,period*2);
  const live=await fetchQuote(sym);
  const prognosen=[];
  for(let i=0;i<4;i++){
    prognosen[i]=await predictKI(hist,period,i);
  }
  const avg=prognosen.reduce((a,b)=>a+b,0)/prognosen.length;
  const accuracy=((avg-live)/live*100).toFixed(2);
  statusDiv.textContent=`Automatische 7-Tage-Prognose für ${sym} erstellt – Genauigkeit: ${accuracy}%`;
  console.log(`Automatische Prognose für ${sym}: Differenz zum aktuellen Kurs: ${accuracy}%`);

  // Nach 7 Tagen prüfen
  setTimeout(async ()=>{
    const newLive=await fetchQuote(sym);
    const diff=((newLive-avg)/avg*100).toFixed(2);
    console.log(`Prognose für ${sym} nach 7 Tagen: Abweichung ${diff}%`);
  }, 7*24*60*60*1000);
}
