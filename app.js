// ================== KONSTANTEN ==================
const API_KEY = "d5ohqjhr01qjast6qrjgd5ohqjhr01qjast6qrk0";
const ASSETS = [
    // Aktien
    {symbol:"AAPL", name:"Apple Inc."},
    {symbol:"MSFT", name:"Microsoft Corp."},
    {symbol:"NVDA", name:"NVIDIA Corp."},
    {symbol:"AMZN", name:"Amazon.com Inc."},
    {symbol:"GOOGL", name:"Alphabet Inc."},
    {symbol:"TSLA", name:"Tesla Inc."},
    {symbol:"META", name:"Meta Platforms"},
    // Krypto (Finnhub Binance Format)
    {symbol:"BTC-USD", name:"Bitcoin"},
    {symbol:"ETH-USD", name:"Ethereum"},
    {symbol:"BNB-USD", name:"Binance Coin"},
    {symbol:"SOL-USD", name:"Solana"},
    {symbol:"ADA-USD", name:"Cardano"}
];

let chart = null;

// ================== ELEMENTE ==================
const assetSelect = document.getElementById("assetSelect");
const periodSelect = document.getElementById("periodSelect");
const analyseBtn = document.getElementById("analyseBtn");
const currentPriceDiv = document.getElementById("currentPrice");
const progressBar = document.getElementById("progressBar");
const progressText = document.getElementById("progressText");
const statusDiv = document.getElementById("status");
const outTable = document.getElementById("out");

// ================== ASSETS LADEN ==================
async function validateAssets() {
    assetSelect.innerHTML = "";
    for(let asset of ASSETS){
        try{
            let sym = asset.symbol;
            let url;
            if(sym.includes("USD")) {
                const cryptoSym = sym.replace("-USD","USDT");
                url = `https://finnhub.io/api/v1/crypto/candle?symbol=BINANCE:${cryptoSym}&resolution=D&from=${Math.floor(Date.now()/1000)-86400*30}&to=${Math.floor(Date.now()/1000)}&token=${API_KEY}`;
            } else {
                url = `https://finnhub.io/api/v1/stock/profile2?symbol=${sym}&token=${API_KEY}`;
            }
            const res = await fetch(url);
            const data = await res.json();
            if((sym.includes("USD") && data.s==="ok") || data.name){
                const option = document.createElement("option");
                option.value = sym;
                option.textContent = `${asset.name} (${sym})`;
                assetSelect.appendChild(option);
            }
        }catch{}
    }
}
validateAssets();

// ================== LIVE-KURS ==================
async function fetchUsdChf(){
    try{
        const r = await fetch("https://api.exchangerate.host/latest?base=USD&symbols=CHF");
        const j = await r.json();
        return j.rates.CHF || 0.93;
    }catch{return 0.93;}
}

async function fetchQuote(sym){
    let url;
    if(sym.includes("USD")){
        const cryptoSym = sym.replace("-USD","USDT");
        url = `https://finnhub.io/api/v1/crypto/candle?symbol=BINANCE:${cryptoSym}&resolution=D&from=${Math.floor(Date.now()/1000)-86400*30}&to=${Math.floor(Date.now()/1000)}&token=${API_KEY}`;
        const r = await fetch(url);
        const j = await r.json();
        if(j.s==="ok") return j.c[j.c.length-1];
    } else {
        url = `https://finnhub.io/api/v1/quote?symbol=${sym}&token=${API_KEY}`;
        const r = await fetch(url);
        const j = await r.json();
        if(j && j.c!==undefined) return j.c;
    }
    throw "Keine Kursdaten verfügbar";
}

async function updateCurrentPrice(sym){
    try{
        const quote = await fetchQuote(sym);
        const fx = await fetchUsdChf();
        currentPriceDiv.textContent = `Aktueller Kurs: ${(quote*fx).toFixed(2)} CHF`;
    }catch(err){
        currentPriceDiv.textContent = "Fehler beim Abrufen";
    }
}

// ================== HISTORISCHE DATEN ==================
async function fetchHistorical(sym, days){
    const now = Math.floor(Date.now()/1000);
    const start = now - days*24*60*60;
    try{
        let url;
        if(sym.includes("USD")){
            const cryptoSym = sym.replace("-USD","USDT");
            url = `https://finnhub.io/api/v1/crypto/candle?symbol=BINANCE:${cryptoSym}&resolution=D&from=${start}&to=${now}&token=${API_KEY}`;
        } else {
            url = `https://finnhub.io/api/v1/stock/candle?symbol=${sym}&resolution=D&from=${start}&to=${now}&token=${API_KEY}`;
        }
        const res = await fetch(url);
        const data = await res.json();
        if(data.s==="ok" && data.c && data.c.length>0){
            return data.c.map(Number);
        }
    }catch(e){ console.warn("Keine historischen Daten:", e);}
    throw "Keine historischen Daten verfügbar";
}

// ================== LSTM KI ==================
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

// ================== KONFIDENZ ==================
function getConfidence(diff){
    return Math.abs(diff)>0.1?"Hoch":Math.abs(diff)>0.05?"Mittel":"Niedrig";
}

// ================== TABELLE & CHART ==================
function displayTable(hist, preds, price){
    const out = outTable;
    let html = "";
    const timeStr = new Date().toLocaleString();

    preds.forEach((p,i)=>{
        const diff = (p - hist[hist.length-1])/hist[hist.length-1];
        let sig = diff>0.05?"KAUFEN":diff<-0.05?"VERKAUFEN":"HALTEN";
        html += `<tr>
            <td>KI${i+1}</td>
            <td>${p.toFixed(2)}</td>
            <td class="${sig.toLowerCase()}">${sig}</td>
            <td>${(diff*100).toFixed(1)}%</td>
            <td class="conf">${getConfidence(diff)}</td>
            <td>${timeStr}</td>
        </tr>`;
    });
    out.innerHTML = html;
}

function drawChart(hist, preds){
    if(chart) chart.destroy();
    const avg = preds.reduce((a,b)=>a+b,0)/preds.length;
    chart = new Chart(document.getElementById("chart"),{
        type:'line',
        data:{
            labels:hist.map((_,i)=>`T${i+1}`),
            datasets:[
                {label:"KI1", data:[...Array(hist.length-1).fill(null), preds[0]], borderColor:"#22c55e", fill:false},
                {label:"KI2", data:[...Array(hist.length-1).fill(null), preds[1]], borderColor:"#3b82f6", fill:false},
                {label:"KI3", data:[...Array(hist.length-1).fill(null), preds[2]], borderColor:"#f97316", fill:false},
                {label:"KI4", data:[...Array(hist.length-1).fill(null), preds[3]], borderColor:"#facc15", fill:false},
                {label:"Durchschnitt", data:[...Array(hist.length-1).fill(null), avg], borderColor:"#ffffff", fill:false}
            ]
        },
        options:{responsive:true, maintainAspectRatio:true}
    });
}

// ================== ANALYSE BUTTON ==================
analyseBtn.addEventListener("click", async ()=>{
    const sym = assetSelect.value;
    if(!sym){ alert("Bitte ein Asset auswählen"); return; }
    statusDiv.textContent = "Analyse läuft…";
    progressBar.value = 0;
    progressText.textContent = "Starte Berechnung…";

    try{
        const basePeriod = parseInt(periodSelect.value);
        const hist = await fetchHistorical(sym, basePeriod*2);
        progressBar.value = 25;
        progressText.textContent = "Historische Daten geladen…";

        const quote = await fetchQuote(sym);
        const fx = await fetchUsdChf();
        const priceCHF = quote*fx;
        currentPriceDiv.textContent = `Aktueller Kurs: ${priceCHF.toFixed(2)} CHF`;
        progressBar.value = 35;
        progressText.textContent = "Live-Kurs geladen…";

        const preds = [];
        for(let i=0;i<4;i++){
            preds[i] = await predictLSTM(hist, basePeriod+i*2)*fx;
            progressBar.value = 35 + (i+1)*15;
            progressText.textContent = `KI${i+1} fertig…`;
        }

        drawChart(hist.map(v=>v*fx), preds);
        displayTable(hist.map(v=>v*fx), preds, priceCHF);

        statusDiv.textContent = "Fertig ✔";
        progressBar.value = 100;
        progressText.textContent = "Analyse abgeschlossen";

    }catch(err){
        console.error(err);
        statusDiv.textContent = "Fehler: "+err;
        progressText.textContent = "Fehler";
    }
});

// ================== KAUF-LINKS ==================
document.getElementById("yahooBtn").addEventListener("click", ()=>{ window.open(`https://finance.yahoo.com/quote/${assetSelect.value}`,"_blank"); });
document.getElementById("tradingViewBtn").addEventListener("click", ()=>{ window.open(`https://www.tradingview.com/symbols/${assetSelect.value}/`,"_blank"); });
document.getElementById("swissquoteBtn").addEventListener("click", ()=>{ window.open(`https://www.swissquote.ch/sqw-en/private/trading/instruments/search?query=${assetSelect.value}`,"_blank"); });
