// ==============================
// fullAnalysisEngine.js – alle Assets + Multi-Horizon Prognose
// ==============================

import * as tf from "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.10.0/dist/tf.min.js";

// -----------------
// Assets Beispiel
// -----------------
const ASSETS = [
  {symbol:"AAPL",name:"Apple Inc."},{symbol:"MSFT",name:"Microsoft Corp."},
  {symbol:"NVDA",name:"NVIDIA Corp."},{symbol:"TSLA",name:"Tesla Inc."},
  {symbol:"BTC-USD",name:"Bitcoin"},{symbol:"ETH-USD",name:"Ethereum"},
  // ...füge hier weitere Assets bis 100+ hinzu
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
// Historische Daten
// -----------------
const FINNHUB_KEY = "d5qi0c9r01qhn30fr1r0d5qi0c9r01qhn30fr1rg";

async function fetchStock(sym, days=365){
  const now = Math.floor(Date.now()/1000);
  const from = now - daysToSeconds(days);
  try{
    const r = await fetch(`https://finnhub.io/api/v1/stock/candle?symbol=${sym}&resolution=D&from=${from}&to=${now}&token=${FINNHUB_KEY}`);
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

let lstmModels = {}; // pro Asset eigenes LSTM
async function trainOrUpdateLSTM(sym, hist, period=7){
  if(!lstmModels[sym]) lstmModels[sym] = tf.sequential();
  const model = lstmModels[sym];
  const X=[], Y=[];
  for(let i=0;i<hist.length-period;i++){
    X.push(hist.slice(i,i+period).map(v=>[v]));
    Y.push([hist[i+period]]);
  }
  if(X.length===0) return hist.at(-1);

  const xs = tf.tensor3d(X);
  const ys = tf.tensor2d(Y);

  if(model.layers.length===0){
    model.add(tf.layers.lstm({units:20,inputShape:[period,1]}));
    model.add(tf.layers.dense({units:1}));
    model.compile({optimizer:"adam",loss:"meanSquaredError"});
    await model.fit(xs,ys,{epochs:15,verbose:0});
  } else {
    await model.fit(xs,ys,{epochs:7,verbose:0});
  }

  return model.predict(tf.tensor3d([X.at(-1)])).dataSync()[0];
}

// -----------------
// Adaptive Ensemble pro Asset
// -----------------
let weights = {trend:0.25, momentum:0.25, volatility:0.25, lstm:0.25};

async function adaptiveEnsemble(sym, hist, actualPrice=null){
  const t = trendModel(hist);
  const m = momentumModel(hist);
  const v = volatilityModel(hist);
  const l = await trainOrUpdateLSTM(sym, hist,7);

  let pred = t*weights.trend + m*weights.momentum + v*weights.volatility + l*weights.lstm;

  if(actualPrice){
    const errors = {trend: Math.abs(t-actualPrice), momentum: Math.abs(m-actualPrice),
                    volatility: Math.abs(v-actualPrice), lstm: Math.abs(l-actualPrice)};
    const sum = Object.values(errors).reduce((a,b)=>a+b,0) || 1;
    weights.trend = (1-errors.trend/sum); 
    weights.momentum = (1-errors.momentum/sum);
    weights.volatility = (1-errors.volatility/sum);
    weights.lstm = (1-errors.lstm/sum);

    const wSum = Object.values(weights).reduce((a,b)=>a+b,0);
    for(const k in weights) weights[k] /= wSum;

    pred = t*weights.trend + m*weights.momentum + v*weights.volatility + l*weights.lstm;
  }

  return {trend:t, momentum:m, volatility:v, lstm:l, forecast:pred, weights:{...weights}};
}

// -----------------
// Multi-Horizon Prognosen pro Asset
// -----------------
async function multiHorizonForecast(sym){
  const horizons = {
    "24h":1, "1 Monat":30, "3 Monate":90, "6 Monate":180,
    "1 Jahr":365, "3 Jahre":365*3, "5 Jahre":365*5, "10 Jahre":365*10
  };

  const hist = await fetchHistoricalData(sym,365*3);
  const results = {};

  for(const [label,days] of Object.entries(horizons)){
    const sliceHist = hist.slice(-Math.min(hist.length,days));
    const ens = await adaptiveEnsemble(sym, sliceHist);
    results[label] = ens.forecast;
  }
  return results;
}

// -----------------
// Analyse aller Assets ohne Freezes
// -----------------
async function analyzeAllAssets(batchSize=5){
  const results = {};
  for(let i=0;i<ASSETS.length;i+=batchSize){
    const batch = ASSETS.slice(i,i+batchSize);
    await Promise.all(batch.map(async a=>{
      const forecast = await multiHorizonForecast(a.symbol);
      results[a.symbol] = {name:a.name, forecast};
    }));
    console.log(`Batch ${i/batchSize + 1}/${Math.ceil(ASSETS.length/batchSize)} abgeschlossen`);
  }
  return results;
}

// -----------------
// Kontinuierliches Lernen
// -----------------
async function continuousLearning(){
  for(const a of ASSETS){
    const hist = await fetchHistoricalData(a.symbol,365);
    await trainOrUpdateLSTM(a.symbol, hist,7);
  }
  console.log("Kontinuierliches LSTM-Training abgeschlossen für alle Assets");
}

setInterval(continuousLearning, 24*60*60*1000);

// -----------------
// Export
// -----------------
export {ASSETS, analyzeAllAssets, multiHorizonForecast, adaptiveEnsemble, continuousLearning};
