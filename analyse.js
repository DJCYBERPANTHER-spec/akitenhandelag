// analyse.js - Final: Kryptos über CoinGecko, Aktien über Finnhub

const API_KEY = "d5ohqjhr01qjast6qrjgd5ohqjhr01qjast6qrk0";

const assets = [
    {symbol:"AAPL",name:"Apple Inc."},{symbol:"MSFT",name:"Microsoft Corp."},
    {symbol:"NVDA",name:"NVIDIA Corp."},{symbol:"AMZN",name:"Amazon.com Inc."},
    {symbol:"GOOGL",name:"Alphabet Inc."},{symbol:"TSLA",name:"Tesla Inc."},
    {symbol:"META",name:"Meta Platforms"},
    {symbol:"BTC-USD",name:"Bitcoin"},{symbol:"ETH-USD",name:"Ethereum"},
    {symbol:"BNB-USD",name:"Binance Coin"},{symbol:"SOL-USD",name:"Solana"},
    {symbol:"ADA-USD",name:"Cardano"},{symbol:"DOGE-USD",name:"Dogecoin"},
    {symbol:"XRP-USD",name:"Ripple"},{symbol:"LTC-USD",name:"Litecoin"},
    {symbol:"DOT-USD",name:"Polkadot"}
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

// --- CHF Wechselkurs ---
async function fetchUsdChf(){
    try{
        const r = await fetch("https://api.exchangerate.host/latest?base=USD&symbols=CHF");
        const j = await r.json();
        return Number(j.rates.CHF) || 0.93;
    }catch{return 0.93;}
}

// --- CoinGecko: historische Kryptos ---
async function fetchCryptoHistoricalCoinGecko(sym, days = 365){
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
    
    // Fallback minimal
    const fallback = [];
    const base = 20000;
    for(let i=0;i<Math.min(days,10);i++) fallback.push(base*(1+0.01*Math.random()));
    return fallback;
}

// --- Finnhub: historische Aktien ---
async function fetchStockHistoricalFinnhub(sym, maxDays=365, minDays=10){
    const now = Math.floor(Date.now()/1000);
    let days = maxDays;
    let lastValidPrice = 100;

    while(days >= minDays){
        const from = now - days*24*60*60;
        try{
            const url = `https://finnhub.io/api/v1/stock/candle?symbol=${sym}&resolution=D&from=${from}&to=${now}&token=${API_KEY}`;
            const res = await fetch(url);
            const j = await res.json();
            if(j.s==="ok" && j.c && j.c.length >= minDays){
                lastValidPrice = j.c[j.c.length-1];
                return j.c.map(Number);
            }
        }catch(e){console.warn("Finnhub Fehler:", e);}
        days -= 30;
    }

    const fallback = [];
    for(let i=0;i<minDays;i++) fallback.push(lastValidPrice*(1+0.005*(Math.random()-0.5)));
    return fallback;
}

// --- Live-Kurs ---
async function fetchQuote(sym){
    try{
        if(sym.includes("USD")){
            const hist = await fetchCryptoHistoricalCoinGecko(sym, 1);
            return hist[hist.length-1];
        } else {
            const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${sym}&token=${API_KEY}`);
            const j = await r.json();
            if(j && j.c) return j.c;
        }
    }catch{}
    return null;
}

// --- LSTM KI ---
async function predictLSTM(data, period){
    if(data.length<period) return data[data.length-1];

    const noisy = data.map(v => v*(1+(Math.random()-0.5)/100));
    const min = Math.min(...noisy), max = Math.max(...noisy);
    const norm = noisy.map(v=>(v-min)/(max-min||1));

    let X=[], Y=[];
    for(let i=0;i<norm.length-period;i++){
        X.push(norm.slice(i,i+period).map(v=>[v]));
        Y.push([norm[i+period]]);
    }

    const xs = tf.tensor3d(X);
    const ys = tf.tensor2d(Y);

    let model;
    if(storedModel){
        model = storedModel;
    } else {
        model = tf.sequential();
        model.add(tf.layers.lstm({units:20,inputShape:[period,1]}));
        model.add(tf.layers.dense({units:1}));
        model.compile({optimizer:"adam",loss:"meanSquaredError"});
    }

    await model.fit(xs,ys,{epochs:5,verbose:0});
    storedModel = model;

    const p = model.predict(tf.tensor3d([X[X.length-1]])).dataSync()[0];
    return p*(max-min)+min;
}

// --- Tabelle & Chart ---
function displayTable(sym, hist, preds, fx){
    let html="";
    const now = new Date();
    const timeStr = now.toLocaleString();
    const lastHist = hist[hist.length-1];

    preds.forEach((p,i)=>{
        const chf = p*fx;
        const diff = (p - lastHist)/lastHist;
        let sig="HALTEN";
        if(diff>0.05) sig="KAUFEN";
        else if(diff<-0.05) sig="VERKAUFEN";

        html+=`<tr>
            <td>KI${i+1}</td>
            <td>${chf.toFixed(2)}</td>
            <td class="${sig.toLowerCase()}">${sig}</td>
            <td>${(diff*100).toFixed(2)}%</td>
            <td class="conf">${(Math.abs(diff)*100).toFixed(0)}%</td>
            <td>${timeStr}</td>
        </tr>`;
    });

    outTable.innerHTML = html;

    if(chart) chart.destroy();
    const avgPred = preds.map(p=>p*fx);
    chart = new Chart(chartCanvas,{
        type:'line',
        data:{
            labels:hist.map((_,i)=>`T${i+1}`),
            datasets:[
                {label:"Historie",data:hist.map(v=>v*fx),borderColor:"#3b82f6",fill:false},
                {label:"KI1",data:[...Array(hist.length-1).fill(null),avgPred[0]],borderColor:"#22c55e",fill:false},
                {label:"KI2",data:[...Array(hist.length-1).fill(null),avgPred[1]],borderColor:"#facc15",fill:false},
                {label:"KI3",data:[...Array(hist.length-1).fill(null),avgPred[2]],borderColor:"#f97316",fill:false},
                {label:"KI4",data:[...Array(hist.length-1).fill(null),avgPred[3]],borderColor:"#38bdf8",fill:false},
            ]
        },
        options:{responsive:true,maintainAspectRatio:true}
    });
}

// --- Analyse starten ---
analyseBtn.addEventListener("click", async()=>{
    const sym = assetSelect.value;
    if(!sym){alert("Bitte Asset auswählen!"); return;}
    progressBar.value=0; progressText.textContent="Analyse startet…";

    const period = parseInt(periodSelect.value);
    let hist = [];
    if(sym.includes("USD")) hist = await fetchCryptoHistoricalCoinGecko(sym, 365);
    else hist = await fetchStockHistoricalFinnhub(sym, 365);

    const fx = await fetchUsdChf();
    const live = await fetchQuote(sym);
    currentPriceDiv.textContent = live ? `Aktueller Kurs: ${(live*fx).toFixed(2)} CHF` : "Kursdaten nicht verfügbar";

    const preds=[];
    for(let i=0;i<4;i++){
        progressBar.value=20+i*20;
        progressText.textContent=`KI${i+1} berechnet…`;
        preds.push(await predictLSTM(hist, period + i*2));
    }
    progressBar.value=100; progressText.textContent="Analyse abgeschlossen ✔";

    displayTable(sym, hist, preds, fx);
});

// --- Seite initialisieren ---
window.addEventListener("load", async()=>{
    assetSelect.innerHTML="";
    for(let asset of assets){
        const option = document.createElement("option");
        option.value = asset.symbol;
        option.textContent = `${asset.name} (${asset.symbol})`;
        assetSelect.appendChild(option);
    }
});
