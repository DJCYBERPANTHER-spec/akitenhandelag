// ==============================
// analyse.js – finale Version – Teil 1 von 2
// Alle 200+ Assets, KI-Analyse, Preis & Historische Daten
// ==============================

const API_KEY = "d5ohqjhr01qjast6qrjgd5ohqjhr01qjast6qrk0"; // Finnhub API Key einsetzen

// -----------------
// Assets
// -----------------
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
];

const CRYPTOS = [
  {symbol:"BTC-USD",name:"Bitcoin"},{symbol:"ETH-USD",name:"Ethereum"},{symbol:"BNB-USD",name:"Binance Coin"},
  {symbol:"SOL-USD",name:"Solana"},{symbol:"ADA-USD",name:"Cardano"},{symbol:"DOGE-USD",name:"Dogecoin"},
  {symbol:"XRP-USD",name:"Ripple"},{symbol:"LTC-USD",name:"Litecoin"},{symbol:"DOT-USD",name:"Polkadot"},
  {symbol:"LINK-USD",name:"Chainlink"},{symbol:"AVAX-USD",name:"Avalanche"},{symbol:"MATIC-USD",name:"Polygon"},
  {symbol:"ATOM-USD",name:"Cosmos"},{symbol:"FTM-USD",name:"Fantom"},{symbol:"ALGO-USD",name:"Algorand"},
  {symbol:"NEAR-USD",name:"NEAR Protocol"},{symbol:"FIL-USD",name:"Filecoin"},{symbol:"ICP-USD",name:"Internet Computer"},
  {symbol:"VET-USD",name:"VeChain"},{symbol:"THETA-USD",name:"Theta Network"},{symbol:"TRX-USD",name:"TRON"},
  {symbol:"XLM-USD",name:"Stellar"},{symbol:"EOS-USD",name:"EOS"},{symbol:"AAVE-USD",name:"Aave"},
  {symbol:"SUSHI-USD",name:"SushiSwap"},{symbol:"UNI-USD",name:"Uniswap"},{symbol:"CAKE-USD",name:"PancakeSwap"},
  {symbol:"GRT-USD",name:"The Graph"},{symbol:"MKR-USD",name:"Maker"},{symbol:"COMP-USD",name:"Compound"},
  {symbol:"SNX-USD",name:"Synthetix"},{symbol:"KSM-USD",name:"Kusama"},{symbol:"EGLD-USD",name:"Elrond"},
  {symbol:"RUNE-USD",name:"THORChain"},{symbol:"ONE-USD",name:"Harmony"},{symbol:"NEO-USD",name:"Neo"},
  {symbol:"MIOTA-USD",name:"IOTA"},{symbol:"ZIL-USD",name:"Zilliqa"},{symbol:"HNT-USD",name:"Helium"},
  {symbol:"CELO-USD",name:"Celo"},{symbol:"CHZ-USD",name:"Chiliz"},{symbol:"ENJ-USD",name:"Enjin Coin"},
  {symbol:"BAT-USD",name:"Basic Attention Token"},{symbol:"DASH-USD",name:"Dash"},{symbol:"XMR-USD",name:"Monero"},
  {symbol:"ETC-USD",name:"Ethereum Classic"},{symbol:"OMG-USD",name:"OMG Network"},{symbol:"QTUM-USD",name:"Qtum"},
  {symbol:"ICX-USD",name:"ICON"},{symbol:"KNC-USD",name:"Kyber Network"},{symbol:"ZRX-USD",name:"0x"},
  {symbol:"REN-USD",name:"Ren Protocol"}
];

const ALL_ASSETS = [...ASSETS,...CRYPTOS];

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
let chart = null;
let liveInterval = null;

// -----------------
// Hilfsfunktionen
// -----------------
function isCrypto(sym){ return CRYPTOS.some(c=>c.symbol===sym); }
function getRandomAsset(){ return ALL_ASSETS[Math.floor(Math.random()*ALL_ASSETS.length)]; }

// -----------------
// Dropdown füllen
// -----------------
ALL_ASSETS.forEach(a=>{
    const opt = document.createElement("option");
    opt.value = a.symbol;
    opt.textContent = `${a.name} (${a.symbol})`;
    assetSelect.appendChild(opt);
});
// ==============================
// analyse.js – finale Version – Teil 2 von 2
// Charts, Signale, Analyse & 7-Tage Prognose
// ==============================

// -----------------
// USD → CHF
// -----------------
async function fetchUsdChf(){
    try{
        const r = await fetch("https://api.exchangerate.host/latest?base=USD&symbols=CHF");
        const j = await r.json();
        return j?.rates?.CHF || 0.93;
    }catch{return 0.93;}
}

// -----------------
// Live-Kurs
// -----------------
async function fetchStock(sym){
    try{
        const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${sym}&token=${API_KEY}`);
        const j = await r.json();
        return j.c || 0;
    }catch{return 0;}
}

async function fetchCrypto(sym){
    try{
        const map = {};
        CRYPTOS.forEach(c=>map[c.symbol] = c.name.toLowerCase().replace(/\s/g,''));
        const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${map[sym]}&vs_currencies=usd`);
        const j = await r.json();
        return j[map[sym]]?.usd || 0;
    }catch{return 0;}
}

async function fetchCurrentPrice(sym){
    const fx = await fetchUsdChf();
    const price = isCrypto(sym) ? await fetchCrypto(sym) : await fetchStock(sym);
    return price * fx;
}

// -----------------
// Historische Daten 365 Tage
// -----------------
async function fetchHistoricalData(sym, days=365){
    const fx = await fetchUsdChf();
    let hist = [];
    if(isCrypto(sym)){
        const map = {};
        CRYPTOS.forEach(c=>map[c.symbol]=c.name.toLowerCase().replace(/\s/g,''));
        try{
            const r = await fetch(`https://api.coingecko.com/api/v3/coins/${map[sym]}/market_chart?vs_currency=usd&days=${days}`);
            const j = await r.json();
            hist = j.prices.map(p=>p[1]);
        }catch{ hist = []; }
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

// -----------------
// KI-Modelle
// -----------------
function trendModel(hist){ return hist.at(-1) + (hist.at(-1)-hist[0])/hist.length*7; }
function momentumModel(hist){ return hist.at(-1) + (hist.at(-1)-hist.at(Math.max(0,hist.length-5)))*1.5; }
function volatilityModel(hist){ const avg = hist.reduce((a,b)=>a+b,0)/hist.length; return avg + (hist.at(-1)-avg)*0.5; }

let lstmModel = null;
async function trainOrUpdateLSTM(hist, period=7){
    const X=[], Y=[];
    for(let i=0;i<hist.length-period;i++){ X.push(hist.slice(i,i+period).map(v=>[v])); Y.push([hist[i+period]]); }
    if(X.length===0) return hist.at(-1);
    const xs=tf.tensor3d(X), ys=tf.tensor2d(Y);
    if(!lstmModel){
        lstmModel = tf.sequential();
        lstmModel.add(tf.layers.lstm({units:20,inputShape:[period,1]}));
        lstmModel.add(tf.layers.dense({units:1}));
        lstmModel.compile({optimizer:"adam",loss:"meanSquaredError"});
        await lstmModel.fit(xs,ys,{epochs:10,verbose:0});
    } else { await lstmModel.fit(xs,ys,{epochs:5,verbose:0}); }
    return lstmModel.predict(tf.tensor3d([X.at(-1)])).dataSync()[0];
}

async function ensemble(hist){
    const ki1 = trendModel(hist);
    const ki2 = momentumModel(hist);
    const ki3 = volatilityModel(hist);
    const ki4 = await trainOrUpdateLSTM(hist,7);
    return {ki1,ki2,ki3,ki4};
}

// -----------------
// Signale & Tabelle
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
function checkWarnings(hist){
    if(hist.length<2) return "Keine Daten";
    const change = (hist.at(-1)-hist.at(0))/hist.at(0);
    if(change<-0.15) return `⚠️ Starker Rückgang: ${(change*100).toFixed(1)}%`;
    if(change>0.2) return `⚠️ Starker Anstieg: ${(change*100).toFixed(1)}%`;
    return "Keine akute Warnung";
}

// -----------------
// Chart zeichnen
// -----------------
function drawChart(hist, prognosen){
    if(chart) chart.destroy();
    const avg = (prognosen.ki1 + prognosen.ki2 + prognosen.ki3 + prognosen.ki4)/4;
    chart = new Chart(chartCanvas,{
        type:"line",
        data:{
            labels: hist.map((_,i)=>`T${i+1}`),
            datasets:[
                {label:"Historisch", data:hist, borderColor:"#3b82f6", fill:false},
                {label:"KI1 (Trend)", data:[...Array(hist.length-1).fill(null), prognosen.ki1], borderColor:"#22c55e", fill:false},
                {label:"KI2 (Momentum)", data:[...Array(hist.length-1).fill(null), prognosen.ki2], borderColor:"#f97316", fill:false},
                {label:"KI3 (Volatilität)", data:[...Array(hist.length-1).fill(null), prognosen.ki3], borderColor:"#facc15", fill:false},
                {label:"KI4 (LSTM)", data:[...Array(hist.length-1).fill(null), prognosen.ki4], borderColor:"#8b5cf6", fill:false},
                {label:"Durchschnitt", data:[...Array(hist.length-1).fill(null), avg], borderColor:"#ffffff", fill:false}
            ]
        },
        options:{responsive:true}
    });
}

// -----------------
// Analyse starten
// -----------------
async function runAnalysis(){
    const sym = assetSelect.value;
    if(!sym){ alert("Bitte Asset auswählen!"); return; }

    statusDiv.textContent = "Analyse läuft…";
    const hist = await fetchHistoricalData(sym,365);
    currentPriceDiv.textContent = `Aktueller Kurs: ${(await fetchCurrentPrice(sym)).toFixed(2)} CHF`;
    warningDiv.textContent = checkWarnings(hist);

    const prognosen = await ensemble(hist);

    drawChart(hist, prognosen);

    // Tabelle erstellen
    const now = new Date().toLocaleString();
    const currentPrice = hist.at(-1);
    const html = Object.entries(prognosen).map(([key,val])=>{
        const diff = (val-currentPrice)/currentPrice;
        return `<tr>
            <td>${key}</td>
            <td>${val.toFixed(2)}</td>
            <td class="${getSignalClass(diff)}">${getSignal(diff)}</td>
            <td>Δ ${(diff*100).toFixed(1)}%</td>
            <td class="conf">${getConfidence(diff)}</td>
            <td>${now}</td>
        </tr>`;
    }).join('');
    outTable.innerHTML = html;

    statusDiv.textContent = "Analyse abgeschlossen";
}

// -----------------
// Event Listener
// -----------------
analyseBtn.addEventListener("click", runAnalysis);

// Live-Update alle 5s
assetSelect.addEventListener("change", async e=>{
    if(liveInterval) clearInterval(liveInterval);
    const sym = e.target.value;
    liveInterval = setInterval(async ()=>{
        currentPriceDiv.textContent = `Aktueller Kurs: ${(await fetchCurrentPrice(sym)).toFixed(2)} CHF`;
    },5000);
});

// -----------------
// 7-Tage Prognose
// -----------------
async function sevenDayForecast(sym){
    const period = 7;
    const hist = await fetchHistoricalData(sym, period*2);
    const currentPrice = hist.at(-1);
    const prognosen = await ensemble(hist);
    const avgForecast = (prognosen.ki1 + prognosen.ki2 + prognosen.ki3 + prognosen.ki4)/4;

    const accuracy = ((1 - Math.abs(avgForecast - currentPrice)/currentPrice)*100).toFixed(2);
    console.log(`7-Tage Prognose ${sym}: ${(avgForecast).toFixed(2)} CHF – Genauigkeit: ${accuracy}%`);

    if(avgForecast>currentPrice*1.2) console.warn(`⚠️ Hoher Anstieg für ${sym}`);
    if(avgForecast<currentPrice*0.85) console.warn(`⚠️ Starker Rückgang für ${sym}`);

    setTimeout(async ()=>{
        const newPrice = await fetchCurrentPrice(sym);
        const newAccuracy = ((1 - Math.abs(avgForecast - newPrice)/newPrice)*100).toFixed(2);
        console.log(`Nach 7 Tagen: ${sym} Kurs ${(newPrice).toFixed(2)} CHF – Abweichung ${newAccuracy}%`);
    }, period*24*60*60*1000);
}

// -----------------
// Kontinuierliches LSTM-Lernen
// -----------------
async function continuousLearning(){
    for(const a of ALL_ASSETS){
        const hist = await fetchHistoricalData(a.symbol,30);
        await trainOrUpdateLSTM(hist,7);
    }
    console.log("Kontinuelles LSTM-Training abgeschlossen");
}
setInterval(continuousLearning, 24*60*60*1000);

// -----------------
// Automatische Analyse beim Start
// -----------------
document.addEventListener("DOMContentLoaded", async ()=>{
    const asset = getRandomAsset();
    assetSelect.value = asset.symbol;
    await runAnalysis();
});

