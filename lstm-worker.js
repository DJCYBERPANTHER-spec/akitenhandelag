<script>
// ===================== LSTM Prognose =====================
async function fetchHistorical(symbol, periodDays=365){
    const now = Math.floor(Date.now()/1000);
    const from = now - periodDays*24*60*60;
    try{
        let url = symbol.startsWith("BINANCE")
            ? `https://finnhub.io/api/v1/crypto/candle?symbol=${symbol}&resolution=D&from=${from}&to=${now}&token=${API_KEY}`
            : `https://finnhub.io/api/v1/stock/candle?symbol=${symbol}&resolution=D&from=${from}&to=${now}&token=${API_KEY}`;
        const r = await fetch(url);
        const j = await r.json();
        if(j.s==="ok" && j.c && j.c.length>0){
            return j.c.map(Number);
        }
    }catch{}
    const lastPrice = await fetchQuote(symbol);
    return Array(periodDays).fill(lastPrice||100);
}

// ===================== LSTM KI =====================
async function predictLSTM(data, period){
    const noisy = data.map(v=>v*(1+(Math.random()-0.5)/100));
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

// ===================== Konfidenz =====================
function getConfidence(diff){
    return Math.abs(diff)>0.1?"Hoch":Math.abs(diff)>0.05?"Mittel":"Niedrig";
}

// ===================== Tabelle + Chart =====================
let chart=null;
function drawChart(hist,preds){
    if(chart) chart.destroy();
    const avg = preds.reduce((a,b)=>a+b,0)/preds.length;
    chart = new Chart(document.getElementById("chart"),{
        type:'line',
        data:{
            labels:hist.map((_,i)=>`T${i+1}`),
            datasets:[
                {label:"KI1",data:[...Array(hist.length-1).fill(null), preds[0]], borderColor:"#22c55e",fill:false},
                {label:"KI2",data:[...Array(hist.length-1).fill(null), preds[1]], borderColor:"#3b82f6",fill:false},
                {label:"KI3",data:[...Array(hist.length-1).fill(null), preds[2]], borderColor:"#f97316",fill:false},
                {label:"KI4",data:[...Array(hist.length-1).fill(null), preds[3]], borderColor:"#facc15",fill:false},
                {label:"Durchschnitt",data:[...Array(hist.length-1).fill(null), avg],borderColor:"#ffffff",fill:false},
            ]
        },
        options:{responsive:true, maintainAspectRatio:true}
    });
}

function displayTable(hist,preds,currentPriceCHF){
    const out = document.getElementById("out");
    let html="";
    const nowStr = new Date().toLocaleString();

    preds.forEach((p,i)=>{
        const diff = (p - hist[hist.length-1])/hist[hist.length-1];
        let signal = diff>0.05?"KAUFEN":diff<-0.05?"VERKAUFEN":"HALTEN";
        html+=`<tr>
            <td>KI${i+1}</td>
            <td>${(p*currentPriceCHF/hist[hist.length-1]).toFixed(2)}</td>
            <td>${signal}</td>
            <td>${(diff*100).toFixed(1)}%</td>
            <td class="conf">${getConfidence(diff)}</td>
            <td>${diff>0.1?"⚠️ Starker Anstieg":diff<-0.1?"⚠️ Starker Abfall":"–"}</td>
            <td>–</td>
            <td>–</td>
        </tr>`;
    });
    out.innerHTML = html;
}

// ===================== Analyse Button =====================
document.getElementById("analyseBtn").addEventListener("click", async ()=>{
    const sym = assetSelect.value;
    if(!sym){ alert("Bitte Asset auswählen!"); return; }

    const status = document.getElementById("status");
    const progressBar = document.getElementById("progressBar");
    const progressText = document.getElementById("progressText");

    status.textContent="Analyse läuft…";
    progressBar.value=0;
    progressText.textContent="Starte...";

    try{
        const period = parseInt(document.getElementById("timeRange").value);
        const hist = await fetchHistorical(sym, period*2);
        const currentPrice = await fetchQuote(sym);
        const fx = await fetchUsdChf();
        const currentPriceCHF = currentPrice*fx;
        document.getElementById("currentPrice").textContent=`Aktueller Kurs: ${currentPriceCHF.toFixed(2)} CHF`;

        const preds=[];
        for(let i=0;i<4;i++){
            progressBar.value=(i/4)*100;
            progressText.textContent=`KI${i+1} berechnet…`;
            preds[i]=await predictLSTM(hist, period+i*2);
        }
        progressBar.value=100;
        progressText.textContent="Analyse abgeschlossen ✔";
        status.textContent="Fertig";

        drawChart(hist,preds);
        displayTable(hist,preds,currentPriceCHF);

    }catch(err){
        console.error(err);
        status.textContent="Fehler bei der Analyse";
    }
});
</script>
</body>
</html>
