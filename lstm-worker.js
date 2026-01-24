// lstm-worker.js
importScripts("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.10.0/dist/tf.min.js");

self.onmessage = async function(e){
  const { prices, days } = e.data;
  const forecasts = [];
  const tableRows = [];

  for(let i=0;i<4;i++){
    self.postMessage({progress:i*25, progressText:`KI${i+1} berechnet Prognose…`});
    const forecast = await predictLSTM(prices, days + i*2);
    forecasts.push(forecast);

    const lastForecast = forecast[forecast.length-1];
    const lastPrice = prices[prices.length-1];
    const delta = ((lastForecast - lastPrice)/lastPrice*100).toFixed(2);

    let signal="Halten", cls="hold", action="Keine klare Richtung";
    if(delta > 5){ signal="Kaufen"; cls="buy"; action="Aufwärtstrend"; }
    if(delta < -5){ signal="Verkaufen"; cls="sell"; action="Abwärtstrend"; }

    tableRows.push({
      name:`KI${i+1}`,
      forecast:lastForecast,
      signal,
      cls,
      delta:delta+"%",
      action
    });
  }

  self.postMessage({progress:100, progressText:"Fertig"});
  self.postMessage({forecasts, tableData:{rows:tableRows,hist:prices}});
}

// ================= LSTM Prognose =================
async function predictLSTM(data, period){
  const min=Math.min(...data), max=Math.max(...data);
  const norm=data.map(v=>(v-min)/(max-min||1));

  const X=[], Y=[];
  for(let i=0;i<norm.length-period;i++){
    X.push(norm.slice(i,i+period).map(v=>[v]));
    Y.push([norm[i+period]]);
  }
  if(X.length===0) return Array(period).fill(data[data.length-1]);

  const xs=tf.tensor3d(X);
  const ys=tf.tensor2d(Y);

  const model=tf.sequential();
  model.add(tf.layers.lstm({units:24,inputShape:[period,1]}));
  model.add(tf.layers.dense({units:1}));
  model.compile({optimizer:"adam",loss:"meanSquaredError"});

  await model.fit(xs,ys,{epochs:10,verbose:0});

  let lastSeq=X[X.length-1].slice();
  const preds=[];
  for(let i=0;i<period;i++){
    const next=model.predict(tf.tensor3d([lastSeq])).dataSync()[0]*(max-min)+min;
    preds.push(next);
    lastSeq=lastSeq.slice(1);
    lastSeq.push([(next-min)/(max-min||1)]);
  }

  xs.dispose(); ys.dispose(); model.dispose();
  return preds;
}
