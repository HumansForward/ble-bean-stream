/**
 * Example requires a Bean sketch that prints to Serial.
 */

'use strict';

const Bean = require('ble-bean');
const beanStream = require('../lib/ble-bean-stream');
const Transform = require('stream').Transform;

const FILENAME = './serial.txt';
const fs = require('fs');

let connectedBean;
let triedToExit = false;

/**
 * Transform stream that formats serial data as strings.
 */
class SerialFormatter extends Transform {
  constructor() {
    super({objectMode: true});
  }

  _transform(chunk, encoding, callback) {
    // Only log serial.data; screen out other events
    if (chunk.serial) this.push(chunk.serial.data);

    callback();
  }
}

/**
 * Discover a Bean, then configure and pipe the stream.
 *
 * listenSerial stream objects:
 *  {"device":"<Id>","serial":{"data":"<String>"}}
 */
console.log('Looking for Bean...');

Bean.discover((bean) => {
  connectedBean = bean;

  // Start Bean streaming
  let beanReadable = beanStream.createReadStream(bean, {
    // Listen for data packets sent over the virtual serial
    listenSerial: true
  });

  console.log("Streaming serial data to '%s', press Ctrl-C to stop.", FILENAME);
  beanReadable.pipe(new SerialFormatter()).pipe(fs.createWriteStream(FILENAME));

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
