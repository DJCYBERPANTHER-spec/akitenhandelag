const API_KEY = "d5ohqjhr01qjast6qrjgd5ohqjhr01qjast6qrk0";

// --- Elemente ---
const assetSelect = document.getElementById("assetSelect");
const periodSelect = document.getElementById("periodSelect");
const analyseBtn = document.getElementById("analyseBtn");
const statusDiv = document.getElementById("status");
const currentPriceDiv = document.getElementById("currentPrice");
const progressBar = document.getElementById("progressBar");
const progressText = document.getElementById("progressText");
const outTable = document.getElementById("out");
const chartCanvas = document.getElementById("chart");

const yahooBtn = document.getElementById("yahooBtn");
const tradingViewBtn = document.getElementById("tradingViewBtn");
const swissquoteBtn = document.getElementById("swissquoteBtn");

let chart = null;

// --- Assets (Aktien + Krypto) ---
const ASSETS = [
    {symbol:"AAPL",name:"Apple Inc."},{symbol:"MSFT",name:"Microsoft Corp."},{symbol:"NVDA",name:"NVIDIA Corp."},
    {symbol:"AMZN",name:"Amazon.com Inc."},{symbol:"GOOGL",name:"Alphabet Inc."},{symbol:"TSLA",name:"Tesla Inc."},
    {symbol:"META",name:"Meta Platforms"},{symbol:"BTC-USD",name:"Bitcoin"},{symbol:"ETH-USD",name:"Ethereum"},
    {symbol:"BNB-USD",name:"Binance Coin"},{symbol:"SOL-USD",name:"Solana"},{symbol:"ADA-USD",name:"Cardano"}
];

// --- Hilfsfunktionen ---
function updateProgress(val, text){
    progressBar.value = val;
    progressText.textContent = text;
}

function sleep(ms){return new Promise(r=>setTimeout(r,ms));}

// Live USD → CHF
async function fetchUsdChf(){ 
    try{
        const r = await fetch("https://api.exchangerate.host/latest?base=USD&symbols=CHF");
        const j = await r.json();
        return Number(j?.rates?.CHF)||0.93;
    }catch{return 0.93;}
}

// Live Kurs
async function fetchQuote(sym){
    let url = sym.includes("USD") 
        ? `https://finnhub.io/api/v1/crypto/candle?symbol=${sym}&resolution=D&from=${Math.floor(Date.now()/1000)-60*24*60*60}&to=${Math.floor(Date.now()/1000)}&token=${API_KEY}`
        : `https://finnhub.io/api/v1/quote?symbol=${sym}&token=${API_KEY}`;
    try{
        const r = await fetch(url);
        const j = await r.json();
        if(sym.includes("USD") && j.s==="ok") return j.c.at(-1);
        if(!sym.includes("USD") && j.c!==undefined) return j.c;
    }catch{}
    return null;
}

// Historische Daten
async function fetchHistorical(sym, days){
    const now = Math.floor(Date.now()/1000);
    const start = now - days*24*60*60;
    try{
        let url = sym.includes("USD")
            ? `https://finnhub.io/api/v1/crypto/candle?symbol=${sym}&resolution=D&from=${start}&to=${now}&token=${API_KEY}`
            : `https://finnhub.io/api/v1/stock/candle?symbol=${sym}&resolution=D&from=${start}&to=${now}&token=${API_KEY}`;
        const r = await fetch(url);
        const j = await r.json();
        if(j.s==="ok" && j.c && j.c.length>0) return j.c.map(Number);
    }catch{}
    return [];
}

// --- LSTM Prognose ---
async function predictLSTM(data, period){
    const noisy = data.map(v => v*(1+(Math.random()-0.5)/100));
    const min = Math.min(...noisy), max = Math.max(...noisy);
    const norm = noisy.map(v=>(v-min)/(max-min||1));

    let X=[], Y=[];
    for(let i=0;i<norm.length-period;i++){
        X.push(norm.slice(i,i+period).map(v=>[v]));
        Y.push([norm[i+period]]);
    }
    if(X.length===0) return data[data.length-1];

    const xs = tf.tensor3d(X);
    const ys = tf.tensor2d(Y);

    const model = tf.sequential();
    model.add(tf.layers.lstm({units:12,inputShape:[period,1]}));
    model.add(tf.layers.dense({units:1}));
    model.compile({optimizer:"adam",loss:"meanSquaredError"});

    await model.fit(xs,ys,{epochs:5,verbose:0});

    const p = model.predict(tf.tensor3d([X.at(-1)])).dataSync()[0];
    return p*(max-min)+min;
}

// --- Tabelle + Chart ---
function getConfidence(diff){return Math.abs(diff)>0.1?"Hoch":Math.abs(diff)>0.05?"Mittel":"Niedrig";}

function drawChart(hist, preds){
    if(chart) chart.destroy();
    const avg = preds.reduce((a,b)=>a+b,0)/preds.length;
    chart = new Chart(chartCanvas,{
        type:'line',
        data:{
            labels:hist.map((_,i)=>`T${i+1}`),
            datasets:[
                {label:"KI1",data:[...Array(hist.length-1).fill(null), preds[0]], borderColor:"#22c55e",fill:false},
                {label:"KI2",data:[...Array(hist.length-1).fill(null), preds[1]], borderColor:"#3b82f6",fill:false},
                {label:"KI3",data:[...Array(hist.length-1).fill(null), preds[2]], borderColor:"#f97316",fill:false},
                {label:"KI4",data:[...Array(hist.length-1).fill(null), preds[3]], borderColor:"#facc15",fill:false},
                {label:"Durchschnitt",data:[...Array(hist.length-1).fill(null), avg],borderColor:"#ffffff",fill:false}
            ]
        },
        options:{responsive:true, maintainAspectRatio:true}
    });
}

async function displayTable(hist, preds, fx){
    let html="";
    const last = hist[hist.length-1]*fx;
    const timeStr = new Date().toLocaleString();

    preds.forEach((p,i)=>{
        const pCHF = p*fx;
        const diff = (pCHF-last)/last;
        const sig = diff>0.05?"Kaufen":diff<-0.05?"Verkaufen":"Halten";
        html+=`<tr>
            <td>KI${i+1}</td>
            <td>${pCHF.toFixed(2)}</td>
            <td class="${sig.toLowerCase()}">${sig}</td>
            <td>${(diff*100).toFixed(1)}%</td>
            <td class="conf">${getConfidence(diff)}</td>
            <td>${timeStr}</td>
        </tr>`;
    });
    outTable.innerHTML = html;
}

// --- Kauf-Links ---
function updateBuyLinks(sym){
    yahooBtn.onclick = ()=>window.open(`https://finance.yahoo.com/quote/${sym}`,"_blank");
    tradingViewBtn.onclick = ()=>window.open(`https://www.tradingview.com/symbols/${sym}/`,"_blank");
    swissquoteBtn.onclick = ()=>window.open(`https://www.swissquote.ch/sqw-en/private/trading/instruments/search?query=${sym}`,"_blank");
}

// --- Analyse starten ---
analyseBtn.addEventListener("click", async ()=>{
    const sym = assetSelect.value;
    if(!sym) {alert("Bitte ein Asset auswählen!"); return;}
    const period = parseInt(periodSelect.value);

    statusDiv.textContent="Analyse läuft…";
    updateProgress(0,"Starte Analyse…");

    const fx = await fetchUsdChf();
    updateProgress(5,"USD → CHF geladen…");

    const hist = await fetchHistorical(sym, period*2);
    if(hist.length===0){alert("Keine historischen Daten");return;}
    updateProgress(20,"Historische Daten geladen…");

    const current = await fetchQuote(sym);
    if(current) currentPriceDiv.textContent=`Aktueller Kurs: ${(current*fx).toFixed(2)} CHF`;
    updateBuyLinks(sym);
    updateProgress(35,"Live-Kurs geladen…");

    const preds=[];
    for(let i=0;i<4;i++){
        preds[i] = await predictLSTM(hist, period+i*2);
        updateProgress(35+15*(i+1),`KI${i+1} Prognose fertig`);
    }

    drawChart(hist.map(v=>v*fx), preds.map(p=>p*fx));
    displayTable(hist, preds, fx);

    updateProgress(100,"Analyse abgeschlossen ✔");
    statusDiv.textContent="Fertig";
});

// --- Assets beim Start laden ---
async function initAssets(){
    assetSelect.innerHTML="";
    for(let a of ASSETS){
        const option = document.createElement("option");
        option.value = a.symbol;
        option.textContent = `${a.name} (${a.symbol})`;
        assetSelect.appendChild(option);
    }
}
initAssets();
