import { Injectable } from '@nestjs/common';
import * as circomlibjs from 'circomlibjs';
import { poseidon1, poseidon3 } from 'poseidon-lite';
import * as crypto from 'crypto';

@Injectable()
export class CryptoService {
  private eddsa: any;
  private babyjub: any;
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  async init() {
    if (this.initialized) return;
    
    if (!this.initPromise) {
      this.initPromise = (async () => {
        this.eddsa = await circomlibjs.buildEddsa();
        this.babyjub = await circomlibjs.buildBabyjub();
        this.initialized = true;
      })();
    }
    
    await this.initPromise;
  }

  generateRandomBigInt(): bigint {
    const BN128_FIELD =
      21888242871839275222246405745257275088548364400416034343698204186575808495617n;
    let val: bigint;
    do {
      val = BigInt('0x' + crypto.randomBytes(32).toString('hex'));
    } while (val >= BN128_FIELD);
    return val;
  }

  async getPublicKey(privateKeyHex: string): Promise<{ x: string; y: string }> {
    await this.init();
    const privKey = Buffer.from(privateKeyHex, 'hex');
    const pubKey = this.eddsa.prv2pub(privKey);
    return {
      x: pubKey[0].toString(),
      y: pubKey[1].toString(),
    };
  }

  async signCredentials(
    privateKeyHex: string,
    voterId: bigint,
    secretX: bigint,
    secretXp: bigint,
  ): Promise<{
    R8x: string;
    R8y: string;
    S: string;
  }> {
    await this.init();
    const hashXp = poseidon1([secretXp]);
    const msgField = poseidon3([voterId, secretX, hashXp]);

    const msgBytes = this.toBytesLE32(msgField);
    const privKey = Buffer.from(privateKeyHex, 'hex');
    const signature = this.eddsa.signPedersen(privKey, msgBytes);

    return {
      R8x: signature.R8[0].toString(),
      R8y: signature.R8[1].toString(),
      S: signature.S.toString(),
    };
  }

  private toBytesLE32(n: bigint): Uint8Array {
    const x = BigInt(n);
    const out = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      out[i] = Number((x >> (8n * BigInt(i))) & 0xffn);
    }
    return out;
  }

  async verifySignature(
    publicKeyX: string,
    publicKeyY: string,
    R8x: string,
    R8y: string,
    S: string,
    voterId: bigint,
    secretX: bigint,
    secretXp: bigint,
  ): Promise<boolean> {
    await this.init();
    try {
      const hashXp = poseidon1([secretXp]);
      const msgField = poseidon3([voterId, secretX, hashXp]);
      const msgBytes = this.toBytesLE32(msgField);

      const pubKey = [BigInt(publicKeyX), BigInt(publicKeyY)];
      const signature = {
        R8: [BigInt(R8x), BigInt(R8y)],
        S: BigInt(S),
      };

      return this.eddsa.verifyPedersen(msgBytes, signature, pubKey);
    } catch (error) {
      console.error('Signature verification error:', error);
      return false;
    }
  }
}
