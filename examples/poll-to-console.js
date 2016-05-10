'use strict';

const Bean = require('ble-bean');
const beanStream = require('../lib/ble-bean-stream');
const Transform = require('stream').Transform;

let connectedBean;
let triedToExit = false;

/**
 * Transform stream that formats data as JSON strings.
 */
class JsonFormatter extends Transform {
  constructor() {
    super({objectMode: true});
  }

  _transform(chunk, encoding, callback) {
    try {
      this.push(JSON.stringify(chunk) + '\r\n');
    } catch (e) {
      // No-op
    }

    callback();
  }
}

/**
 * Discover a Bean, then configure and pipe the stream.
 *
 * pollAccell, pollBatt, pollTemp and pollScratch stream objects:
 *  {"device":"<Id>","accell":{"x":<Float>,"y":<Float>,"z":<Float>}}
 *  {"device":"<Id>","batt":{"level":<Int>}}
 *  {"device":"<Id>","temp":{"celsius":<Int>}}
 *  {"device":"<Id>","scratch<ScratchNum>":{"data":"<DataAsString>","int":<DataAsSignedInt>,"uint":<DataAsUnsignedInt>}}
 */
console.log('Looking for Bean...');

Bean.discover((bean) => {
  connectedBean = bean;

  // Start Bean streaming
  let beanReadable = beanStream.createReadStream(bean, {
    poll: 5000, // Interval in millis
    pollAccell: true,
    pollBatt: true,
    pollTemp: true,
    pollScratch: '1,2', // List of scratches to poll

    // Timestamp data as soon as it arrives; courtesy of HookedReadable
    beforePush: (data) => {
      data.timestamp = new Date();
      return data;
    }
  });

  beanReadable.pipe(new JsonFormatter()).pipe(process.stdout);

  // Exit when the stream ends
  beanReadable.once('end', () => process.exit());
});

/**
 * Handle SIGINT (ex. Ctrl-C)
 */
function exitHandler() {
  if (connectedBean && !triedToExit) {
    triedToExit = true;

    console.log('Disconnecting...');
    connectedBean.disconnect();

  } else {
    process.exit();
  }
};
process.on('SIGINT', exitHandler);
