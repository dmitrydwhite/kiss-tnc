# `kiss-tnc`

A pure JavaScript module that implements sending and receiving AX.25 KISS frames as a NodeJS stream.

## To install

```sh
npm install kiss-tnc
```

## Dependencies

`kiss-tnc` has no dependencies other than NodeJS Stream `Transform`.

## Usage

### Using `kiss-tnc` to send KISS buffers

The KISSSender presumes that it will be streamed data to send as NodeJS Buffers of the appropriate length for your communication setup.

```js
// Require the package
const { KISSSender } = require('kiss-tnc');

// Instantiate the sending stream with your hardware and communication options
const mySendStream = new KISSSender({
  portIndex: 12,
  fullDuplex: false,
  hardware: 'hardware configuration string',
  persistence: 16,
  slotTime: 100,
  txDelay: 100,
  txTail: 100,
});

// Create the stream to send the formatted KISS frames to
const SerialPort = require('serialport')
const port = new SerialPort('/dev/tty-usbserial1', { baudRate: 9600 });

// Connect the KISS framer to the serial destination
mySendStream.pipe(port);

// Once piped, our send stream will send our initialization information to
// the TNC:
// => <Buffer c0 c6 68 61 72 64 77 61 72 65 20 63 6f 6e 66 69 67 75 72 61 74 69 6f 6e 20 73 74 72 69 6e 67 c0>
// => c0 : Frame Start Character
// => c6 : c=12 (Port Index) | 6=6 (Set Hardware Command)
// => 68 - 67 : 'hardware configuration string' as Buffer
// => c0 : Frame End Character

// => <Buffer c0 c2 10 c0>
// => c0 : Frame Start Character
// => c2 : c=12 (Port Index) | 2=2 (Persistence Command)
// => 10 : 16 (Persistence Value)
// => c0 : Frame End Character

// => <Buffer c0 c3 0a c0>
// => c0 : Frame Start Character
// => c3 : c=12 (Port Index) | 3=3 (SlotTime Command)
// => 0a : 10, SlotTime value divided by 10ms
// => c0 : Frame End Character

// Each property other than portIndex passed to the KISSSender constructor
// e.g. persistence, slotTime, txDelay, etc, will generate a data frame
// sent to the TNC with the appropriate framing bytes, command byte, and
// values.

// Write data to the KISS stream
mySendStream.write(Buffer.from('Hello, world!'));

// What is sent on to the TNC:
// => <Buffer c0 c0 68 65 6c 6c 6f 2c 20 77 6f 72 6c 64 21 c0>
// => c0 : Frame Start Character
// => c0 : c=12 (Port Index) | 0=Data Follows
// => 68 : 'h'
// => 65 : 'e'
// => 6c : 'l'
// => 6c : 'l'
// => 6f : 'o'
// => 2c : ','
// => 20 : Space Character
// => 77 : 'w'
// => 6f : 'o'
// => 72 : 'r'
// => 6c : 'l'
// => 64 : 'd'
// => 21 : '!'
// => c0 : Frame End Character

// Write bytes to the TNC that need to be escaped
mySendStream.write(Buffer.from([192, 219]));

// => <Buffer c0 c0 db dc db dd c0>
// => c0 : Frame Start Character
// => c0 : c=12 (Port Index) | 0=Data Follows
// => db : 219 (Escape Character)
// => dc : 220 (Escaped 192)
// => db : 219 (Escape Character)
// => dd : 221 (Escaped 219)
// => c0 : Frame End Character
```

Now let's set up our stream for receiving incoming data from a TNC.

```js
// Require the package
const { KISSReceiver } = require('kiss-tnc');

// Instantiate the receiving stream
const myReceiveStream = new KISSReceiver();

// Create the stream from which we'll receive TNC data
const SerialPort = require('serialport')
const port = new SerialPort('/dev/tty-usbserial1', { baudRate: 9600 });

// Connect the streams
port.pipe(myReceiveStream);

// Set up a data listener for our receive stream
myReceiveStream.on('data', data => {
  console.log('*** Received a frame ***');
  console.log(data);
  console.log(data.toString());
});

// Now myReceiveStream can accept partial data, and will emit complete
// frames once the end byte is received from the source stream.
port.write(Buffer.from([192, 160]));
port.write(Buffer.from('hello'));
port.write(Buffer.from(' wor'));
port.write(Buffer.from('ld!'));
port.write(Buffer.from([192]));
// => *** Received a frame ***
// => <Buffer 68 65 6c 6c 6f 20 77 6f 72 6c 64 21>
// => hello world!
```
Now you can handle each frame as a unit. We can also receive the frames as an object as well:
```js
const myObjectReceiveStream = new KISSReceiver({ emitObject: true });

myObjectReceiveStream.on('data', dataObj => {
  const { portIndex, data } = dataObj;

  console.log('*** Received an object frame ***');
  console.log('port index', portIndex);
  console.log(data.toString());
});

port.write(Buffer.from([192, 160].concat('hello world!'.split('')).concat(192)));

// => *** Received an object frame ***
// => port index 8
// => hello world!
```
