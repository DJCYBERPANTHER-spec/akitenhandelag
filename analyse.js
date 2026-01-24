/**********************************************************
 * analyse.js – Profi KI Aktien & Krypto Analyse (ERWEITERT)
 **********************************************************/

const API_KEY = "d5ohqjhr01qjast6qrjgd5ohqjhr01qjast6qrk0";
let chart = null;

/* ===================== ASSETS ===================== */
/* 👉 Hier kannst du jederzeit selbst Assets ergänzen */

const ASSETS = [

  /* ===== AKTIEN (USA & GLOBAL) ===== */
  { symbol: "AAPL", name: "Apple" },
  { symbol: "MSFT", name: "Microsoft" },
  { symbol: "NVDA", name: "NVIDIA" },
  { symbol: "AMZN", name: "Amazon" },
  { symbol: "GOOGL", name: "Alphabet" },
  { symbol: "META", name: "Meta Platforms" },
  { symbol: "TSLA", name: "Tesla" },
  { symbol: "AMD", name: "AMD" },
  { symbol: "INTC", name: "Intel" },
  { symbol: "NFLX", name: "Netflix" },
  { symbol: "ORCL", name: "Oracle" },
  { symbol: "IBM", name: "IBM" },
  { symbol: "BABA", name: "Alibaba" },
  { symbol: "DIS", name: "Disney" },
  { symbol: "JPM", name: "JP Morgan" },
  { symbol: "V", name: "Visa" },
  { symbol: "MA", name: "Mastercard" },
  { symbol: "KO", name: "Coca-Cola" },
  { symbol: "PEP", name: "PepsiCo" },
  { symbol: "NKE", name: "Nike" },
  { symbol: "PFE", name: "Pfizer" },
  { symbol: "XOM", name: "Exxon Mobil" },
  { symbol: "CVX", name: "Chevron" },
  { symbol: "BA", name: "Boeing" },

  /* ===== KRYPTOWÄHRUNGEN ===== */
  { symbol: "BTC-USD", name: "Bitcoin" },
  { symbol: "ETH-USD", name: "Ethereum" },
  { symbol: "BNB-USD", name: "Binance Coin" },
  { symbol: "SOL-USD", name: "Solana" },
  { symbol: "ADA-USD", name: "Cardano" },
  { symbol: "XRP-USD", name: "Ripple" },
  { symbol: "DOGE-USD", name: "Dogecoin" },
  { symbol: "DOT-USD", name: "Polkadot" },
  { symbol: "AVAX-USD", name: "Avalanche" },
  { symbol: "LINK-USD", name: "Chainlink" },
  { symbol: "MATIC-USD", name: "Polygon" },
  { symbol: "ATOM-USD", name: "Cosmos" },
  { symbol: "LTC-USD", name: "Litecoin" },
  { symbol: "TRX-USD", name: "TRON" },
  { symbol: "XLM-USD", name: "Stellar" },
  { symbol: "ETC-USD", name: "Ethereum Classic" },
  { symbol: "NEAR-USD", name: "Near Protocol" },
  { symbol: "ICP-USD", name: "Internet Computer" }
];

/* ===================== DOM ===================== */

const assetSelect = document.getElementById("assetSelect");
const timeRange = document.getElementById("timeRange");
const analyseBtn = document.getElementById("analyseBtn");
const currentPriceDiv = document.getElementById("currentPrice");
const warningDiv = document.getElementById("warning");
const statusDiv = document.getElementById("status");
const loaderDiv = document.getElementById("loader");
const progressBar = document.getElementById("progressBar");
const progressText = document.getElementById("progressText");
const outTable = document.getElementById("out");
const chartCanvas = document.getElementById("chart");

/* ===================== INIT ===================== */

ASSETS.forEach(a => {
  const o = document.createElement("option");
  o.value = a.symbol;
  o.textContent = `${a.name} (${a.symbol})`;
  assetSelect.appendChild(o);
});

analyseBtn.addEventListener("click", run);

/* ===================== HILFSFUNKTIONEN ===================== */

async function fetchUsdChf() {
  try {
    const r = await fetch("https://api.exchangerate.host/latest?base=USD&symbols=CHF");
    const j = await r.json();
    return j?.rates?.CHF || 0.93;
  } catch {
    return 0.93;
  }
}

async function fetchQuote(sym) {
  try {
    if (sym.includes("USD")) return fetchCrypto(sym);
    const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${sym}&token=${API_KEY}`);
    const j = await r.json();
    return j.c || 100;
  } catch {
    return 100;
  }
}

async function fetchCrypto(sym) {
  const map = {
    "BTC-USD": "bitcoin", "ETH-USD": "ethereum", "BNB-USD": "binancecoin",
    "SOL-USD": "solana", "ADA-USD": "cardano", "XRP-USD": "ripple",
    "DOGE-USD": "dogecoin", "DOT-USD": "polkadot", "AVAX-USD": "avalanche-2",
    "LINK-USD": "chainlink", "MATIC-USD": "polygon",
    "ATOM-USD": "cosmos", "LTC-USD": "litecoin",
    "TRX-USD": "tron", "XLM-USD": "stellar",
    "ETC-USD": "ethereum-classic", "NEAR-USD": "near",
    "ICP-USD": "internet-computer"
  };
  const id = map[sym];
  if (!id) return 100;

  try {
    const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`);
    const j = await r.json();
    return j[id]?.usd || 100;
  } catch {
    return 100;
  }
}

async function fetchHistoricalData(sym, days) {
  try {
    if (sym.includes("USD")) {
      const map = {
        "BTC-USD": "bitcoin", "ETH-USD": "ethereum", "BNB-USD": "binancecoin",
        "SOL-USD": "solana", "ADA-USD": "cardano", "XRP-USD": "ripple",
        "DOGE-USD": "dogecoin", "DOT-USD": "polkadot", "AVAX-USD": "avalanche-2",
        "LINK-USD": "chainlink", "MATIC-USD": "polygon",
        "ATOM-USD": "cosmos", "LTC-USD": "litecoin",
        "TRX-USD": "tron", "XLM-USD": "stellar",
        "ETC-USD": "ethereum-classic", "NEAR-USD": "near",
        "ICP-USD": "internet-computer"
      };
      const id = map[sym];
      const r = await fetch(`https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=${days}`);
      const j = await r.json();
      return j.prices.map(p => p[1]);
    } else {
      const now = Math.floor(Date.now() / 1000);
      const from = now - days * 86400;
      const r = await fetch(`https://finnhub.io/api/v1/stock/candle?symbol=${sym}&resolution=D&from=${from}&to=${now}&token=${API_KEY}`);
      const j = await r.json();
      return j.s === "ok" ? j.c : [];
    }
  } catch {
    return [];
  }
}

/* ===================== KI ===================== */

async function predictKI(hist, period, index) {
  if (hist.length < period + 5) return Array(7).fill(hist.at(-1) || 100);

  const min = Math.min(...hist);
  const max = Math.max(...hist);
  const norm = hist.map(v => (v - min) / (max - min || 1));

  let X = [], Y = [];
  for (let i = 0; i < norm.length - period; i++) {
    X.push(norm.slice(i, i + period).map(v => [v]));
    Y.push([norm[i + period]]);
  }

  const xs = tf.tensor3d(X);
  const ys = tf.tensor2d(Y);

  const model = tf.sequential();
  model.add(tf.layers.lstm({ units: 14 + index * 4, inputShape: [period, 1] }));
  model.add(tf.layers.dense({ units: 1 }));
  model.compile({ optimizer: "adam", loss: "meanSquaredError" });

  await model.fit(xs, ys, { epochs: 8, verbose: 0 });

  let seq = norm.slice(-period);
  let preds = [];

  for (let i = 0; i < 7; i++) {
    const t = tf.tensor3d([seq.map(v => [v])]);
    const p = model.predict(t).dataSync()[0];
    preds.push(p * (max - min) + min);
    seq.shift(); seq.push(p);
    t.dispose();
  }

  xs.dispose(); ys.dispose(); model.dispose();
  return preds;
}

/* ===================== WARNUNGEN & SIGNAL ===================== */

function generateWarnings(hist, preds) {
  const last = hist.at(-1);
  const avg = preds.reduce((a, b) => a + b, 0) / preds.length;
  const diff = (avg - last) / last;

  if (diff > 0.18) return "🚀 Sehr starker KI-Anstieg prognostiziert!";
  if (diff > 0.10) return "📈 Deutlicher KI-Anstieg prognostiziert";
  if (diff < -0.18) return "📉 Starker Rückgang prognostiziert!";
  return "Keine akute Warnung";
}

function getSignal(diff) {
  if (diff > 0.05) return "buy";
  if (diff < -0.05) return "sell";
  return "hold";
}

function getConfidence(diff) {
  const a = Math.abs(diff);
  if (a > 0.15) return "Hoch";
  if (a > 0.08) return "Mittel";
  return "Niedrig";
}

/* ===================== CHART ===================== */

function drawChart(hist, allPreds) {
  if (chart) chart.destroy();

  const avg = Array(7).fill(0).map((_, i) =>
    allPreds.reduce((s, p) => s + p[i], 0) / allPreds.length
  );

  chart = new Chart(chartCanvas, {
    type: "line",
    data: {
      labels: [...hist.map((_, i) => `T${i+1}`), "T+1","T+2","T+3","T+4","T+5","T+6","T+7"],
      datasets: [
        { label: "Historisch", data: hist, borderColor: "#3b82f6", tension: 0.2 },
        ...allPreds.map((p, i) => ({
          label: `KI${i+1}`,
          data: Array(hist.length).fill(null).concat(p),
          borderColor: ["#22c55e","#f97316"][i],
          tension: 0.3
        })),
        {
          label: "Durchschnitt",
          data: Array(hist.length).fill(null).concat(avg),
          borderColor: "#ffffff",
          borderWidth: 2
        }
      ]
    }
  });
}

/* ===================== MAIN ===================== */

async function run() {
  try {
    statusDiv.textContent = "Analyse läuft…";
    loaderDiv.textContent = "Daten & KI werden geladen…";
    outTable.innerHTML = "";

    const sym = assetSelect.value;
    const fx = await fetchUsdChf();
    const live = await fetchQuote(sym);
    currentPriceDiv.textContent = `Aktueller Kurs: ${(live * fx).toFixed(2)} CHF`;

    const period = parseInt(timeRange.value);
    const hist = await fetchHistoricalData(sym, period * 2);

    const ki1 = await predictKI(hist, period, 0);
    const ki2 = await predictKI(hist, period, 1);
    const allPreds = [ki1, ki2];

    warningDiv.textContent = generateWarnings(hist, [...ki1, ...ki2]);
    drawChart(hist, allPreds);

    const ts = new Date().toLocaleString();

    allPreds.forEach((p, i) => {
      const diff = (p[0] - live) / live;
      const arrow = diff > 0 ? "▲" : diff < 0 ? "▼" : "→";
      const sig = getSignal(diff);

      outTable.insertAdjacentHTML("beforeend", `
        <tr>
          <td>KI${i+1}</td>
          <td>${p[0].toFixed(2)}</td>
          <td class="${sig}">${sig.toUpperCase()}</td>
          <td>${arrow} ${(diff*100).toFixed(1)}%</td>
          <td class="conf">${getConfidence(diff)}</td>
          <td>${ts}</td>
        </tr>
      `);
    });

    statusDiv.textContent = "Fertig";
    loaderDiv.textContent = "–";

  } catch (e) {
    console.error(e);
    statusDiv.textContent = "Fehler";
    loaderDiv.textContent = "Analyse fehlgeschlagen";
  }
}

/* ===================== LINKS ===================== */

function openYahoo() {
  window.open(`https://finance.yahoo.com/quote/${assetSelect.value}`, "_blank");
}
function openTradingView() {
  window.open(`https://www.tradingview.com/symbols/${assetSelect.value}/`, "_blank");
}
