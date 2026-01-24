// ================== KONSTANTEN ==================
const API_KEY = "d5ohqjhr01qjast6qrjgd5ohqjhr01qjast6qrk0";
const assetSelect = document.getElementById("assetSelect");
const analyseBtn = document.getElementById("analyseBtn");
const currentPriceDiv = document.getElementById("currentPrice");
const statusDiv = document.getElementById("status");
const progressBar = document.getElementById("progressBar");
const progressText = document.getElementById("progressText");
const chartCanvas = document.getElementById("chart");

let chart = null;
let lstmModel = null;

// ================== ASSETS ==================
const ASSETS = [
  // Aktien
  {symbol:"AAPL",name:"Apple Inc."},
  {symbol:"MSFT",name:"Microsoft Corp."},
  {symbol:"NVDA",name:"NVIDIA Corp."},
  {symbol:"AMZN",name:"Amazon.com Inc."},
  {symbol:"GOOGL",name:"Alphabet Inc."},
  {symbol:"TSLA",name:"Tesla Inc."},
  {symbol:"META",name:"Meta Platforms"},
  {symbol:"NVS",name:"Novartis AG"},
  {symbol:"NESN.SW",name:"Nestlé AG"},
  // Krypto
  {symbol:"BTC-USD",name:"Bitcoin"},
  {symbol:"ETH-USD",name:"Ethereum"},
  {symbol:"BNB-USD",name:"Binance Coin"},
  {symbol:"SOL-USD",name:"Solana"},
  {symbol:"ADA-USD",name:"Cardano"},
  {symbol:"DOGE-USD",name:"Dogecoin"},
  {symbol:"XRP-USD",name:"Ripple"},
  {symbol:"LTC-USD",name:"Litecoin"},
  {symbol:"DOT-USD",name:"Polkadot"}
];

// ================== HILFSFUNKTIONEN ==================
function updateProgress(value,text){
    progressBar.value = value;
    progressText.textContent = text;
}

function sleep(ms){return new Promise(r=>setTimeout(r,ms));}

// ================== ASSET SELEKTOR ==================
async function loadAssets(){
    assetSelect.innerHTML = "";
    for(let a of ASSETS){
        try{
            let url = a.symbol.includes("USD")
                ? `https://finnhub.io/api/v1/crypto/candle?symbol=${a.symbol}&resolution=D&from=${Math.floor(Date.now()/1000)-30*24*60*60}&to=${Math.floor(Date.now()/1000)}&token=${API_KEY}`
                : `https://finnhub.io/api/v1/stock/profile2?symbol=${a.symbol}&token=${API_KEY}`;
            const res = await fetch(url);
            const j = await res.json();
            if((j.s==="ok" && j.c?.length>0) || j.name){
                const opt = document.createElement("option");
                opt.value = a.symbol;
                opt.textContent = `${a.name} (${a.symbol})`;
                assetSelect.appendChild(opt);
            }
        }catch{}
    }
}
loadAssets();

// ================== LIVE KURS IN CHF ==================
async function fetchUsdChf(){
    try{
        const r = await fetch("https://api.exchangerate.host/latest?base=USD&symbols=CHF");
        const j = await r.json();
        return Number(j.rates.CHF)||0.93;
    }catch{return 0.93;}
}

async function fetchQuote(sym){
    if(sym.includes("USD")){
        // Krypto
        const now=Math.floor(Date.now()/1000);
        const res=await fetch(`https://finnhub.io/api/v1/crypto/candle?symbol=${sym}&resolution=D&from=${now-24*3600}&to=${now}&token=${API_KEY}`);
        const j=await res.json();
        if(j.s==="ok") return Number(j.c?.at(-1));
    } else {
        const res=await fetch(`https://finnhub.io/api/v1/quote?symbol=${sym}&token=${API_KEY}`);
        const j=await res.json();
        if(j.c!==undefined) return Number(j.c);
    }
    throw "Keine Kursdaten verfügbar";
}

async function updateCurrentPrice(sym){
    try{
        const usdChf = await fetchUsdChf();
        const price = await fetchQuote(sym);
        currentPriceDiv.textContent = `Aktueller Kurs: ${(price*usdChf).toFixed(2)} CHF`;
        return price*usdChf;
    }catch(err){
        currentPriceDiv.textContent = `Fehler: ${err}`;
        return null;
    }
}

// ================== HISTORISCHE DATEN ==================
async function fetchHistoricalData(sym,days=180){
    const now=Math.floor(Date.now()/1000);
    const start=now-days*24*60*60;
    try{
        let url=sym.includes("USD")
            ? `https://finnhub.io/api/v1/crypto/candle?symbol=${sym}&resolution=D&from=${start}&to=${now}&token=${API_KEY}`
            : `https://finnhub.io/api/v1/stock/candle?symbol=${sym}&resolution=D&from=${start}&to=${now}&token=${API_KEY}`;
        const r=await fetch(url);
        const j=await r.json();
        if(j.s!=="ok" || !j.c) throw "Keine Daten";
        return j.c.map(v=>Number(v));
    }catch{
        const q = await fetchQuote(sym);
        return Array(days).fill(q);
    }
}

// ================== LSTM KI ==================
async function getLSTMModel(period){
    if(lstmModel) return lstmModel;
    lstmModel=tf.sequential();
    lstmModel.add(tf.layers.lstm({units:16,inputShape:[period,1]}));
    lstmModel.add(tf.layers.dense({units:1}));
    lstmModel.compile({optimizer:tf.train.adam(0.01),loss:"meanSquaredError"});
    return lstmModel;
}

async function predictLSTM(data,period){
    const noisy=data.map(v=>v*(1+(Math.random()-0.5)/100));
    const min=Math.min(...noisy), max=Math.max(...noisy);
    const norm=noisy.map(v=>(v-min)/(max-min||1));

    let X=[],Y=[];
    for(let i=0;i<norm.length-period;i++){
        X.push(norm.slice(i,i+period).map(v=>[v]));
        Y.push([norm[i+period]]);
    }
    if(X.length===0) return data[data.length-1];

    const xs=tf.tensor3d(X);
    const ys=tf.tensor2d(Y);

    const model=await getLSTMModel(period);
    await model.fit(xs,ys,{epochs:3,verbose:0});

    const p=model.predict(tf.tensor3d([X.at(-1)])).dataSync()[0];
    return p*(max-min)+min;
}

// ================== TABELLE ==================
function getConfidence(diff){
    if(Math.abs(diff)>0.1) return "Hoch";
    if(Math.abs(diff)>0.05) return "Mittel";
    return "Niedrig";
}

function getSignal(diff){
    if(diff>0.05) return "KAUFEN";
    if(diff<-0.05) return "VERKAUFEN";
    return "HALTEN";
}

function displayTable(symbol,hist,preds){
    const out=document.getElementById("out");
    const now=new Date();
    const timeStr=now.toLocaleString();
    let html="";
    const avg=preds.reduce((a,b)=>a+b,0)/preds.length;

    preds.forEach((p,i)=>{
        const diff=(p-hist[hist.length-1])/hist[hist.length-1];
        html+=`<tr>
            <td>KI${i+1}</td>
            <td>${p.toFixed(2)}</td>
            <td>${getSignal(diff)}</td>
            <td>${(diff*100).toFixed(1)}%</td>
            <td>${getConfidence(diff)}</td>
            <td>–</td>
            <td>–</td>
            <td>–</td>
            <td>–</td>
        </tr>`;
    });

    // Durchschnitt
    const diff=(avg-hist[hist.length-1])/hist[hist.length-1];
    html+=`<tr>
        <td>Durchschnitt</td>
        <td>${avg.toFixed(2)}</td>
        <td>${getSignal(diff)}</td>
        <td>${(diff*100).toFixed(1)}%</td>
        <td>${getConfidence(diff)}</td>
        <td>–</td>
        <td>–</td>
        <td>–</td>
        <td>–</td>
    </tr>`;

    out.innerHTML=html;
}

// ================== CHART ==================
function drawChart(hist,preds){
    if(chart) chart.destroy();
    const avg = preds.reduce((a,b)=>a+b,0)/preds.length;
    chart=new Chart(chartCanvas,{
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

// ================== RUN ANALYSE ==================
analyseBtn.addEventListener("click",async()=>{
    const sym=assetSelect.value;
    if(!sym) return alert("Bitte ein Asset auswählen!");
    statusDiv.textContent="Analyse läuft…";
    updateProgress(0,"Starte Analyse…");

    const hist = await fetchHistoricalData(sym,60);
    const price = await updateCurrentPrice(sym);

    const preds=[];
    for(let i=0;i<4;i++){
        preds[i]=await predictLSTM(hist,30+i*2);
        updateProgress((i+1)/4*100,`KI${i+1} fertig…`);
        await sleep(50);
    }

    drawChart(hist,preds);
    displayTable(sym,hist,preds);

    statusDiv.textContent="Fertig ✔";
    updateProgress(100,"Analyse abgeschlossen");
});
