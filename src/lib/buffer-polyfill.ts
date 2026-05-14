// Polyfill Buffer for browser — bitcoinjs-lib / bip32 still use it.
import { Buffer } from "buffer";
if (typeof globalThis !== "undefined" && !(globalThis as { Buffer?: unknown }).Buffer) {
  (globalThis as { Buffer: unknown }).Buffer = Buffer;
}
export {};
