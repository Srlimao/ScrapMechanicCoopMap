// LZ4 block decompressor & Lua bitstream reader for save cell data
export function decompressLZ4(src) {
    let dst = [], n = 0;
    while (n < src.length) {
        let token = src[n++];
        let literalLen = token >> 4;
        if (literalLen === 15) {
            let extra = 255;
            while (extra === 255) {
                if (n >= src.length) throw Error("Truncated LZ4 literal length");
                extra = src[n++];
                literalLen += extra;
            }
        }
        if (n + literalLen > src.length) throw Error("LZ4 literal exceeds source block");
        for (let i = 0; i < literalLen; i++) dst.push(src[n + i]);
        n += literalLen;
        if (n === src.length) break;
        if (n + 2 > src.length) throw Error("Truncated LZ4 match offset");
        let offset = src[n] | (src[n + 1] << 8);
        n += 2;
        if (offset === 0 || offset > dst.length) throw Error("Invalid LZ4 match offset " + offset);
        let matchLen = (token & 15) + 4;
        if ((token & 15) === 15) {
            let extra = 255;
            while (extra === 255) {
                if (n >= src.length) throw Error("Truncated LZ4 match length");
                extra = src[n++];
                matchLen += extra;
            }
        }
        for (let i = 0; i < matchLen; i++) dst.push(dst[dst.length - offset]);
    }
    return Uint8Array.from(dst);
}

export class BitStream {
    constructor(buf) {
        this.buffer = buf;
        this.bitOffset = 0;
    }
    get remainingBits() { return this.buffer.length * 8 - this.bitOffset; }
    readBit() {
        if (this.remainingBits < 1) throw Error("Unexpected end of Lua bitstream");
        let byteIdx = Math.floor(this.bitOffset / 8);
        let bitIdx = 7 - (this.bitOffset % 8);
        let bit = (this.buffer[byteIdx] >> bitIdx) & 1;
        this.bitOffset++;
        return bit;
    }
    readUnsigned(bits) {
        let val = 0;
        for (let i = 0; i < bits; i++) val = val * 2 + this.readBit();
        return val;
    }
    readSigned(bits) {
        let val = this.readUnsigned(bits);
        return val >= Math.pow(2, bits - 1) ? val - Math.pow(2, bits) : val;
    }
    readFloat32() {
        let bytes = this.readBytes(4);
        return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getFloat32(0, false);
    }
    alignToByte() {
        let rem = this.bitOffset % 8;
        if (rem !== 0) this.bitOffset += 8 - rem;
    }
    readBytes(count) {
        let arr = new Uint8Array(count);
        for (let i = 0; i < count; i++) arr[i] = this.readUnsigned(8);
        return arr;
    }
}
