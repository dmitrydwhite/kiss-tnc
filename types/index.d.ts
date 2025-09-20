/**
 * A Transform Stream that receives all or part of a KISS_TNC encoded Buffer, and emits complete
 * frames when received. Ignores multiple Frame End bytes received if there is no message between
 * them.
 */
export class KISSReceiver extends Transform {
    /**
     * A Transform Stream that receives all or part of a KISS_TNC encoded Buffer, and emits complete
     * frames when received. Ignores multiple Frame End bytes received if there is no message between
     * them.
     * @param {Object} opts Instantiation options
     * @param {Boolean} opts.emitCommandByte Precede each frame with its Command Byte if truthy, only the bare frame if falsy
     * @param {Boolean} opts.emitObject Will emit an object with properties `portIndex: number` and `data: Buffer`
     */
    constructor(opts?: {
        emitCommandByte: boolean;
        emitObject: boolean;
    });
    emitCommandByte: boolean;
    /**
     * Interprets the content of the message. Properly escaped bytes will be replaced; improper
     * escapes will drop both the Frame Escape byte and the next byte (i.e. if the next byte isn't one
     * of Transposed Frame Escape or Transposed Frame End). Returns either the bare content, or the
     * content with the leading Command Byte, depending on the class's instantiation option.
     * @param {Array} message The message in the form of an Array of Bytes
     */
    interpretMessage(message: any[]): Buffer<ArrayBuffer> | {
        portIndex: number;
        data: Buffer<ArrayBuffer>;
    };
    _transform(chunk: any, encoding: any, next: any): void;
    unterminatedMessage: any[];
    _flush(done: any): void;
}
/**
 * A Transform Stream to frame data to send to a TNC using KISS protocol.
 */
export class KISSSender extends Transform {
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
    constructor(opts?: Partial<{
        portIndex: number;
        fullDuplex: boolean;
        hardware: string | number[];
        persistence: number;
        slotTime: number;
        txDelay: number;
        txTail: number;
    }>);
    portIndex: number;
    dataStart: Buffer<ArrayBuffer>;
    dataEnd: Buffer<ArrayBuffer>;
    hardware: any;
    /**
     * @param {Buffer|string} chunk
     * @param {NodeJS.BufferEncoding} encoding
     * @param {() => void} next
     */
    _transform(chunk: Buffer | string, encoding: NodeJS.BufferEncoding, next: () => void): void;
    _flush(done: any): void;
}
import { Transform } from "stream";
