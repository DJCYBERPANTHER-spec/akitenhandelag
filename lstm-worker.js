// lstm-worker.js
importScripts('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.10.0/dist/tf.min.js');

let model = null; // persistent für wiederholte Analysen

// Normalisierung
function normalize(data){
  const min = Math.min(...data), max = Math.max(...data);
  const norm = data.map(v=>(v-min)/(max-min||1));
  return {norm,min,max};
}

// LSTM trainieren und vorhersagen
async function trainLSTM(prices, period=20){
  const {norm,min,max} = normalize(prices);
  const X = [], Y = [];
  for(let i=0;i<norm.length-period;i++){
    X.push(norm.slice(i,i+period).map(v=>[v]));
    Y.push([norm[i+period]]);
  }
  if(X.length===0) return prices[prices.length-1];
  const xs = tf.tensor3d(X), ys = tf.tensor2d(Y);
  const m = tf.sequential();
  m.add(tf.layers.lstm({units:12,inputShape:[period,1]}));
  m.add(tf.layers.dense({units:1}));
  m.compile({optimizer:"adam",loss:"meanSquaredError"});
  await m.fit(xs,ys,{epochs:5,verbose:0});
  const p = m.predict(tf.tensor3d([X.at(-1)])).dataSync()[0];
  tf.dispose([xs,ys]);
  return p*(max-min)+min;
}

// Nachricht vom Hauptthread
onmessage = async e=>{
  const prices = e.data.prices;
  const days = e.data.days;
  const forecasts = [];
  const hist = prices.slice(-365); // für Chart
  for(let i=0;i<4;i++){
    postMessage({progressText:`KI ${i+1} wird berechnet...`});
    const forecast = [];
    let lastPrice = prices[prices.length-1];
    for(let d=0;d<days;d++){
      const p = await trainLSTM(prices, 20+i*2);
      lastPrice = p*(1+(Math.random()-0.5)/50); // leichte Variation
      forecast.push(lastPrice);
    }
    forecasts.push(forecast);
  }

  // Tabelle vorbereiten
  const tableData = {rows:[], hist, forecasts};
  forecasts.forEach((f,i)=>{
    const last = f[f.length-1];
    const prev = prices[prices.length-1];
    const delta = ((last-prev)/prev*100).toFixed(2);
    const signal = delta>0?"KAUFEN":delta<0?"VERKAUFEN":"HALTEN";
    const cls = signal==="KAUFEN"?"buy":signal==="VERKAUFEN"?"sell":"hold";
    const action = signal;
    tableData.rows.push({name:`KI${i+1}`,forecast:last,signal,cls,delta,action});
  });

  postMessage({tableData,forecasts});
};
