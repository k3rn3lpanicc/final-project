// Encryption utilities for vote options using ECDH + AES-GCM
// This provides true asymmetric encryption where decryption doesn't require brute-forcing
import { buildBabyjub } from 'circomlibjs';

// Fixed public key for encrypting votes (in production, this should be fetched from backend/contract)
// This is a Baby Jubjub public key: PubKey = privKey * Base8
export const ELECTION_PUBLIC_KEY = {
	x: BigInt('9350324229486977864199186023804174729698250325103440161239826812858536464745'),
	y: BigInt('418265988263166406135396573719470131816775157186488453786003049284275271736'),
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
async function deriveAESKey(sharedSecretX: bigint): Promise<CryptoKey> {
	// Convert shared secret X coordinate to bytes
	const sharedBytes = new Uint8Array(32);
	const hexStr = sharedSecretX.toString(16).padStart(64, '0');
	for (let i = 0; i < 32; i++) {
		sharedBytes[i] = parseInt(hexStr.substr(i * 2, 2), 16);
	}

	// Hash the shared secret to derive AES key
	const keyMaterial = await crypto.subtle.digest('SHA-256', sharedBytes);
	
	// Import as AES-GCM key
	return await crypto.subtle.importKey(
		'raw',
		keyMaterial,
		{ name: 'AES-GCM', length: 256 },
		false,
		['encrypt', 'decrypt']
	);
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
	const nonceBytes = crypto.getRandomValues(new Uint8Array(8));
	const nonce = BigInt('0x' + Array.from(nonceBytes).map(b => b.toString(16).padStart(2, '0')).join(''));

	// Create plaintext message: "optionIndex|nonce"
	const plaintext = `${optionIndex}|${nonce}`;
	const plaintextBytes = new TextEncoder().encode(plaintext);

	// Generate ephemeral private key r (random scalar)
	const r = BigInt(
		'0x' +
			Array.from(crypto.getRandomValues(new Uint8Array(31)))
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
	const iv = crypto.getRandomValues(new Uint8Array(12));

	// Encrypt the plaintext
	const ciphertext = await crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv, tagLength: 128 },
		aesKey,
		plaintextBytes
	);

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
