// analyse.js

const API_KEY = "d5ohqjhr01qjast6qrjgd5ohqjhr01qjast6qrk0";

const assets = [
    // Aktien
    {symbol:"AAPL",name:"Apple Inc."},{symbol:"MSFT",name:"Microsoft Corp."},
    {symbol:"NVDA",name:"NVIDIA Corp."},{symbol:"AMZN",name:"Amazon.com Inc."},
    {symbol:"GOOGL",name:"Alphabet Inc."},{symbol:"TSLA",name:"Tesla Inc."},
    {symbol:"META",name:"Meta Platforms"},{symbol:"NVS",name:"Novartis AG"},
    {symbol:"NESN.SW",name:"Nestlé AG"},
    // Kryptos
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

// --- CHF Wechselkurs ---
async function fetchUsdChf(){
    try{
        const r = await fetch("https://api.exchangerate.host/latest?base=USD&symbols=CHF");
        const j = await r.json();
        return Number(j.rates.CHF) || 0.93;
    }catch{return 0.93;}
}

// --- Live-Kurs für Asset ---
async function fetchQuote(sym){
    try{
        if(sym.includes("USD")){
            // Krypto
            const now = Math.floor(Date.now()/1000);
            const from = now - 24*60*60;
            const r = await fetch(`https://finnhub.io/api/v1/crypto/candle?symbol=${sym}&resolution=60&from=${from}&to=${now}&token=${API_KEY}`);
            const j = await r.json();
            if(j.s==="ok") return j.c[j.c.length-1];
        } else {
            // Aktie
            const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${sym}&token=${API_KEY}`);
            const j = await r.json();
            if(j && j.c) return j.c;
        }
    }catch{}
    throw "Keine Kursdaten verfügbar";
}

// --- Historische Daten ---
async function fetchHistorical(sym, period){
    const now = Math.floor(Date.now()/1000);
    const from = now - period*24*60*60;
    try{
        if(sym.includes("USD")){
            const r = await fetch(`https://finnhub.io/api/v1/crypto/candle?symbol=${sym}&resolution=D&from=${from}&to=${now}&token=${API_KEY}`);
            const j = await r.json();
            if(j.s==="ok") return j.c.map(v=>Number(v));
        } else {
            const r = await fetch(`https://finnhub.io/api/v1/stock/candle?symbol=${sym}&resolution=D&from=${from}&to=${now}&token=${API_KEY}`);
            const j = await r.json();
            if(j.s==="ok") return j.c.map(v=>Number(v));
        }
    }catch{}
    return [];
}

// --- LSTM Prognose ---
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

    const model = tf.sequential();
    model.add(tf.layers.lstm({units:20,inputShape:[period,1]}));
    model.add(tf.layers.dense({units:1}));
    model.compile({optimizer:"adam",loss:"meanSquaredError"});

    await model.fit(xs,ys,{epochs:5,verbose:0});
    const p = model.predict(tf.tensor3d([X[X.length-1]])).dataSync()[0];
    return p*(max-min)+min;
}

// --- Tabelle und Chart ---
function displayTable(symbol, hist, preds, fx){
    let html="";
    const now = new Date();
    const timeStr = now.toLocaleString();
    const lastHist = hist[hist.length-1];

    preds.forEach((p,i)=>{
        const chf = p*fx;
        const diff = (p - lastHist)/lastHist;
        let sig = "HALTEN";
        if(diff>0.05) sig="KAUFEN";
        else if(diff<-0.05) sig="VERKAUFEN";

        html+=`<tr>
            <td>KI${i+1}</td>
            <td>${chf.toFixed(2)}</td>
            <td>${sig}</td>
            <td>${(diff*100).toFixed(2)}%</td>
            <td class="conf">${(Math.abs(diff)*100).toFixed(0)}%</td>
            <td>${timeStr}</td>
        </tr>`;
    });

    outTable.innerHTML = html;

    // Chart zeichnen
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

// --- Live Preis aktualisieren ---
async function updateCurrentPrice(sym){
    try{
        const quote = await fetchQuote(sym);
        const fx = await fetchUsdChf();
        currentPriceDiv.textContent = `Aktueller Kurs: ${(quote*fx).toFixed(2)} CHF`;
    }catch(e){
        currentPriceDiv.textContent = "Kursdaten nicht verfügbar";
    }
}

// --- Assets laden ---
async function loadAssets(){
    assetSelect.innerHTML="";
    for(let asset of assets){
        try{
            const quote = await fetchQuote(asset.symbol);
            if(quote){
                const o = document.createElement("option");
                o.value = asset.symbol;
                o.textContent = `${asset.name} (${asset.symbol})`;
                assetSelect.appendChild(o);
            }
        }catch{}
    }
}

// --- Analyse starten ---
analyseBtn.addEventListener("click", async()=>{
    const sym = assetSelect.value;
    if(!sym){alert("Bitte Asset auswählen!"); return;}
    updateCurrentPrice(sym);
    progressBar.value=0; progressText.textContent="Starte Analyse…";

    const period = parseInt(periodSelect.value);
    let hist = await fetchHistorical(sym, period*2);
    if(hist.length===0){alert("Keine historischen Daten verfügbar!"); return;}

    const preds=[];
    for(let i=0;i<4;i++){
        progressBar.value = 20 + i*20;
        progressText.textContent = `Berechne KI${i+1}…`;
        preds.push(await predictLSTM(hist, period + i*2));
    }
    progressBar.value=100; progressText.textContent="Analyse abgeschlossen ✔";

    const fx = await fetchUsdChf();
    displayTable(sym, hist, preds, fx);
});

// --- Seite initialisieren ---
window.addEventListener("load", async()=>{
    await loadAssets();
});
