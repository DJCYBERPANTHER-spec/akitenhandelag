// analyse.js – Profi-Version mit interaktivem Chart & UI
const API_KEY = "d5ohqjhr01qjast6qrjgd5ohqjhr01qjast6qrk0";
let chart = null;
let liveInterval = null;
let usdChfRate = 0.93;

// DOM Elemente
const assetSelect = document.getElementById("assetSelect");
const timeRange = document.getElementById("timeRange");
const analyseBtn = document.getElementById("analyseBtn");
const currentPriceDiv = document.getElementById("currentPrice");
const warningDiv = document.getElementById("warning");
const progressBar = document.getElementById("progressBar");
const progressText = document.getElementById("progressText");
const statusDiv = document.getElementById("status");
const loaderDiv = document.getElementById("loader");
const outTable = document.getElementById("out");
const chartCanvas = document.getElementById("chart");

const ASSETS = [
  {symbol:"AAPL",name:"Apple Inc."},{symbol:"MSFT",name:"Microsoft Corp."},{symbol:"NVDA",name:"NVIDIA Corp."},
  {symbol:"AMZN",name:"Amazon.com Inc."},{symbol:"GOOGL",name:"Alphabet Inc."},{symbol:"TSLA",name:"Tesla Inc."},
  {symbol:"META",name:"Meta Platforms"},{symbol:"BTC-USD",name:"Bitcoin"},{symbol:"ETH-USD",name:"Ethereum"},
  {symbol:"BNB-USD",name:"Binance Coin"},{symbol:"SOL-USD",name:"Solana"},{symbol:"ADA-USD",name:"Cardano"},
  {symbol:"DOGE-USD",name:"Dogecoin"},{symbol:"XRP-USD",name:"Ripple"},{symbol:"LTC-USD",name:"Litecoin"},
  {symbol:"DOT-USD",name:"Polkadot"}
];

// Utility Funktionen
async function fetchUsdChf(force=false){
  if(!force && usdChfRate!==0.93) return usdChfRate;
  try{
    const res = await fetch("https://api.exchangerate.host/latest?base=USD&symbols=CHF");
    const json = await res.json();
    usdChfRate = Number(json?.rates?.CHF) || 0.93;
    return usdChfRate;
  }catch{return 0.93;}
}

async function fetchQuote(sym){
  try{
    if(sym.includes("USD")) return await fetchCryptoLive(sym);
    const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${sym}&token=${API_KEY}`);
    const json = await res.json();
    if(!json || json.c===undefined) throw "Keine Kursdaten";
    return Number(json.c);
  }catch{return 100;}
}

async function fetchCryptoLive(sym){
  const mapping = {
    "BTC-USD":"bitcoin","ETH-USD":"ethereum","BNB-USD":"binancecoin",
    "SOL-USD":"solana","ADA-USD":"cardano","DOGE-USD":"dogecoin",
    "XRP-USD":"ripple","LTC-USD":"litecoin","DOT-USD":"polkadot"
  };
  const id = mapping[sym]; if(!id) return 100;
  try{
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`);
    const json = await res.json();
    return json[id]?.usd || 100;
  }catch{return 100;}
}

async function fetchHistoricalData(sym,days){
  try{
    if(sym.includes("USD")){
      const mapping = {
        "BTC-USD":"bitcoin","ETH-USD":"ethereum","BNB-USD":"binancecoin",
        "SOL-USD":"solana","ADA-USD":"cardano","DOGE-USD":"dogecoin",
        "XRP-USD":"ripple","LTC-USD":"litecoin","DOT-USD":"polkadot"
      };
      const id = mapping[sym]; if(!id) return Array(days).fill(100);
      const res = await fetch(`https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=${days}`);
      const json = await res.json();
      if(json.prices) return json.prices.map(p=>p[1]);
      return Array(days).fill(100);
    } else {
      const now = Math.floor(Date.now()/1000);
      const from = now-days*24*60*60;
      const res = await fetch(`https://finnhub.io/api/v1/stock/candle?symbol=${sym}&resolution=D&from=${from}&to=${now}&token=${API_KEY}`);
      const json = await res.json();
      if(json.s==="ok" && json.c?.length>0) return json.c.map(Number);
      return Array(days).fill(await fetchQuote(sym));
    }
  }catch{return Array(days).fill(await fetchQuote(sym));}
}

function checkWarnings(hist){
  const lastReturn = (hist[hist.length-1]-hist[0])/hist[0];
  return lastReturn<-0.15 ? `⚠️ Starker Rückgang: ${Math.round(lastReturn*100)}%` : "Keine akute Warnung";
}

async function predictKI(hist,period,kiIndex){
  try{
    const noisy = hist.map(v=>v*(1+(Math.random()-0.5)/100));
    const min = Math.min(...noisy), max = Math.max(...noisy);
    const norm = noisy.map(v=>(v-min)/(max-min||1));
    let X=[],Y=[];
    for(let i=0;i<norm.length-period;i++){
      X.push(norm.slice(i,i+period).map(v=>[v]));
      Y.push([norm[i+period]]);
    }
    if(X.length===0) return hist[hist.length-1];
    const xs = tf.tensor3d(X), ys = tf.tensor2d(Y);
    const units = 8 + kiIndex*2;
    const model = tf.sequential();
    model.add(tf.layers.lstm({units,inputShape:[period,1]}));
    model.add(tf.layers.dense({units:1}));
    model.compile({optimizer:"adam",loss:"meanSquaredError"});
    await model.fit(xs,ys,{epochs:5,verbose:0});
    const pred = model.predict(tf.tensor3d([X.at(-1)])).dataSync()[0];
    xs.dispose(); ys.dispose(); model.dispose();
    return pred*(max-min)+min;
  }catch{return hist[hist.length-1];}
}

function getSignal(diff){return diff>0.05?"buy":diff<-0.05?"sell":"hold";}
function getConfidence(diff){return Math.abs(diff)>0.1?"Hoch":Math.abs(diff)>0.05?"Mittel":"Niedrig";}

// --- Chart zeichnen mit Tooltips & Hover ---
function drawChart(hist,prognosen){
  if(chart) chart.destroy();
  const avg = prognosen.reduce((a,b)=>a+b,0)/prognosen.length;
  chart = new Chart(chartCanvas,{
    type:"line",
    data:{
      labels:hist.map((_,i)=>`T${i+1}`),
      datasets:[
        {label:"Historisch",data:hist,borderColor:"#3b82f6",fill:false,tension:0.2},
        {label:"KI1",data:[...Array(hist.length-1).fill(null),prognosen[0]],borderColor:"#22c55e",fill:false,tension:0.3},
        {label:"KI2",data:[...Array(hist.length-1).fill(null),prognosen[1]],borderColor:"#3b82f6",fill:false,tension:0.3},
        {label:"KI3",data:[...Array(hist.length-1).fill(null),prognosen[2]],borderColor:"#f97316",fill:false,tension:0.3},
        {label:"KI4",data:[...Array(hist.length-1).fill(null),prognosen[3]],borderColor:"#facc15",fill:false,tension:0.3},
        {label:"Durchschnitt",data:[...Array(hist.length-1).fill(null),avg],borderColor:"#ffffff",fill:false,borderWidth:2,tension:0.3}
      ]
    },
    options:{
      responsive:true,
      plugins:{tooltip:{mode:'index',intersect:false}},
      interaction:{mode:'nearest',axis:'x',intersect:false},
      scales:{y:{beginAtZero:false}}
    }
  });
}

// --- Analyse starten mit Fortschritt ---
async function run(){
  const sel = assetSelect.value;
  if(!sel){alert("Bitte Asset auswählen!"); return;}
  statusDiv.textContent="Analyse läuft…"; loaderDiv.textContent="KI trainiert…";
  progressBar.value = 0; progressText.textContent="0%";

  const fx = await fetchUsdChf();
  const live = await fetchQuote(sel);
  currentPriceDiv.textContent = `Aktueller Kurs: ${(live*fx).toFixed(2)} CHF`;

  const period = parseInt(timeRange.value);
  const hist = await fetchHistoricalData(sel,period*2);
  warningDiv.textContent = checkWarnings(hist);

  const prognosen = [];
  for(let i=0;i<4;i++){
    progressText.textContent = `KI${i+1} läuft…`;
    prognosen[i] = await predictKI(hist,period,i);
    progressBar.value = ((i+1)/4*100).toFixed(0);
  }

  drawChart(hist,prognosen);

  let html = "";
  const ts = new Date().toLocaleString();
  prognosen.forEach((p,i)=>{
    const diff = (p-live)/live;
    const sig = getSignal(diff);
    html+=`<tr>
      <td>KI${i+1}</td>
      <td>${p.toFixed(2)}</td>
      <td class="${sig}">${sig.toUpperCase()}</td>
      <td>${(diff*100).toFixed(1)}%</td>
      <td class="conf">${getConfidence(diff)}</td>
      <td>${ts}</td>
    </tr>`;
  });

  const avg = prognosen.reduce((a,b)=>a+b,0)/prognosen.length;
  const diffAvg = (avg-live)/live;
  const sigAvg = getSignal(diffAvg);
  html += `<tr>
    <td>Durchschnitt</td>
    <td>${avg.toFixed(2)}</td>
    <td class="${sigAvg}">${sigAvg.toUpperCase()}</td>
    <td>${(diffAvg*100).toFixed(1)}%</td>
    <td class="conf">${getConfidence(diffAvg)}</td>
    <td>${ts}</td>
  </tr>`;
  outTable.innerHTML = html;

  statusDiv.textContent="Fertig"; loaderDiv.textContent="–"; progressText.textContent="100%";
}

// --- Kauf-Links ---
function openYahoo(){window.open(`http://finance.yahoo.com/quote/${assetSelect.value}`,"_blank");}
function openTradingView(){window.open(`http://www.tradingview.com/symbols/${assetSelect.value}/`,"_blank");}
function openSwissquote(){window.open(`http://www.swissquote.ch/sqw-en/private/trading/instruments/search?query=${assetSelect.value}`,"_blank");}

// --- Dropdown & Live-Update ---
ASSETS.forEach(a=>{
  const o = document.createElement("option");
  o.value = a.symbol; o.textContent = `${a.name} (${a.symbol})`;
  assetSelect.appendChild(o);
});

assetSelect.addEventListener("change", async e=>{
  const sym = e.target.value;
  if(liveInterval) clearInterval(liveInterval);
  const fx = await fetchUsdChf();
  liveInterval = setInterval(async ()=>{
    const newLive = await fetchQuote(sym);
    const oldPrice = parseFloat(currentPriceDiv.dataset.last || newLive);
    const color = newLive>oldPrice ? '#22c55e' : newLive<oldPrice ? '#ef4444' : '#e5e7eb';
    currentPriceDiv.style.color = color;
    currentPriceDiv.textContent = `Aktueller Kurs: ${(newLive*fx).toFixed(2)} CHF`;
    currentPriceDiv.dataset.last = newLive;
  },5000);
});

// --- Automatische Prognose beim Start ---
document.addEventListener("DOMContentLoaded", async ()=>{
  const randomAsset = ASSETS[Math.floor(Math.random()*ASSETS.length)].symbol;
  assetSelect.value = randomAsset;
  await run();
});
