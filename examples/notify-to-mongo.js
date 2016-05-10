/**
 * 1. Example requires mongo-writable-stream.
 *    https://github.com/RallySoftware/node-mongo-writable-stream
 *
 *    Install:
 *      npm install mongo-writable-stream
 *
 * 2. A collection named 'scratch_data' will be created in the
 *    localhost database 'ble_bean_stream'.
 */

'use strict';

const Bean = require('ble-bean');
const beanStream = require('../lib/ble-bean-stream');
const Transform = require('stream').Transform;

const DATABASE = 'mongodb://localhost/ble_bean_stream';
const COLLECTION = 'scratch_data';
const MongoWritableStream = require('mongo-writable-stream');

let connectedBean;
let triedToExit = false;

/**
 * Transform stream that excludes 'info' and 'error' events for insertion.
 */
class DocFilter extends Transform {
  constructor() {
    super({objectMode: true});
  }

  _transform(chunk, encoding, callback) {
    // Exclude 'info' and 'error' events
    if (chunk.info || chunk.error) {
      // No-op
    } else {
      this.push(chunk);
    }

    callback();
  }
}
/**
 * Discover a Bean, then configure and pipe the stream.
 *
 * notifyScratch stream objects:
 *  {"device":"<Id>","scratch<ScratchNum>":{"data":"<DataAsString>","int":<DataAsSignedInt>,"uint":<DataAsUnsignedInt>}}
 */
console.log('Looking for Bean...');

Bean.discover((bean) => {
  connectedBean = bean;

  // Start Bean streaming
  let beanReadable = beanStream.createReadStream(bean, {
    highWaterMark: 32, // Default is 16; can be bumped up for slow writers
    notifyScratch: '1,2,3', // List of scratches to subscribe to

    // Timestamp data as soon as it arrives; courtesy of HookedReadable
    beforePush: (data) => {
      data.capturedAt = new Date();
      return data;
    }
  });

  // Setup Mongo streaming
  let mongoWritable = new MongoWritableStream({
    url: DATABASE,
    collection: COLLECTION
  });

  console.log("Streaming scratch notifications to '%s', press Ctrl-C to stop.", COLLECTION);
  beanReadable.pipe(new DocFilter).pipe(mongoWritable);

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

