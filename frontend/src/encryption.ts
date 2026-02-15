// Encryption utilities for vote options using ECDH + AES-GCM
// This provides true asymmetric encryption where decryption doesn't require brute-forcing
import { buildBabyjub } from 'circomlibjs';
import CryptoJS from 'crypto-js';
import { ENCRYPTION_PUBLIC_KEY } from './config/chains';

// Polyfill for getRandomValues
function getSecureRandomValues(array: Uint8Array): Uint8Array {
	if (window.crypto && window.crypto.getRandomValues) {
		return window.crypto.getRandomValues(array);
	}
	// Fallback using Math.random (less secure but works without HTTPS)
	for (let i = 0; i < array.length; i++) {
		array[i] = Math.floor(Math.random() * 256);
	}
	return array;
}

// Public key for encrypting votes (configured per chain/election)
export const ELECTION_PUBLIC_KEY = {
	x: BigInt(ENCRYPTION_PUBLIC_KEY.x),
	y: BigInt(ENCRYPTION_PUBLIC_KEY.y),
};

let babyJub: any = null;

async function getBabyJub() {
	if (!babyJub) {
		babyJub = await buildBabyjub();
	}
	return babyJub;
}

/**
 * Derives an AES key from a shared secret point using SHA-256
 */
async function deriveAESKey(sharedSecretX: bigint): Promise<CryptoKey | CryptoJS.lib.WordArray> {
	// Convert shared secret X coordinate to bytes
	const sharedBytes = new Uint8Array(32);
	const hexStr = sharedSecretX.toString(16).padStart(64, '0');
	for (let i = 0; i < 32; i++) {
		sharedBytes[i] = parseInt(hexStr.substr(i * 2, 2), 16);
	}

	// Try to use Web Crypto API if available (HTTPS/localhost)
	if (window.crypto && window.crypto.subtle) {
		try {
			const keyMaterial = await window.crypto.subtle.digest('SHA-256', sharedBytes);
			return await window.crypto.subtle.importKey(
				'raw',
				keyMaterial,
				{ name: 'AES-GCM', length: 256 },
				false,
				['encrypt', 'decrypt']
			);
		} catch (e) {
			console.warn('Web Crypto API failed, falling back to CryptoJS');
		}
	}
	
	// Fallback to CryptoJS for non-HTTPS
	const hexString = Array.from(sharedBytes).map(b => b.toString(16).padStart(2, '0')).join('');
	const wordArray = CryptoJS.enc.Hex.parse(hexString);
	return CryptoJS.SHA256(wordArray);
}

/**
 * Encrypts a vote option using ECDH + AES-GCM
 * 
 * Process:
 * 1. Generate ephemeral key pair (r, R = r*G)
 * 2. Compute shared secret: S = r * PubKey
 * 3. Derive AES key from S
 * 4. Encrypt message (optionIndex|nonce) with AES-GCM
 * 5. Output: R || IV || ciphertext || tag
 * 
 * Decryption (with private key):
 * 1. Parse R from encrypted data
 * 2. Compute shared secret: S = privKey * R (same as r * PubKey)
 * 3. Derive same AES key
 * 4. Decrypt ciphertext directly - NO BRUTE FORCING!
 *
 * @param optionIndex The index of the chosen option (0-based)
 * @param publicKey The election public key for encryption
 * @returns Encrypted vote data as hex string
 */
export async function encryptVoteOption(
	optionIndex: number,
	publicKey: { x: bigint; y: bigint } = ELECTION_PUBLIC_KEY
): Promise<{ encryptedData: string; nonce: bigint }> {
	const bjj = await getBabyJub();

	// Generate random nonce for this vote (8 bytes = 64 bits)
	const nonceBytes = getSecureRandomValues(new Uint8Array(8));
	const nonce = BigInt('0x' + Array.from(nonceBytes).map(b => b.toString(16).padStart(2, '0')).join(''));

	// Create plaintext message: "optionIndex|nonce"
	const plaintext = `${optionIndex}|${nonce}`;
	const plaintextBytes = new TextEncoder().encode(plaintext);

	// Generate ephemeral private key r (random scalar)
	const r = BigInt(
		'0x' +
			Array.from(getSecureRandomValues(new Uint8Array(31)))
				.map((b) => b.toString(16).padStart(2, '0'))
				.join('')
	) % bjj.subOrder;

	// Compute ephemeral public key: R = r * Base8
	const R = bjj.mulPointEscalar(bjj.Base8, r);

	// Compute shared secret: S = r * PubKey
	const pubKeyPoint = [bjj.F.e(publicKey.x), bjj.F.e(publicKey.y)];
	const S = bjj.mulPointEscalar(pubKeyPoint, r);
	const sharedSecretX = BigInt(bjj.F.toObject(S[0]));

	// Derive AES key from shared secret
	const aesKey = await deriveAESKey(sharedSecretX);

	// Generate random IV for AES-GCM
	const iv = getSecureRandomValues(new Uint8Array(12));

	let ciphertext: ArrayBuffer;
	
	// Try Web Crypto API first
	if (window.crypto && window.crypto.subtle && aesKey instanceof CryptoKey) {
		ciphertext = await window.crypto.subtle.encrypt(
			{ name: 'AES-GCM', iv: iv as Uint8Array, tagLength: 128 },
			aesKey,
			plaintextBytes
		);
	} else {
		// Fallback to CryptoJS
		const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');
		const plaintextHex = Array.from(plaintextBytes).map(b => b.toString(16).padStart(2, '0')).join('');
		
		const encrypted = CryptoJS.AES.encrypt(
			CryptoJS.enc.Hex.parse(plaintextHex),
			aesKey as CryptoJS.lib.WordArray,
			{
				iv: CryptoJS.enc.Hex.parse(ivHex),
				mode: CryptoJS.mode.CTR,
				padding: CryptoJS.pad.NoPadding
			}
		);
		
		// Convert to ArrayBuffer
		const ciphertextHex = encrypted.ciphertext.toString(CryptoJS.enc.Hex);
		const ciphertextArray = new Uint8Array(ciphertextHex.length / 2);
		for (let i = 0; i < ciphertextArray.length; i++) {
			ciphertextArray[i] = parseInt(ciphertextHex.substr(i * 2, 2), 16);
		}
		ciphertext = ciphertextArray.buffer;
	}

	// Format output: R_x (32) + R_y (32) + IV (12) + ciphertext+tag
	const rx = bjj.F.toObject(R[0]).toString(16).padStart(64, '0');
	const ry = bjj.F.toObject(R[1]).toString(16).padStart(64, '0');
	const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');
	const ciphertextHex = Array.from(new Uint8Array(ciphertext)).map(b => b.toString(16).padStart(2, '0')).join('');

	const encryptedData = '0x' + rx + ry + ivHex + ciphertextHex;

	console.log('Encrypted vote (ECDH + AES-GCM):', {
		optionIndex,
		nonce: nonce.toString(),
		plaintext,
		plaintextLength: plaintextBytes.length,
		R: [rx, ry],
		ivLength: iv.length,
		ciphertextLength: ciphertext.byteLength,
		totalEncryptedLength: encryptedData.length,
	});

	return {
		encryptedData,
		nonce,
	};
}

/**
 * Formats encrypted vote for smart contract submission
 * @param encryptedData The encrypted vote data
 * @returns Formatted bytes string
 */
export function formatEncryptedVote(encryptedData: string): string {
	return encryptedData;
}
