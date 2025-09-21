const { Transform } = require('stream');

const FEND = 192;
const FESC = 219;
const TFEND = 220;
const TFESC = 221;

const replacementMap = {
  [TFEND]: FEND,
  [TFESC]: FESC,
};

const ports = '0123456789ABCDEF';

/**
 * Creates a function that generates initialization messages for a KISS sender for the configuration values.
 * @param {number} portIndex The TNC port used for sending
 * @returns {(command: keyof commandBytes, value: number | Buffer) => Buffer}
 */
const getCommandBuilder = portIndex => {
  const pidx = ports[portIndex];
  const commandBytes = {
    fullDuplex: parseInt(`${pidx}5`, 16),
    hardware: parseInt(`${pidx}6`, 16),
    persistence: parseInt(`${pidx}2`, 16),
    slotTime: parseInt(`${pidx}3`, 16),
    txDelay: parseInt(`${pidx}1`, 16),
    txTail: parseInt(`${pidx}4`, 16),
  };

  return (command, value) => {
    const values = value instanceof Buffer ? Array.from(value) : [value];

    return Buffer.from([FEND, commandBytes[command], ...values, FEND]);
  };
};

/**
 * Converts an unescaped (raw) buffer to a buffer with special characters property escaped.
 * @param {String | Buffer} chunk
 * @returns {Buffer}
 */
const kissEscape = chunk => {
  const buf = Array.from(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  let i = 0;

  while (i < buf.length) {
    const current = buf[i];
    const foundEnd = (current === FEND) && TFEND;
    const foundEscape = (current === FESC) && TFESC;

    if (foundEnd || foundEscape) {
      buf.splice(i, 1, FESC, (foundEnd || foundEscape));
      i += 2
    } else {
      i += 1;
    }
  }

  return Buffer.from(buf);
};

/**
 * A Transform Stream that receives all or part of a KISS_TNC encoded Buffer, and emits complete
 * frames when received. Ignores multiple Frame End bytes received if there is no message between
 * them.
 */
class KISSReceiver extends Transform {
  /**
   * A Transform Stream that receives all or part of a KISS_TNC encoded Buffer, and emits complete
   * frames when received. Ignores multiple Frame End bytes received if there is no message between
   * them.
   * @param {Object} opts Instantiation options
   * @param {Boolean} opts.emitCommandByte Precede each frame with its Command Byte if truthy, only the bare frame if falsy
   * @param {Boolean} opts.emitObject Will emit an object with properties `portIndex: number` and `data: Buffer`
   */
  constructor(opts = {}) {
    const { emitCommandByte, emitObject } = opts;

    super({ readableObjectMode: !!emitObject });

    this.emitCommandByte = !!emitCommandByte;
  }

  /**
   * Interprets the content of the message. Properly escaped bytes will be replaced; improper
   * escapes will drop both the Frame Escape byte and the next byte (i.e. if the next byte isn't one
   * of Transposed Frame Escape or Transposed Frame End). Returns either the bare content, or the
   * content with the leading Command Byte, depending on the class's instantiation option.
   * @param {Array} message The message in the form of an Array of Bytes
   */
  interpretMessage(message) {
    const [commandByte, ...content] = message;
    let escapeIndex = content.indexOf(FESC);

    while (escapeIndex !== -1) {
      const spliceArgs = [escapeIndex, 2];
      const replacement = replacementMap[content[escapeIndex + 1]];

      if (replacement) {
        spliceArgs.push(replacement);
      }

      content.splice(...spliceArgs);

      escapeIndex = content.indexOf(FESC);
    }

    if (this.readableObjectMode) {
      return {
        portIndex: commandByte >> 4,
        data: Buffer.from(content),
      };
    }

    if (this.emitCommandByte) {
      return Buffer.from([commandByte, ...content]);
    }

    return Buffer.from(content);
  }

  _transform(chunk, encoding, next) {
    const messages = [];
    let received = Array.from(chunk);
    let fendIndex = received.indexOf(FEND);

    if (received[0] === FEND && this.unterminatedMessage) {
      // This is the case where we received the entirety of the message buffer, but did not receive
      // the terminating byte; therefore the terminating byte is the first thing we see. This signals
      // that we should push what we have onto the messages array.
      messages.push([...this.unterminatedMessage]);
      this.unterminatedMessage = null;
    }

    while (fendIndex !== -1) {
      const nextMessage = received.slice(0, fendIndex);

      received = received.slice(fendIndex + 1);

      if (nextMessage.length > 0) {
        if (this.unterminatedMessage) {
          messages.push([...this.unterminatedMessage, ...nextMessage]);
          this.unterminatedMessage = null;
        } else {
          messages.push(nextMessage);
        }
      }

      fendIndex = received.indexOf(FEND);
    }

    if (received.length > 0) {
      this.unterminatedMessage = received;
    }

    messages.forEach(message => {
      this.push(this.interpretMessage(message));
    });

    next();
  }

  _flush(done) {
    if (this.unterminatedMessage) {
      const portIndex = this.unterminatedMessage[0] >> 4;

      if (this.readableObjectMode) {
        this.push({ portIndex, data: Buffer.from(this.unterminatedMessage.slice(1)) });
      } else if (this.emitCommandByte) {
        this.push(Buffer.from(this.unterminatedMessage));
      } else {
        this.push(Buffer.from(this.unterminatedMessage.slice(1)));
      }
    }

    done();
  }
}

/**
 * A Transform Stream to frame data to send to a TNC using KISS protocol.
 */
class KISSSender extends Transform {
  /**
   * Creates a Transform Stream to frame data to send to a TNC using the KISS protocol.
   * @param {Object} opts The configuration options for the KISS connection to the TNC
   * @param {number} opts.portIndex The number 0-15 indicating the port index of the connected TNC
   * @param {Boolean} opts.fullDuplex If truthy, use full duplex; if falsy use half duplex
   * @param {String | Number[]} opts.hardware A variable-length string or array to transmit hardware-specific instructions
   * @param {Number} opts.persistence Number for persistence between 0 and 255 inclusive
   * @param {Number} opts.slotTime The slot interval in ms
   * @param {Number} opts.txDelay Transmitter keyup delay in ms
   * @param {Number} opts.txTail Time to hold up TX after the Frame has been sent
   */
  constructor(opts = {}) {
    super();
    const properties = ['fullDuplex', 'hardware', 'persistence', 'slotTime', 'txDelay', 'txTail'];
    const portIndex = opts.portIndex || 0;

    if (!Number.isInteger(portIndex)) {
      throw new Error('Cannot create a KISS sending Stream without a portIndex config property');
    }

    if (portIndex < 0 || portIndex > 15) {
      throw new Error('A KISS sending Stream requires a portIndex config property between 0 and 15 inclusive');
    }

    this.portIndex = portIndex;
    this.dataStart = Buffer.from([FEND, parseInt(`${ports[portIndex]}0`, 16)]);
    this.dataEnd = Buffer.from([FEND]);

    const outboundCommand = getCommandBuilder(portIndex);

    properties.forEach(property => {
      if (!Object.hasOwn(opts, property)) {
        return;
      }

      this[property] = opts[property];

      if (['slotTime', 'txDelay', 'txTail'].indexOf(property) !== -1) {
        this[property] = !!this[property] && this[property] / 10;
      }

      if (property === 'hardware') {
        this.hardware = !!this.hardware && Buffer.from(this.hardware);
      }

      if (this[property]) {
        this.push(outboundCommand(property, this[property]));
      }
    });
  }

  /**
   * @param {Buffer|string} chunk
   * @param {NodeJS.BufferEncoding} encoding
   * @param {() => void} next
   */
  _transform(chunk, encoding, next) {
    const escapedChunk = kissEscape(chunk);
    const frame = Buffer.concat([this.dataStart, escapedChunk, this.dataEnd]);

    this.push(frame);
    next();
  }

  _flush(done) {
    const exitKissFrame = Buffer.from([FEND, 255, FEND]);

    this.push(exitKissFrame);
    done();
  }
}

module.exports = { KISSReceiver, KISSSender };
