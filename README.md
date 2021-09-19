# `kiss-tnc`
This utility uses NodeJS Transform Streams to send and parse AX.25-KISS protocol data.

### To use
```sh
npm install kiss-tnc
```

### Implementation

#### Sending data with KISS
In this scenario, you are creating data that you wish to send using the KISS protocol, likely to a TNC.

```js
const { KISSSender } = require('kiss-tnc');

const optionsRequiredByDestination = {
  portIndex: 12, // portIndex is required, all other options properties are optional
  slotTime: 420,
  hardware: 'bloop',
};

const mySender = new KISSSender(options);
const myDataStream = CreateNewDataStreamSomehow();
const myDestination = GetMyDestinationStreamSomehow();

myDataStream.pipe(mySender).pipe(myDestination);
```

When `mySender` is piped to `myDestination`, it will send a series of initialization commands based on the options passed. In this case, it would send the following buffers separately to `myDestination`:
```js
<Buffer c0 c3 2a c0> // Slot time command sending 42 (420 / 10)
<Buffer c0 c6 62 6c 6f 6f 70 c0> // Hardware command sending 'bloop'
```

Once the pipe is set up as above, any data written to `myDataStream` will be piped through `mySender` which will wrap the packet in KISS start/end bytes and escape any characters that could cause KISS confusion. Once that is done, the framed data will be piped on to `myDestination` as a Buffer.
