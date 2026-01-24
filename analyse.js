// analyse.js – Multi-KI Analyse Profi-Level + Selbst-Analyse

const API_KEY = "d5ohqjhr01qjast6qrjgd5ohqjhr01qjast6qrk0";
let chart = null;
let liveIntervals = {};
let usdChfRate = 0.93;

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

// --- USD→CHF
async function fetchUsdChf(force=false){
  if(!force && usdChfRate!==0.93) return usdChfRate;
  try {
    const res = await fetch("https://api.exchangerate.host/latest?base=USD&symbols=CHF");
    const json = await res.json();
    usdChfRate = Number(json?.rates?.CHF) || 0.93;
    return usdChfRate;
  } catch { return 0.93; }
}

// --- Live-Kurs abrufen
async function fetchQuote(sym){
  try{
    if(sym.includes("USD")) return await fetchCryptoLive(sym);
    const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${sym}&token=${API_KEY}`);
    const json = await res.json();
    if(!json || json.c===undefined) throw "Keine Kursdaten";
    return Number(json.c);
  }catch{return 100;}
}

// --- Kryptowährungen live
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

// --- Historische Daten
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

// --- Warnungen generieren
function generateWarnings(hist, forecast){
  const lastReturn = (hist[hist.length-1]-hist[0])/hist[0];
  const maxForecast = Math.max(...forecast);
  let msg = [];
  if(lastReturn<-0.15) msg.push(`⚠️ Starker Rückgang historisch: ${Math.round(lastReturn*100)}%`);
  if(maxForecast/hist[hist.length-1]-1 > 0.10) msg.push(`🚀 Starker Anstieg prognostiziert: ${(maxForecast/hist[hist.length-1]*100-100).toFixed(1)}%`);
  return msg.length>0 ? msg.join(" | ") : "Keine akute Warnung";
}

// --- KI Prognose
async function predictKI(hist, period, kiIndex){
  try {
    const noisy = hist.map(v=>v*(1+(Math.random()-0.5)/100));
    const min = Math.min(...noisy), max = Math.max(...noisy);
    const norm = noisy.map(v=>(v-min)/(max-min||1));

    let X=[], Y=[];
    for(let i=0;i<norm.length-period;i++){X.push(norm.slice(i,i+period).map(v=>[v])); Y.push([norm[i+period]]);}
    if(X.length===0) return Array(7).fill(hist[hist.length-1]);

    const xs = tf.tensor3d(X), ys = tf.tensor2d(Y);
    const units = 16 + kiIndex*4;
    const model = tf.sequential();
    model.add(tf.layers.lstm({units,inputShape:[period,1],returnSequences:false}));
    model.add(tf.layers.dropout({rate:0.1}));
    model.add(tf.layers.dense({units:1}));
    model.compile({optimizer:tf.train.adam(0.01),loss:"meanSquaredError"});
    await model.fit(xs, ys, {epochs:15, verbose:0});

    let inputSeq = norm.slice(-period);
    let preds = [];
    for(let i=0;i<7;i++){
      const tensorInput = tf.tensor3d([inputSeq.map(v=>[v])]);
      const p = model.predict(tensorInput).dataSync()[0];
      preds.push(p*(max-min)+min);
      inputSeq = inputSeq.slice(1); inputSeq.push(p);
      tensorInput.dispose();
    }
    xs.dispose(); ys.dispose(); model.dispose();
    return preds;
  } catch { return Array(7).fill(hist[hist.length-1]); }
}

// --- Signale
function getSignal(diff){ return diff>0.05?"buy":diff<-0.05?"sell":"hold"; }
function getConfidence(diff){ return Math.abs(diff)>0.1?"Hoch":Math.abs(diff)>0.05?"Mittel":"Niedrig"; }

// --- Chart
function drawChart(hist, allPrognosen){
  if(chart) chart.destroy();
  const avg = Array(7).fill(0).map((_,i)=>allPrognosen.reduce((sum,p)=>sum+p[i],0)/allPrognosen.length);
  chart = new Chart(chartCanvas,{
    type:'line',
    data:{
      labels: hist.map((_,i)=>`T${i+1}`).concat(['T+1','T+2','T+3','T+4','T+5','T+6','T+7']),
      datasets:[
        {label:"Historisch",data:hist,borderColor:"#3b82f6",fill:false,tension:0.2},
        ...allPrognosen.map((p,i)=>({
          label:`KI${i+1}`,
          data:Array(hist.length).fill(null).concat(p),
          borderColor:["#22c55e","#3b82f6","#f97316","#facc15"][i],
          fill:false,tension:0.3
        })),
        {label:"Durchschnitt",data:Array(hist.length).fill(null).concat(avg),borderColor:"#ffffff",fill:false,borderWidth:2,tension:0.3}
      ]
    },
    options:{responsive:true}
  });
}

// --- Analyse starten (Multi-Asset + eigene Analysen)
async function run(){
  const sel = assetSelect.value;
  if(!sel){alert("Bitte Asset auswählen!"); return;}
  statusDiv.textContent="Analyse läuft…"; loaderDiv.textContent="KI trainiert…";
  progressBar.value=0; progressText.textContent="0%";

  const fx = await fetchUsdChf();
  const live = await fetchQuote(sel);
  currentPriceDiv.textContent=`Aktueller Kurs: ${(live*fx).toFixed(2)} CHF`;

  const period = parseInt(timeRange.value);
  const hist = await fetchHistoricalData(sel, period*2);

  const allPrognosen = [];
  for(let i=0;i<4;i++){
    progressText.textContent=`KI${i+1} läuft…`;
    allPrognosen[i] = await predictKI(hist, period, i);
    progressBar.value = ((i+1)/4*100).toFixed(0);
  }

  warningDiv.textContent = generateWarnings(hist, allPrognosen.flat());

  drawChart(hist, allPrognosen);

  const ts = new Date().toLocaleString();

  allPrognosen.forEach((p,i)=>{
    const diff = p[0]-live;
    const arrow = diff>0 ? '▲' : diff<0 ? '▼' : '→';
    const sig = getSignal(diff/live);
    const row = `<tr>
      <td>KI${i+1} (${sel})</td>
      <td>${p[0].toFixed(2)}</td>
      <td class="${sig}">${sig.toUpperCase()}</td>
      <td>${arrow} ${(diff/live*100).toFixed(1)}%</td>
      <td class="conf">${getConfidence(diff/live)}</td>
      <td>${ts}</td>
    </tr>`;
    outTable.insertAdjacentHTML('beforeend', row);
  });

  const avg = Array(7).fill(0).map((_,i)=>allPrognosen.reduce((sum,p)=>sum+p[i],0)/allPrognosen.length);
  const diffAvg = avg[0]-live;
  const arrowAvg = diffAvg>0 ? '▲' : diffAvg<0 ? '▼' : '→';
  const sigAvg = getSignal(diffAvg/live);
  const avgRow = `<tr>
    <td>Durchschnitt (${sel})</td>
    <td>${avg[0].toFixed(2)}</td>
    <td class="${sigAvg}">${sigAvg.toUpperCase()}</td>
    <td>${arrowAvg} ${(diffAvg/live*100).toFixed(1)}%</td>
    <td class="conf">${getConfidence(diffAvg/live)}</td>
    <td>${ts}</td>
  </tr>`;
  outTable.insertAdjacentHTML('beforeend', avgRow);

  statusDiv.textContent="Fertig"; loaderDiv.textContent="–"; progressText.textContent="100%";
}

// --- Dropdown + Live-Kurs für alle Assets
ASSETS.forEach(a=>{
  const o=document.createElement("option"); o.value=a.symbol; o.textContent=`${a.name} (${a.symbol})`;
  assetSelect.appendChild(o);
});

assetSelect.addEventListener("change", async e=>{
  const sym = e.target.value;
  if(liveIntervals[sym]) clearInterval(liveIntervals[sym]);
  const fx = await fetchUsdChf();
  liveIntervals[sym] = setInterval(async ()=>{
    const newLive = await fetchQuote(sym);
    const oldPrice = parseFloat(currentPriceDiv.dataset.last || newLive);
    currentPriceDiv.style.color = newLive>oldPrice ? '#22c55e' : newLive<oldPrice ? '#ef4444' : '#e5e7eb';
    currentPriceDiv.textContent = `Aktueller Kurs: ${(newLive*fx).toFixed(2)} CHF`;
    currentPriceDiv.dataset.last = newLive;
  },5000);
});

// --- Automatische Prognose beim Start
document.addEventListener("DOMContentLoaded", async ()=>{
  const randomAsset = ASSETS[Math.floor(Math.random()*ASSETS.length)].symbol;
  assetSelect.value = randomAsset;
  await run();
});

// Analyse-Button
analyseBtn.addEventListener("click", run);
