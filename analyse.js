// ==============================
// multiKI.js – reine Prognose-KI
// ==============================

import * as tf from "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.10.0/dist/tf.min.js";

// -----------------
// Assets Beispiel
// -----------------
const ASSETS = [
  {symbol:"AAPL",name:"Apple Inc."},
  {symbol:"MSFT",name:"Microsoft Corp."},
  {symbol:"BTC-USD",name:"Bitcoin"},
  {symbol:"ETH-USD",name:"Ethereum"},
  // ...weitere Assets hier
];

// -----------------
// Hilfsfunktionen
// -----------------
function isCrypto(sym){ return sym.includes("-USD"); }
function daysToSeconds(days){ return days*24*60*60; }

// -----------------
// USD → CHF
// -----------------
async function fetchUsdChf(){
  try{
    const r = await fetch("https://api.exchangerate.host/latest?base=USD&symbols=CHF");
    const j = await r.json();
    return j?.rates?.CHF || 0.93;
  }catch{return 0.93;}
}

// -----------------
// Live- und Historische Kurse
// -----------------
async function fetchStock(sym, days=365){
  const API_KEY = "HIER_DEIN_FINNHUB_KEY";
  const now = Math.floor(Date.now()/1000);
  const from = now - daysToSeconds(days);
  try{
    const r = await fetch(`https://finnhub.io/api/v1/stock/candle?symbol=${sym}&resolution=D&from=${from}&to=${now}&token=${API_KEY}`);
    const j = await r.json();
    return j.c || [];
  }catch{return [];}
}

async function fetchCrypto(sym, days=365){
  const id = sym.toLowerCase().replace("-usd","");
  try{
    const r = await fetch(`https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=${days}`);
    const j = await r.json();
    return j.prices.map(p=>p[1]);
  }catch{return [];}
}

async function fetchHistoricalData(sym, days=365){
  const fx = await fetchUsdChf();
  const hist = isCrypto(sym)? await fetchCrypto(sym,days) : await fetchStock(sym,days);
  return hist.map(v=>v*fx);
}

// -----------------
// KI-Modelle
// -----------------
function trendModel(hist){ return hist.at(-1) + (hist.at(-1)-hist[0])/hist.length*7; }
function momentumModel(hist){ return hist.at(-1) + (hist.at(-1)-hist.at(Math.max(0,hist.length-5)))*1.5; }
function volatilityModel(hist){ 
  const avg = hist.reduce((a,b)=>a+b,0)/hist.length; 
  return avg + (hist.at(-1)-avg)*0.5; 
}

let lstmModel = null;
async function trainOrUpdateLSTM(hist, period=7){
  const X=[], Y=[];
  for(let i=0;i<hist.length-period;i++){
    X.push(hist.slice(i,i+period).map(v=>[v]));
    Y.push([hist[i+period]]);
  }
  if(X.length===0) return hist.at(-1);

  const xs = tf.tensor3d(X);
  const ys = tf.tensor2d(Y);

  if(!lstmModel){
    lstmModel = tf.sequential();
    lstmModel.add(tf.layers.lstm({units:20,inputShape:[period,1]}));
    lstmModel.add(tf.layers.dense({units:1}));
    lstmModel.compile({optimizer:"adam",loss:"meanSquaredError"});
    await lstmModel.fit(xs,ys,{epochs:20,verbose:0});
  } else {
    await lstmModel.fit(xs,ys,{epochs:10,verbose:0});
  }

  return lstmModel.predict(tf.tensor3d([X.at(-1)])).dataSync()[0];
}

// -----------------
// Ensemble mit adaptiver Gewichtung
// -----------------
async function ensemble(hist, weights={trend:0.25,momentum:0.25,volatility:0.25,lstm:0.25}){
  const t = trendModel(hist);
  const m = momentumModel(hist);
  const v = volatilityModel(hist);
  const l = await trainOrUpdateLSTM(hist,7);

  // gewichtete Prognose
  const pred = t*weights.trend + m*weights.momentum + v*weights.volatility + l*weights.lstm;
  return {trend:t, momentum:m, volatility:v, lstm:l, forecast:pred};
}

// -----------------
// Prognosen für verschiedene Zeiträume
// -----------------
async function multiHorizonForecast(sym){
  const horizons = {
    "24h":1,
    "1 Monat":30,
    "3 Monate":90,
    "6 Monate":180,
    "1 Jahr":365,
    "3 Jahre":365*3,
    "5 Jahre":365*5,
    "10 Jahre":365*10
  };

  const hist = await fetchHistoricalData(sym,365*3); // letzte 3 Jahre für Training
  const results = {};

  for(const [label,days] of Object.entries(horizons)){
    // einfache Fortschreibung + KI
    const futureHist = hist.slice(-days);
    const ens = await ensemble(futureHist);
    results[label] = ens.forecast;
  }

  return results;
}

// -----------------
// Kontinuierliches Lernen
// -----------------
async function continuousLearning(){
  for(const a of ASSETS){
    const hist = await fetchHistoricalData(a.symbol,365);
    await trainOrUpdateLSTM(hist,7);
  }
  console.log("Kontinuierliches LSTM-Training abgeschlossen für alle Assets");
}

// alle 24h trainieren
setInterval(continuousLearning, 24*60*60*1000);

// -----------------
// Export Funktionen
// -----------------
export {ASSETS, fetchHistoricalData, ensemble, multiHorizonForecast, continuousLearning};
