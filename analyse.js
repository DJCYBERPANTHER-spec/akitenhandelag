// analyse.js – Erweiterung für 7-Tage Prognose bei Seitenstart

let lastPredictionTime = localStorage.getItem("lastPredictionTime") || 0;  // Speichern der Zeit der letzten Prognose
let isInitialPredictionMade = false;  // Flag für initiale Prognose
let lastPredictionAccuracy = null;  // Letzte Genauigkeit der Prognose

// --- Automatische KI Prognose bei Seitenstart ---
async function autoPredictOnStart() {
  const now = Date.now();
  const timeElapsed = now - lastPredictionTime;

  // Wenn mehr als 24 Stunden vergangen sind, Prognose automatisch erstellen
  if (timeElapsed > 24 * 60 * 60 * 1000 || !lastPredictionTime) {
    const selectedAsset = ASSETS[Math.floor(Math.random() * ASSETS.length)].symbol;  // Zufälliges Asset auswählen
    await runPredictionForAsset(selectedAsset);
    localStorage.setItem("lastPredictionTime", now);  // Zeit der letzten Prognose speichern
  }

  // Zeige die Prognosegenauigkeit
  if (lastPredictionAccuracy !== null) {
    document.getElementById("status").textContent = `Letzte Prognose Genauigkeit: ${lastPredictionAccuracy}%`;
  }
}

// --- Prognose für ein bestimmtes Asset ---
async function runPredictionForAsset(sym) {
  const period = 7;  // Prognose für 7 Tage
  const hist = await fetchHistoricalData(sym, period * 2);
  const actualPrice = await fetchQuote(sym);
  const predictedPrices = [];

  for (let i = 0; i < 4; i++) {
    const prediction = await predictKI(hist, period, i);  // Vorhersage für jede KI
    predictedPrices.push(prediction);
  }

  // Berechne die Genauigkeit
  const avgPrediction = predictedPrices.reduce((a, b) => a + b, 0) / predictedPrices.length;
  const accuracy = ((avgPrediction - actualPrice) / actualPrice) * 100;
  lastPredictionAccuracy = accuracy.toFixed(2);

  // Zeige die Prognose und die Genauigkeit an
  document.getElementById("status").textContent = `Prognose für ${sym} gemacht! Genauigkeit: ${lastPredictionAccuracy}%`;
  console.log(`Prognose für ${sym} gemacht! Genauigkeit: ${lastPredictionAccuracy}%`);

  // Nach 7 Tagen vergleichen wir die Prognose mit dem tatsächlichen Wert
  setTimeout(async () => {
    const newActualPrice = await fetchQuote(sym);
    const diff = ((newActualPrice - avgPrediction) / avgPrediction) * 100;
    console.log(`Prognose für ${sym} war um ${diff.toFixed(2)}% abweichend von der tatsächlichen Kursentwicklung.`);
  }, 7 * 24 * 60 * 60 * 1000); // Nach 7 Tagen vergleichen
}

// --- Seitenstart – 7-Tage Prognose automatisch ausführen ---
document.addEventListener("DOMContentLoaded", async () => {
  if (!isInitialPredictionMade) {
    await autoPredictOnStart();  // Prognose durchführen
    isInitialPredictionMade = true;
  }
});
