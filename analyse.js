// ===============================
// TEIL 1 – ASSETS & DATEN
// ===============================

const API_KEY = "d5qi0c9r01qhn30fr1r0d5qi0c9r01qhn30fr1rg";

// -------- ASSETS --------
const STOCKS = [
  { symbol: "AAPL", name: "Apple" },
  { symbol: "MSFT", name: "Microsoft" },
  { symbol: "NVDA", name: "Nvidia" },
  { symbol: "TSLA", name: "Tesla" },
  { symbol: "AMZN", name: "Amazon" }
];

const CRYPTOS = [
  { symbol: "BTC-USD", name: "Bitcoin" },
  { symbol: "ETH-USD", name: "Ethereum" },
  { symbol: "SOL-USD", name: "Solana" },
  { symbol: "ADA-USD", name: "Cardano" },
  { symbol: "XRP-USD", name: "Ripple" }
];

const ALL_ASSETS = [...STOCKS, ...CRYPTOS];

// -------- DOM READY --------
document.addEventListener("DOMContentLoaded", () => {
  const sel = document.getElementById("assetSelect");
  sel.innerHTML = "";

  ALL_ASSETS.forEach(a => {
    const o = document.createElement("option");
    o.value = a.symbol;
    o.textContent = `${a.name} (${a.symbol})`;
    sel.appendChild(o);
  });

  document.getElementById("analyseBtn")
    .addEventListener("click", startAnalysis);

  document.getElementById("status").textContent = "Bereit";
});

// -------- DATEN ABRUF --------
async function fetchHistory(symbol, days = 100) {
  const isCrypto = symbol.includes("-USD");
  const url = isCrypto
    ? `https://api.coingecko.com/api/v3/coins/${symbol.replace("-USD","").toLowerCase()}/market_chart?vs_currency=usd&days=${days}`
    : `https://finnhub.io/api/v1/stock/candle?symbol=${symbol}&resolution=D&count=${days}&token=${API_KEY}`;

  const r = await fetch(url);
  const d = await r.json();

  if (isCrypto) return d.prices.map(p => p[1]);
  if (d.s !== "ok") throw "Keine Aktiendaten";
  return d.c;
}
// ===============================
// TEIL 2 – KI & BACKTEST
// ===============================

function normalize(arr) {
  const min = Math.min(...arr);
  const max = Math.max(...arr);
  return arr.map(v => (v - min) / (max - min));
}

async function trainModel(series, units) {
  const model = tf.sequential();
  model.add(tf.layers.lstm({ units, inputShape: [1,1] }));
  model.add(tf.layers.dense({ units: 1 }));
  model.compile({ optimizer: "adam", loss: "mse" });

  const t = tf.tensor(series).reshape([series.length,1,1]);
  await model.fit(t, t, { epochs: 40, verbose: 0 });
  return model;
}

async function ensemblePredict(data) {
  const scaled = normalize(data);
  const models = [
    await trainModel(scaled, 16),
    await trainModel(scaled, 32),
    await trainModel(scaled, 48),
    await trainModel(scaled, 64)
  ];

  const last = tf.tensor([scaled.at(-1)]).reshape([1,1,1]);
  const preds = models.map(m => m.predict(last).dataSync()[0]);

  return preds.reduce((a,b)=>a+b,0) / preds.length;
}

function backtest(data) {
  let hits = 0;
  for (let i = 20; i < data.length - 1; i++) {
    const trend = data[i] > data[i-1];
    const real = data[i+1] > data[i];
    if (trend === real) hits++;
  }
  return Math.round((hits / (data.length - 21)) * 100);
}
// ===============================
// TEIL 3 – PROGNOSE & UI
// ===============================

let chart;

async function startAnalysis() {
  const symbol = document.getElementById("assetSelect").value;
  document.getElementById("status").textContent = "Analyse läuft…";

  try {
    const history = await fetchHistory(symbol);
    const current = history.at(-1);
    const prediction = await ensemblePredict(history);

    const horizons = {
      "24h": prediction,
      "1M": prediction * 1.03,
      "3M": prediction * 1.08,
      "6M": prediction * 1.15,
      "1Y": prediction * 1.25,
      "3Y": prediction * 1.6,
      "5Y": prediction * 2,
      "10Y": prediction * 3
    };

    const conf = backtest(history);

    renderChart(history, prediction);
    renderTable(horizons, current, conf);

    document.getElementById("currentPrice").textContent =
      "Aktueller Kurs: " + current.toFixed(2);

    document.getElementById("status").textContent = "Analyse abgeschlossen";

  } catch(e) {
    document.getElementById("status").textContent = "Fehler bei Analyse";
    console.error(e);
  }
}

function renderChart(data, pred) {
  if (chart) chart.destroy();
  chart = new Chart(document.getElementById("chart"), {
    type: "line",
    data: {
      labels: data.map((_,i)=>i),
      datasets: [
        { label: "Historisch", data },
        { label: "Prognose", data: [...data.slice(-10), pred] }
      ]
    }
  });
}

function renderTable(horizons, current, conf) {
  const out = document.getElementById("out");
  out.innerHTML = "";

  Object.entries(horizons).forEach(([h,v]) => {
    const tr = document.createElement("tr");
    const delta = ((v-current)/current*100).toFixed(2);

    tr.innerHTML = `
      <td>Ensemble-KI</td>
      <td>${v.toFixed(2)}</td>
      <td class="${delta>0?"buy":"sell"}">${delta>0?"BUY":"SELL"}</td>
      <td>${delta}%</td>
      <td class="conf">${conf}%</td>
      <td>${new Date().toLocaleString()}</td>
    `;
    out.appendChild(tr);
  });
}
