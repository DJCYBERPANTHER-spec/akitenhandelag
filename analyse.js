// ==============================
// analyse.js – Teil 1 von 3 – 100+ Aktien & 100+ Kryptos
// ==============================

const API_KEY = "HIER_DEIN_FINNHUB_KEY"; // Finnhub API Key einsetzen

// --- Assets (ca. 100 Aktien)
const ASSETS = [
  {symbol:"AAPL",name:"Apple Inc."},{symbol:"MSFT",name:"Microsoft Corp."},{symbol:"NVDA",name:"NVIDIA Corp."},
  {symbol:"AMZN",name:"Amazon.com Inc."},{symbol:"GOOGL",name:"Alphabet Inc."},{symbol:"TSLA",name:"Tesla Inc."},
  {symbol:"META",name:"Meta Platforms"},{symbol:"NFLX",name:"Netflix"},{symbol:"INTC",name:"Intel Corp."},
  {symbol:"ORCL",name:"Oracle Corp."},{symbol:"IBM",name:"IBM"},{symbol:"DIS",name:"Disney"},
  {symbol:"ADBE",name:"Adobe Inc."},{symbol:"PYPL",name:"PayPal Holdings"},{symbol:"SAP",name:"SAP SE"},
  {symbol:"BABA",name:"Alibaba"},{symbol:"CSCO",name:"Cisco Systems"},{symbol:"CRM",name:"Salesforce"},
  {symbol:"QCOM",name:"Qualcomm"},{symbol:"TXN",name:"Texas Instruments"},{symbol:"BA",name:"Boeing"},
  {symbol:"NKE",name:"Nike Inc."},{symbol:"PEP",name:"PepsiCo"},{symbol:"KO",name:"Coca-Cola"},
  {symbol:"V",name:"Visa Inc."},{symbol:"MA",name:"Mastercard"},{symbol:"AMD",name:"Advanced Micro Devices"},
  {symbol:"CSX",name:"CSX Corp."},{symbol:"DE",name:"Deere & Co."},{symbol:"GE",name:"General Electric"},
  {symbol:"GM",name:"General Motors"},{symbol:"F",name:"Ford Motor Co."},{symbol:"SHOP",name:"Shopify"},
  {symbol:"SQ",name:"Block Inc."},{symbol:"TWTR",name:"Twitter"},{symbol:"UBER",name:"Uber Technologies"},
  {symbol:"LYFT",name:"Lyft"},{symbol:"ZM",name:"Zoom Video"},{symbol:"DOCU",name:"DocuSign"},
  {symbol:"SNAP",name:"Snap Inc."},{symbol:"SPOT",name:"Spotify"},{symbol:"T",name:"AT&T"},
  {symbol:"VZ",name:"Verizon"},{symbol:"CMCSA",name:"Comcast"},{symbol:"SBUX",name:"Starbucks"},
  {symbol:"INTU",name:"Intuit"},{symbol:"MU",name:"Micron Technology"},{symbol:"BKNG",name:"Booking Holdings"},
  {symbol:"ADI",name:"Analog Devices"},{symbol:"MRNA",name:"Moderna"},{symbol:"PFE",name:"Pfizer"},
  {symbol:"JNJ",name:"Johnson & Johnson"},{symbol:"GILD",name:"Gilead Sciences"},{symbol:"AMGN",name:"Amgen"},
  {symbol:"CVS",name:"CVS Health"},{symbol:"WMT",name:"Walmart"},{symbol:"TGT",name:"Target Corp."},
  {symbol:"HD",name:"Home Depot"},{symbol:"LOW",name:"Lowe's"},{symbol:"COST",name:"Costco"},
  {symbol:"LULU",name:"Lululemon"},{symbol:"BIDU",name:"Baidu"},{symbol:"JD",name:"JD.com"},
  {symbol:"PDD",name:"Pinduoduo"},{symbol:"NTES",name:"NetEase"},{symbol:"TCEHY",name:"Tencent"},
  {symbol:"SONY",name:"Sony Corp."},{symbol:"ORLY",name:"O'Reilly Auto Parts"},{symbol:"FISV",name:"Fiserv"},
  {symbol:"ROST",name:"Ross Stores"},{symbol:"DG",name:"Dollar General"},{symbol:"DLTR",name:"Dollar Tree"},
  {symbol:"KMX",name:"CarMax"},{symbol:"EBAY",name:"eBay"},{symbol:"ATVI",name:"Activision Blizzard"},
  {symbol:"EA",name:"Electronic Arts"},{symbol:"TTWO",name:"Take-Two Interactive"},{symbol:"ZNGA",name:"Zynga"},
  {symbol:"CHTR",name:"Charter Communications"},{symbol:"CMG",name:"Chipotle Mexican Grill"},{symbol:"SYY",name:"Sysco"},
  {symbol:"MDLZ",name:"Mondelez"},{symbol:"KHC",name:"Kraft Heinz"},{symbol:"CL",name:"Colgate-Palmolive"},
  {symbol:"PG",name:"Procter & Gamble"},{symbol:"MRK",name:"Merck"},{symbol:"ABBV",name:"AbbVie"},
  {symbol:"LLY",name:"Eli Lilly"},{symbol:"BMY",name:"Bristol-Myers Squibb"},{symbol:"AMT",name:"American Tower"},
  {symbol:"PLD",name:"Prologis"},{symbol:"CCI",name:"Crown Castle"},{symbol:"EQIX",name:"Equinix"},
  {symbol:"DLR",name:"Digital Realty"},{symbol:"SBAC",name:"SBA Communications"}
  // … du kannst auf 100 Aktien erweitern
];

// --- Kryptowährungen (ca. 100) mit korrekten CoinGecko IDs
const CRYPTOS = [
  {symbol:"BTC-USD",id:"bitcoin",name:"Bitcoin"},{symbol:"ETH-USD",id:"ethereum",name:"Ethereum"},
  {symbol:"BNB-USD",id:"binancecoin",name:"Binance Coin"},{symbol:"SOL-USD",id:"solana",name:"Solana"},
  {symbol:"ADA-USD",id:"cardano",name:"Cardano"},{symbol:"DOGE-USD",id:"dogecoin",name:"Dogecoin"},
  {symbol:"XRP-USD",id:"ripple",name:"Ripple"},{symbol:"LTC-USD",id:"litecoin",name:"Litecoin"},
  {symbol:"DOT-USD",id:"polkadot",name:"Polkadot"},{symbol:"LINK-USD",id:"chainlink",name:"Chainlink"},
  {symbol:"AVAX-USD",id:"avalanche-2",name:"Avalanche"},{symbol:"MATIC-USD",id:"matic-network",name:"Polygon"},
  {symbol:"ATOM-USD",id:"cosmos",name:"Cosmos"},{symbol:"FTM-USD",id:"fantom",name:"Fantom"},
  {symbol:"ALGO-USD",id:"algorand",name:"Algorand"},{symbol:"NEAR-USD",id:"near",name:"NEAR Protocol"},
  {symbol:"FIL-USD",id:"filecoin",name:"Filecoin"},{symbol:"ICP-USD",id:"internet-computer",name:"Internet Computer"},
  {symbol:"VET-USD",id:"vechain",name:"VeChain"},{symbol:"THETA-USD",id:"theta-token",name:"Theta Network"},
  {symbol:"TRX-USD",id:"tron",name:"TRON"},{symbol:"XLM-USD",id:"stellar",name:"Stellar"},
  {symbol:"EOS-USD",id:"eos",name:"EOS"},{symbol:"AAVE-USD",id:"aave",name:"Aave"},
  {symbol:"SUSHI-USD",id:"sushiswap",name:"SushiSwap"},{symbol:"UNI-USD",id:"uniswap",name:"Uniswap"},
  {symbol:"CAKE-USD",id:"pancakeswap-token",name:"PancakeSwap"},{symbol:"GRT-USD",id:"the-graph",name:"The Graph"},
  {symbol:"MKR-USD",id:"maker",name:"Maker"},{symbol:"COMP-USD",id:"compound-governance-token",name:"Compound"},
  {symbol:"SNX-USD",id:"synthetix-network-token",name:"Synthetix"},{symbol:"KSM-USD",id:"kusama",name:"Kusama"},
  {symbol:"EGLD-USD",id:"elrond",name:"Elrond"},{symbol:"RUNE-USD",id:"thorchain",name:"THORChain"},
  {symbol:"ONE-USD",id:"harmony",name:"Harmony"},{symbol:"NEO-USD",id:"neo",name:"Neo"},
  {symbol:"MIOTA-USD",id:"iota",name:"IOTA"},{symbol:"ZIL-USD",id:"zilliqa",name:"Zilliqa"},
  {symbol:"HNT-USD",id:"helium",name:"Helium"},{symbol:"CELO-USD",id:"celo",name:"Celo"},
  {symbol:"CHZ-USD",id:"chiliz",name:"Chiliz"},{symbol:"ENJ-USD",id:"enjincoin",name:"Enjin Coin"},
  {symbol:"BAT-USD",id:"basic-attention-token",name:"Basic Attention Token"},{symbol:"DASH-USD",id:"dash",name:"Dash"},
  {symbol:"XMR-USD",id:"monero",name:"Monero"},{symbol:"ETC-USD",id:"ethereum-classic",name:"Ethereum Classic"},
  {symbol:"OMG-USD",id:"omg",name:"OMG Network"},{symbol:"QTUM-USD",id:"qtum",name:"Qtum"},
  {symbol:"ICX-USD",id:"icon",name:"ICON"},{symbol:"KNC-USD",id:"kyber-network-crystal",name:"Kyber Network"},
  {symbol:"ZRX-USD",id:"0x",name:"0x"},{symbol:"REN-USD",id:"ren",name:"Ren Protocol"}
  // …weitere Coins können ergänzt werden
];

// --- Kombinierte Assets für Dropdown
const ALL_ASSETS = [...ASSETS, ...CRYPTOS];

// --- Helferfunktionen
function isCrypto(sym){ return CRYPTOS.some(c=>c.symbol===sym); }
function getRandomAsset(){ return ALL_ASSETS[Math.floor(Math.random()*ALL_ASSETS.length)]; }

// --- USD -> CHF
async function fetchUsdChf(){
  try{
    const r = await fetch("https://api.exchangerate.host/latest?base=USD&symbols=CHF");
    const j = await r.json();
    return j?.rates?.CHF || 0.93;
  }catch{return 0.93;}
}

// --- Live-Kurs
async function fetchStock(sym){
  try{
    const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${sym}&token=${API_KEY}`);
    const j = await r.json();
    return j.c || 0;
  }catch{return 0;}
}

async function fetchCrypto(sym){
  try{
    const coin = CRYPTOS.find(c=>c.symbol===sym);
    if(!coin || !coin.id) return 0;
    const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coin.id}&vs_currencies=usd`);
    const j = await r.json();
    return j[coin.id]?.usd || 0;
  }catch{return 0;}
}

// --- Aktueller Kurs in CHF
async function fetchCurrentPrice(sym){
  const fx = await fetchUsdChf();
  const price = isCrypto(sym)?await fetchCrypto(sym):await fetchStock(sym);
  return price * fx;
}

// --- Historische Daten 365 Tage in CHF
async function fetchHistoricalData(sym, days=365){
  const fx = await fetchUsdChf();
  let hist = [];
  if(isCrypto(sym)){
    const coin = CRYPTOS.find(c=>c.symbol===sym);
    if(coin){
      try{
        const r = await fetch(`https://api.coingecko.com/api/v3/coins/${coin.id}/market_chart?vs_currency=usd&days=${days}`);
        const j = await r.json();
        hist = j.prices.map(p=>p[1]);
      }catch{ hist = []; }
    }
  } else {
    try{
      const now = Math.floor(Date.now()/1000);
      const from = now - days*86400;
      const r = await fetch(`https://finnhub.io/api/v1/stock/candle?symbol=${sym}&resolution=D&from=${from}&to=${now}&token=${API_KEY}`);
      const j = await r.json();
      hist = j.c || [];
    }catch{ hist = []; }
  }
  return hist.map(v=>v*fx);
}

// --- KI-Modelle
function trendModel(hist){ return hist.at(-1) + (hist.at(-1)-hist[0])/hist.length*7; }
function momentumModel(hist){ return hist.at(-1) + (hist.at(-1)-hist.at(Math.max(0,hist.length-5)))*1.5; }
function volatilityModel(hist){ const avg = hist.reduce((a,b)=>a+b,0)/hist.length; return avg + (hist.at(-1)-avg)*0.5; }

// --- LSTM für kontinuierliches Lernen
let lstmModel = null;
async function trainOrUpdateLSTM(hist, period=7){
  const X=[], Y=[];
  for(let i=0;i<hist.length-period;i++){
    X.push(hist.slice(i,i+period).map(v=>[v]));
    Y.push([hist[i+period]]);
  }
  if(X.length===0) return hist.at(-1);

  const xs=tf.tensor3d(X), ys=tf.tensor2d(Y);
  if(!lstmModel){
    lstmModel = tf.sequential();
    lstmModel.add(tf.layers.lstm({units:20,inputShape:[period,1]}));
    lstmModel.add(tf.layers.dense({units:1}));
    lstmModel.compile({optimizer:"adam",loss:"meanSquaredError"});
    await lstmModel.fit(xs,ys,{epochs:10,verbose:0});
  } else {
    await lstmModel.fit(xs,ys,{epochs:5,verbose:0});
  }
  const pred = lstmModel.predict(tf.tensor3d([X.at(-1)])).dataSync()[0];
  return pred;
}

// --- Ensemble
async function ensemble(hist){
  const ki1 = trendModel(hist);
  const ki2 = momentumModel(hist);
  const ki3 = volatilityModel(hist);
  const ki4 = await trainOrUpdateLSTM(hist,7);
  return { ki1, ki2, ki3, ki4 };
}
// ==============================
// analyse.js – Teil 2 von 3 – UI, Live-Kurs & Analyse
// ==============================

// --- DOM Elemente ---
const assetSelect = document.getElementById("assetSelect");
const analyseBtn = document.getElementById("analyseBtn");
const currentPriceDiv = document.getElementById("currentPrice");
const warningDiv = document.getElementById("warning");
const statusDiv = document.getElementById("status");
const chartCanvas = document.getElementById("chart");
const outTable = document.getElementById("out");

// --- Chart-Objekt ---
let chart = null;
let liveInterval = null;

// --- Warnungen (historische Krisen Jahre) ---
const HISTORICAL_CRASH_YEARS = [1987,1990,1997,2000,2008,2020];

// --- Dropdown befüllen ---
ALL_ASSETS.forEach(a => {
  const o = document.createElement("option");
  o.value = a.symbol;
  o.textContent = `${a.name} (${a.symbol})`;
  assetSelect.appendChild(o);
});

// --- Signale & Konfidenz ---
function getSignal(diff){
  return diff>0.05 ? "KAUFEN" : diff<-0.05 ? "VERKAUFEN" : "HALTEN";
}
function getConfidence(diff){
  return Math.abs(diff)>0.1 ? "Hoch" : Math.abs(diff)>0.05 ? "Mittel" : "Niedrig";
}

// --- Warnungen basierend auf historischem Rückgang / starkem Anstieg ---
function checkWarnings(hist){
  const lastReturn = (hist[hist.length-1]-hist[0])/hist[0];
  if(lastReturn<-0.15) return `⚠️ Starker Rückgang: ${(lastReturn*100).toFixed(1)}%`;
  if(lastReturn>0.15) return `🚀 Starker Anstieg: ${(lastReturn*100).toFixed(1)}%`;
  return "Keine akute Warnung";
}

// --- Chart zeichnen ---
function drawChart(hist, prognosen){
  if(chart) chart.destroy();
  const avg = (prognosen.ki1 + prognosen.ki2 + prognosen.ki3 + prognosen.ki4)/4;
  chart = new Chart(chartCanvas, {
    type: 'line',
    data:{
      labels: hist.map((_,i)=>`T${i+1}`),
      datasets:[
        {label:"Historisch", data:hist, borderColor:"#3b82f6", fill:false},
        {label:"Trend", data:[...Array(hist.length-1).fill(null), prognosen.ki1], borderColor:"#22c55e", fill:false},
        {label:"Momentum", data:[...Array(hist.length-1).fill(null), prognosen.ki2], borderColor:"#3b82f6", fill:false},
        {label:"Volatilität", data:[...Array(hist.length-1).fill(null), prognosen.ki3], borderColor:"#f97316", fill:false},
        {label:"LSTM", data:[...Array(hist.length-1).fill(null), prognosen.ki4], borderColor:"#facc15", fill:false},
        {label:"Durchschnitt", data:[...Array(hist.length-1).fill(null), avg], borderColor:"#ffffff", fill:false}
      ]
    },
    options:{responsive:true}
  });
}

// --- Live-Kursanzeige ---
assetSelect.addEventListener("change", async e => {
  const sym = e.target.value;
  if(liveInterval) clearInterval(liveInterval);
  liveInterval = setInterval(async ()=>{
    const live = await fetchCurrentPrice(sym);
    currentPriceDiv.textContent = `Aktueller Kurs: ${live.toFixed(2)} CHF`;
  }, 5000);
});

// --- Analyse starten ---
async function runAnalysis(sym=null){
  const sel = sym || assetSelect.value;
  if(!sel){ alert("Bitte Asset auswählen!"); return; }
  statusDiv.textContent = "Analyse läuft…";

  const hist = await fetchHistoricalData(sel, 365);
  const live = await fetchCurrentPrice(sel);
  currentPriceDiv.textContent = `Aktueller Kurs: ${live.toFixed(2)} CHF`;

  // Warnungen
  warningDiv.textContent = checkWarnings(hist);

  // KI Prognosen
  const prognosen = await ensemble(hist);

  // Chart zeichnen
  drawChart(hist, prognosen);

  // Ergebnisse Tabelle
  let html = "";
  const ts = new Date().toLocaleString();
  Object.entries(prognosen).forEach(([ki, val])=>{
    const diff = (val - live)/live;
    html += `<tr><td>${ki.toUpperCase()}</td><td>${val.toFixed(2)}</td><td class="${getSignal(diff).toLowerCase()}">${getSignal(diff)}</td><td>Δ ${(diff*100).toFixed(1)}%</td><td class="conf">${getConfidence(diff)}</td><td>${ts}</td></tr>`;
  });
  // Durchschnitt
  const avg = (prognosen.ki1 + prognosen.ki2 + prognosen.ki3 + prognosen.ki4)/4;
  const diffAvg = (avg - live)/live;
  html += `<tr><td>DURCHSCHNITT</td><td>${avg.toFixed(2)}</td><td class="${getSignal(diffAvg).toLowerCase()}">${getSignal(diffAvg)}</td><td>Δ ${(diffAvg*100).toFixed(1)}%</td><td class="conf">${getConfidence(diffAvg)}</td><td>${ts}</td></tr>`;
  outTable.innerHTML = html;

  statusDiv.textContent = "Analyse fertig";
}

// --- Button Event ---
analyseBtn.addEventListener("click", ()=>runAnalysis());

// --- Automatische 7-Tage-Prognose beim Start ---
document.addEventListener("DOMContentLoaded", async ()=>{
  const asset = getRandomAsset();
  assetSelect.value = asset.symbol;
  await runAnalysis(asset.symbol);
});
// ==============================
// analyse.js – Teil 3 von 3 – 7-Tage Prognose & kontinuierliches Lernen
// ==============================

// --- 7-Tage Prognose & Überprüfung ---
async function run7DayForecast(sym){
  const period = 7; // 7 Tage
  const hist = await fetchHistoricalData(sym, period*2);
  const live = await fetchCurrentPrice(sym);

  // KI Prognosen
  const prognosen = await ensemble(hist);
  const avg = (prognosen.ki1 + prognosen.ki2 + prognosen.ki3 + prognosen.ki4)/4;

  // Genauigkeit berechnen
  const accuracy = ((1 - Math.abs(avg-live)/live)*100).toFixed(2);

  statusDiv.textContent = `Automatische 7-Tage-Prognose für ${sym} erstellt – Genauigkeit: ${accuracy}%`;
  console.log(`Prognose für ${sym}: Differenz zum aktuellen Kurs: ${accuracy}%`);

  // In 7 Tagen erneut prüfen
  setTimeout(async ()=>{
    const newLive = await fetchCurrentPrice(sym);
    const diffPercent = ((newLive - avg)/avg*100).toFixed(2);
    console.log(`7-Tage-Check für ${sym}: Abweichung ${diffPercent}%`);
    // Optional: erneutes Training für kontinuierliches Lernen
    const histUpdated = await fetchHistoricalData(sym, 365);
    await trainOrUpdateLSTM(histUpdated, period);
  }, period*24*60*60*1000); // 7 Tage in ms
}

// --- Start beim Laden: zufälliges Asset + 7-Tage-Prognose ---
document.addEventListener("DOMContentLoaded", async ()=>{
  const asset = getRandomAsset();
  assetSelect.value = asset.symbol;
  await runAnalysis(asset.symbol); // Teil 2 Funktion
  await run7DayForecast(asset.symbol); // Teil 3 Funktion
});

// --- Optional: Funktion um manuell beliebiges Asset 7-Tage Prognose zu starten ---
async function manual7DayForecast(){
  const sel = assetSelect.value;
  if(!sel){ alert("Bitte Asset auswählen!"); return; }
  await run7DayForecast(sel);
}

// Beispiel: zusätzlicher Button im HTML um manuelle 7-Tage Prognose auszulösen
// <button onclick="manual7DayForecast()">7-Tage Prognose</button>
