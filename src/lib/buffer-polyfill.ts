// Polyfill Buffer + global for browser — bitcoinjs-lib / bip32 / bs58check need them.
import { Buffer } from "buffer";

const g = globalThis as unknown as { Buffer?: unknown; global?: unknown; process?: unknown };
if (!g.Buffer) g.Buffer = Buffer;
if (!g.global) g.global = globalThis;
if (!g.process) g.process = { env: {} };

export {};
