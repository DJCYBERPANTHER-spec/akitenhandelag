/* ==============================
   style.css – Finale Version
   ============================== */

body{
  background:#0f172a;
  color:#e5e7eb;
  font-family:Arial,sans-serif;
  margin:0;
  padding:15px;
}

h1{
  text-align:center;
  font-size:1.8rem;
}

.subtitle{
  text-align:center;
  color:#94a3b8;
  font-size:0.9rem;
  margin-bottom:12px;
}

.infoBox{
  text-align:center;
  margin:8px 0;
  font-size:0.9rem;
  font-weight:bold;
  padding:6px;
  border-radius:6px;
  background:#020617;
}

.controls{
  display:flex;
  justify-content:center;
  gap:8px;
  flex-wrap:wrap;
  margin:12px 0;
}

select,button{
  background:#020617;
  color:#e5e7eb;
  border:1px solid #22c55e;
  padding:8px 12px;
  border-radius:6px;
  font-size:0.85rem;
}

button:hover{
  background:#22c55e;
  color:#020617;
  cursor:pointer;
}

.status{
  text-align:center;
  margin:10px;
  font-weight:bold;
  font-size:0.9rem;
}

.loader{
  margin-top:6px;
  font-size:0.85rem;
  color:#a8dadc;
}

progress{
  border-radius:5px;
  height:18px;
}

canvas{
  max-width:100%;
  margin:18px auto;
  display:block;
  background:#020617;
  border-radius:10px;
}

table{
  width:100%;
  border-collapse:collapse;
  margin-top:10px;
  font-size:0.85rem;
  background:#020617;
}

th,td{
  border:1px solid #22c55e;
  padding:6px;
  text-align:center;
}

.buy{color:#22c55e;font-weight:bold;}
.sell{color:#ef4444;font-weight:bold;}
.hold{color:#facc15;font-weight:bold;}
.conf{color:#38bdf8;font-weight:bold;}

.footer{
  text-align:center;
  margin-top:14px;
  font-size:0.7rem;
  color:#94a3b8;
}

/* Signale farblich hervorheben */
.kaufen{color:#22c55e;font-weight:bold;}
.verkaufen{color:#ef4444;font-weight:bold;}
.halten{color:#facc15;font-weight:bold}
// --- Ensemble & KI-Auswertung
async function ensemble(hist){
  const ki1 = trendModel(hist);
  const ki2 = momentumModel(hist);
  const ki3 = volatilityModel(hist);
  const ki4Promise = trainLSTM(hist,7); // async
  return { ki1, ki2, ki3, ki4Promise };
}

// --- Signale & Konfidenz
function getSignal(diff){ return diff>0.05?"KAUFEN":diff<-0.05?"VERKAUFEN":"HALTEN"; }
function getConfidence(diff){ return Math.abs(diff)>0.1?"Hoch":Math.abs(diff)>0.05?"Mittel":"Niedrig"; }

// --- Warnungen
function checkWarnings(hist){
  if(hist.length<2) return "Keine akute Warnung";
  const lastReturn = (hist.at(-1)-hist[0])/hist[0];
  if(lastReturn>0.15) return "⚠️ Starker Anstieg prognostiziert!";
  if(lastReturn<-0.15) return "⚠️ Starker Rückgang prognostiziert!";
  return "Keine akute Warnung";
}

// --- Chart zeichnen
function drawChart(hist, prognosen){
  if(chart) chart.destroy();

  const ki4 = prognosen.ki4 || hist.at(-1);
  const avg = (prognosen.ki1+prognosen.ki2+prognosen.ki3+ki4)/4;

  chart = new Chart(chartCanvas,{
    type:"line",
    data:{
      labels: hist.map((_,i)=>`T${i+1}`),
      datasets:[
        {label:"Historisch", data:hist, borderColor:"#3b82f6", fill:false},
        {label:"Trend", data:[...Array(hist.length-1).fill(null),prognosen.ki1], borderColor:"#22c55e", fill:false},
        {label:"Momentum", data:[...Array(hist.length-1).fill(null),prognosen.ki2], borderColor:"#3b82f6", fill:false},
        {label:"Volatilität", data:[...Array(hist.length-1).fill(null),prognosen.ki3], borderColor:"#f97316", fill:false},
        {label:"LSTM", data:[...Array(hist.length-1).fill(null),ki4], borderColor:"#facc15", fill:false},
        {label:"Durchschnitt", data:[...Array(hist.length-1).fill(null),avg], borderColor:"#ffffff", fill:false}
      ]
    },
    options:{
      responsive:true,
      animation:{duration:0},
      plugins:{legend:{labels:{color:"#ffffff"}}},
      scales:{x:{ticks:{color:"#ffffff"}},y:{ticks:{color:"#ffffff"}}}
    }
  });
}

// --- Analyse starten
async function runAnalysis(sym){
  progressBar.value=0; progressText.textContent="Analyse startet…";
  statusDiv.textContent="Analyse läuft…";

  const hist = await fetchHistoricalData(sym,100);
  if(!hist || hist.length<2){ alert("Keine historischen Daten verfügbar!"); return; }

  const live = await fetchCurrentPrice(sym);
  if(!live || live===0){ alert("Kursdaten konnten nicht abgerufen werden!"); return; }

  currentPriceDiv.textContent=`Aktueller Kurs: ${live.toFixed(2)} CHF`;
  warningDiv.textContent = checkWarnings(hist);

  progressBar.value = 30; progressText.textContent="KI-Prognosen werden erstellt…";

  const prognosen = await ensemble(hist);

  // Chart sofort zeichnen mit klassischen KIs
  progressBar.value = 70; progressText.textContent="Chart wird gezeichnet…";
  drawChart(hist, prognosen);

  // Tabelle mit klassischen KIs
  const now = new Date().toLocaleString();
  let html = "";
  const ki4Val = hist.at(-1); 
  const avg = (prognosen.ki1+prognosen.ki2+prognosen.ki3+ki4Val)/4;

  ["ki1","ki2","ki3"].forEach((k,i)=>{
    const p = prognosen[k];
    const diff = (p-live)/live;
    const sig = getSignal(diff);
    html+=`<tr><td>KI${i+1}</td><td>${p.toFixed(2)}</td><td class="${sig.toLowerCase()}">${sig}</td><td>▲${(diff*100).toFixed(1)}%</td><td class="conf">${getConfidence(diff)}</td><td>${now}</td></tr>`;
  });

  html+=`<tr><td>Durchschnitt</td><td>${avg.toFixed(2)}</td><td>-</td><td>-</td><td>-</td><td>${now}</td></tr>`;
  outTable.innerHTML = html;

  progressBar.value=100; progressText.textContent="Fertig"; statusDiv.textContent="Analyse abgeschlossen";

  // LSTM async Update Chart & Tabelle
  prognosen.ki4Promise.then(ki4=>{
    prognosen.ki4 = ki4;
    drawChart(hist, prognosen);

    const diff = (ki4-live)/live;
    const sig = getSignal(diff);
    html += `<tr><td>LSTM</td><td>${ki4.toFixed(2)}</td><td class="${sig.toLowerCase()}">${sig}</td><td>▲${(diff*100).toFixed(1)}%</td><td class="conf">${getConfidence(diff)}</td><td>${now}</td></tr>`;
    outTable.innerHTML = html;
  });

  // 7-Tage Check (nur Demo – async)
  setTimeout(async ()=>{
    const newLive = await fetchCurrentPrice(sym);
    const diff7 = ((newLive-avg)/avg*100).toFixed(2);
    console.log(`Prognose für ${sym} nach 7 Tagen: Abweichung ${diff7}%`);
  },7*24*60*60*1000);
}

// --- DOM Setup
document.addEventListener("DOMContentLoaded", async ()=>{
  assetSelect = document.getElementById("assetSelect");
  analyseBtn = document.getElementById("analyseBtn");
  currentPriceDiv = document.getElementById("currentPrice");
  warningDiv = document.getElementById("warning");
  progressBar = document.getElementById("progressBar");
  progressText = document.getElementById("progressText");
  statusDiv = document.getElementById("status");
  outTable = document.getElementById("out");
  chartCanvas = document.getElementById("chart");

  // Dropdown füllen
  ASSETS.forEach(a=>{
    const o = document.createElement("option");
    o.value = a.symbol;
    o.textContent = `${a.name} (${a.symbol})`;
    assetSelect.appendChild(o);
  });

  // Button Event
  analyseBtn.addEventListener("click", async ()=>{
    if(!assetSelect.value){ alert("Bitte Asset auswählen!"); return; }
    await runAnalysis(assetSelect.value);
  });

  // Live Kurs Interval
  liveInterval = setInterval(async ()=>{
    const live = await fetchCurrentPrice(assetSelect.value);
    currentPriceDiv.textContent=`Aktueller Kurs: ${live.toFixed(2)} CHF`;
  },5000);

  // Automatische Startanalyse
  const randomAsset = getRandomAsset().symbol;
  assetSelect.value = randomAsset;
  await runAnalysis(randomAsset);
});

// --- Kauf-Links
function openYahoo(){ window.open(`https://finance.yahoo.com/quote/${assetSelect.value}`,"_blank"); }
function openTradingView(){ window.open(`https://www.tradingview.com/symbols/${assetSelect.value}/`,"_blank"); }
function openSwissquote(){ window.open(`https://www.swissquote.ch/sqw-en/private/trading/instruments/search?query=${assetSelect.value}`,"_blank"); }
