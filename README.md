# precall-test

The pre-call test javascript module. Install with `npm install @jitsi/precall-test`.


# Example Usage

```
import precallTest from '@jitsi/precall-test';
import { useEffect } from 'react';

function App() {
  useEffect(() => {
    const handlePrecallTestResults = (results, err) => {
      console.log('Got results', results, err);
      if (results) {
        document.getElementById('throughput').innerHTML = results.throughput;
        document.getElementById('loss').innerHTML = results.fractionalLoss*100;
        document.getElementById('rtt').innerHTML = results.rtt;
        document.getElementById('jitter').innerHTML = results.jitter;
      }

    } 

    const configuration = [{"urls":"<turn server>","username":"<user>","credential":"<password>" }];
    const precalltest = new precallTest();
    precalltest.start(configuration, handlePrecallTestResults);
  }, []);

  return (
    <div className="App"> 
        <div className="oneline">Throughput (kbps):</div>
        <div className="oneline" id="throughput"></div>
        <div className="oneline">Loss (%): </div>
        <div className="oneline" id="loss"></div>
        <div className="oneline">RTT (ms): </div>
        <div className="oneline" id="rtt"></div>
        <div className="oneline">Jitter (ms): </div>
        <div className="oneline" id="jitter"></div>
      <p id="failures"></p>
    </div>
  );
}
```
