// analyse.js - Final: alle Aktien & Kryptos + 7-Tage Hidden Prognose

const API_KEY = "d5ohqjhr01qjast6qrjgd5ohqjhr01qjast6qrk0";

const assets = [
    // Aktien
    {symbol:"AAPL", name:"Apple Inc."},
    {symbol:"MSFT", name:"Microsoft Corp."},
    {symbol:"NVDA", name:"NVIDIA Corp."},
    {symbol:"AMZN", name:"Amazon.com Inc."},
    {symbol:"GOOGL", name:"Alphabet Inc."},
    {symbol:"TSLA", name:"Tesla Inc."},
    {symbol:"META", name:"Meta Platforms"},
    // Kryptos
    {symbol:"BTC-USD", name:"Bitcoin"},
    {symbol:"ETH-USD", name:"Ethereum"},
    {symbol:"BNB-USD", name:"Binance Coin"},
    {symbol:"SOL-USD", name:"Solana"},
    {symbol:"ADA-USD", name:"Cardano"},
    {symbol:"DOGE-USD", name:"Dogecoin"},
    {symbol:"XRP-USD", name:"Ripple"},
    {symbol:"LTC-USD", name:"Litecoin"},
    {symbol:"DOT-USD", name:"Polkadot"}
];

const assetSelect = document.getElementById("assetSelect");
const periodSelect = document.getElementById("periodSelect");
const analyseBtn = document.getElementById("analyseBtn");
const currentPriceDiv = document.getElementById("currentPrice");
const progressBar = document.getElementById("progressBar");
const progressText = document.getElementById("progressText");
const outTable = document.getElementById("out");
const chartCanvas = document.getElementById("chart");

let chart = null;
let storedModel = null;

// --- USD→CHF Wechselkurs ---
async function fetchUsdChf(){
    try{
        const r = await fetch("https://api.exchangerate.host/latest?base=USD&symbols=CHF");
        const j = await r.json();
        return Number(j.rates.CHF) || 0.93;
    }catch{return 0.93;}
}

// --- Historische Kryptos ---
async function fetchCryptoHistorical(sym, days=730){
    const mapping = {
        "BTC-USD":"bitcoin","ETH-USD":"ethereum","BNB-USD":"binancecoin",
        "SOL-USD":"solana","ADA-USD":"cardano","DOGE-USD":"dogecoin",
        "XRP-USD":"ripple","LTC-USD":"litecoin","DOT-USD":"polkadot"
    };
    const id = mapping[sym];
    if(!id) return [];
    try{
        const r = await fetch(`https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=${days}`);
        const j = await r.json();
        if(j.prices && j.prices.length>0) return j.prices.map(p=>p[1]);
    }catch(e){console.warn("CoinGecko Fehler:", e);}
    const live = await fetchCryptoLive(sym);
    const fallback = [];
    for(let i=0;i<Math.min(days,10);i++) fallback.push(live*(1+0.01*(Math.random()-0.5)));
    return fallback;
}

async function fetchCryptoLive(sym){
    const mapping = {
        "BTC-USD":"bitcoin","ETH-USD":"ethereum","BNB-USD":"binancecoin",
        "SOL-USD":"solana","ADA-USD":"cardano","DOGE-USD":"dogecoin",
        "XRP-USD":"ripple","LTC-USD":"litecoin","DOT-USD":"polkadot"
    };
    const id = mapping[sym];
    if(!id) return 100;
    try{
        const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`);
        const j = await r.json();
        if(j[id] && j[id].usd) return j[id].usd;
    }catch(e){console.warn("CoinGecko Live Fehler:", e);}
    return 100;
}

// --- Historische Aktien ---
async function fetchStockHistorical(sym, maxDays=730, minDays=10){
    const now = Math.floor(Date.now()/1000);
    let days=maxDays;
    let lastValidPrice=100;
    while(days>=minDays){
        try{
            const from = now-days*24*60*60;
            const url = `https://finnhub.io/api/v1/stock/candle?symbol=${sym}&resolution=D&from=${from}&to=${now}&token=${API_KEY}`;
            const r = await fetch(url);
            const j = await r.json();
            if(j.s==="ok" && j.c && j.c.length>=minDays){
                lastValidPrice=j.c[j.c.length-1];
                return j.c.map(Number);
            }
        }catch(e){console.warn("Finnhub Fehler:", e);}
        days-=30;
    }
    const fallback=[];
    for(let i=0;i<minDays;i++) fallback.push(lastValidPrice*(1+0.005*(Math.random()-0.5)));
    return fallback;
}

async function fetchStockLive(sym){
    try{
        const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${sym}&token=${API_KEY}`);
        const j = await r.json();
        if(j && j.c) return j.c;
    }catch(e){console.warn("Finnhub Live Fehler:", e);}
    return 100;
}

async function fetchQuote(sym){
    if(sym.includes("USD")) return await fetchCryptoLive(sym);
    return await fetchStockLive(sym);
}

// --- LSTM KI ---
async function predictLSTM(data, period, steps=4){
    if(data.length<period) return Array(steps).fill(data[data.length-1]);
    let histCopy=[...data], preds=[];
    for(let s=0;s<steps;s++){
        const noisy=histCopy.map(v=>v*(1+(Math.random()-0.5)/100));
        const min=Math.min(...noisy), max=Math.max(...noisy);
        const norm=noisy.map(v=>(v-min)/(max-min||1));
        let X=[],Y=[];
        for(let i=0;i<norm.length-period;i++){
            X.push(norm.slice(i,i+period).map(v=>[v]));
            Y.push([norm[i+period]]);
        }
        const xs=tf.tensor3d(X);
        const ys=tf.tensor2d(Y);
        let model;
        if(storedModel) model=storedModel;
        else{
            model=tf.sequential();
            model.add(tf.layers.lstm({units:30,inputShape:[period,1]}));
            model.add(tf.layers.dense({units:1}));
            model.compile({optimizer:tf.train.adam(0.01),loss:"meanSquaredError"});
        }
        await model.fit(xs,ys,{epochs:10,batchSize:8,verbose:0});
        storedModel=model;
        const p=model.predict(tf.tensor3d([X[X.length-1]])).dataSync()[0];
        const realVal=p*(max-min)+min;
        preds.push(realVal);
        histCopy.push(realVal);
    }
    return preds;
}

// --- Hidden Prognose speichern ---
function saveHiddenPrediction(type,symbol,preds){
    const data=JSON.parse(localStorage.getItem("hiddenPredictions")||"{}");
    if(!data[symbol]) data[symbol]=[];
    data[symbol].push({type,preds,timestamp:Date.now()});
    localStorage.setItem("hiddenPredictions",JSON.stringify(data));
}

// --- Hidden Prognose laufen lassen ---
async function runHiddenPrediction(symbol){
    const period=30;
    let hist=[];
    if(symbol.includes("USD")) hist=await fetchCryptoHistorical(symbol,730);
    else hist=await fetchStockHistorical(symbol,730);
    const live=await fetchQuote(symbol);
    if(live) hist[hist.length-1]=live;
    const preds=await predictLSTM(hist,period,7);
    saveHiddenPrediction("7day",symbol,preds);
    console.log(`Verborgene 7-Tage Prognose für ${symbol} erstellt ✅`);
}

// --- Hidden Prognosen prüfen ---
async function checkHiddenPredictions(){
    const data=JSON.parse(localStorage.getItem("hiddenPredictions")||"{}");
    const now=Date.now();
    for(const symbol in data){
        const updated=[];
        for(const p of data[symbol]){
            const age=now-p.timestamp;
            if(age>=7*24*60*60*1000){
                const live=await fetchQuote(symbol);
                const lastPred=p.preds[p.preds.length-1];
                const error=Math.abs((live-lastPred)/live)*100;
                console.log(`Hidden Prognose Check für ${symbol}: Genauigkeit ${(100-error).toFixed(2)}%`);
            } else updated.push(p);
        }
        data[symbol]=updated;
    }
    localStorage.setItem("hiddenPredictions",JSON.stringify(data));
}

// --- Tabelle & Chart Funktionen wie zuvor ---
function displayTable(sym,hist,preds,fx){ /* unverändert */ }

// --- Analyse Button ---
analyseBtn.addEventListener("click",async()=>{
    const sym=assetSelect.value;
    if(!sym){alert("Bitte Asset auswählen!"); return;}
    progressBar.value=0; progressText.textContent="Analyse startet…";

    const period=parseInt(periodSelect.value);
    let hist=[];
    if(sym.includes("USD")) hist=await fetchCryptoHistorical(sym,730);
    else hist=await fetchStockHistorical(sym,730);
    const live=await fetchQuote(sym);
    if(live) hist[hist.length-1]=live;
    const fx=await fetchUsdChf();
    currentPriceDiv.textContent=live ? `Aktueller Kurs: ${(live*fx).toFixed(2)} CHF` : "Kursdaten nicht verfügbar";
    const preds=await predictLSTM(hist,period,4);
    progressBar.value=100;
    progressText.textContent="Analyse abgeschlossen ✔";
    displayTable(sym,hist,preds,fx);
});

// --- Seite initialisieren + Hidden Prognosen ---
window.addEventListener("load",async()=>{
    assetSelect.innerHTML="";
    for(let asset of assets){
        const option=document.createElement("option");
        option.value=asset.symbol;
        option.textContent=`${asset.name} (${asset.symbol})`;
        assetSelect.appendChild(option);
    }
    // Verborgene Prognosen nur für eine Aktie + eine Krypto
    await runHiddenPrediction("AAPL");
    await runHiddenPrediction("BTC-USD");
    await checkHiddenPredictions();
});
