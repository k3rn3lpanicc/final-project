// Vote decryption script for election administrators
// This script decrypts votes after the election ends using the private key
// Uses ECDH + AES-GCM for true asymmetric encryption (no brute-forcing needed!)

import { buildBabyjub } from 'circomlibjs';
import crypto from 'crypto';

// The private key corresponding to ELECTION_PUBLIC_KEY
// In production, this is kept secret until election ends
const ELECTION_PRIVATE_KEY = BigInt(
	'250082668618633646334213584719494925374420844776732603861415520274085646643'
);

export const ELECTION_PUBLIC_KEY = {
	x: BigInt('9350324229486977864199186023804174729698250325103440161239826812858536464745'),
	y: BigInt('418265988263166406135396573719470131816775157186488453786003049284275271736'),
};

/**
 * Derives an AES key from a shared secret point using SHA-256
 */
function deriveAESKey(sharedSecretX) {
	// Convert shared secret X coordinate to bytes
	const sharedBytes = Buffer.alloc(32);
	const hexStr = sharedSecretX.toString(16).padStart(64, '0');
	for (let i = 0; i < 32; i++) {
		sharedBytes[i] = parseInt(hexStr.substr(i * 2, 2), 16);
	}

	// Hash the shared secret to derive AES key
	return crypto.createHash('sha256').update(sharedBytes).digest();
}

/**
 * Decrypts a vote encrypted with ECDH + AES-GCM
 *
 * Decryption process:
 * 1. Parse ephemeral public key R from encrypted data
 * 2. Compute shared secret: S = privKey * R (same as r * PubKey used in encryption)
 * 3. Derive AES key from shared secret
 * 4. Decrypt ciphertext directly using AES-GCM - NO BRUTE FORCING!
 *
 * @param encryptedData The encrypted vote data (hex string with 0x prefix)
 * @param privateKey The election private key
 * @returns Decrypted vote information { optionIndex, nonce }
 */
async function decryptVote(encryptedData, privateKey) {
	const bjj = await buildBabyjub();

	// Remove 0x prefix if present
	const hexData = encryptedData.startsWith('0x') ? encryptedData.slice(2) : encryptedData;

	console.log('Parsing encrypted vote:');
	console.log(`  Total length: ${hexData.length} hex chars (${hexData.length / 2} bytes)`);

	// Parse components: R_x (64) + R_y (64) + IV (24) + ciphertext+tag
	if (hexData.length < 152) {
		throw new Error(`Encrypted data too short: ${hexData.length} chars (need at least 152)`);
	}

	const rx = BigInt('0x' + hexData.slice(0, 64));
	const ry = BigInt('0x' + hexData.slice(64, 128));
	const ivHex = hexData.slice(128, 152);
	const ciphertextHex = hexData.slice(152);

	console.log('  Ephemeral public key R:', { x: rx.toString(), y: ry.toString() });
	console.log(`  IV length: ${ivHex.length / 2} bytes`);
	console.log(`  Ciphertext+Tag length: ${ciphertextHex.length / 2} bytes`);

	// Convert R to curve point
	const R = [bjj.F.e(rx), bjj.F.e(ry)];

	// Compute shared secret: S = privKey * R
	const S = bjj.mulPointEscalar(R, privateKey);
	const sharedSecretX = BigInt(bjj.F.toObject(S[0]));

	console.log('  Shared secret X:', sharedSecretX.toString());

	// Derive AES key from shared secret
	const aesKey = deriveAESKey(sharedSecretX);

	// Convert IV and ciphertext from hex to Buffer
	const iv = Buffer.from(ivHex, 'hex');
	const ciphertextWithTag = Buffer.from(ciphertextHex, 'hex');

	// Split ciphertext and auth tag (last 16 bytes)
	const authTag = ciphertextWithTag.slice(-16);
	const ciphertext = ciphertextWithTag.slice(0, -16);

	console.log(`  Ciphertext: ${ciphertext.length} bytes, Tag: ${authTag.length} bytes`);

	// Decrypt using AES-GCM
	const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey, iv);
	decipher.setAuthTag(authTag);

	let plaintext = decipher.update(ciphertext, null, 'utf8');
	plaintext += decipher.final('utf8');

	console.log(`  Decrypted plaintext: "${plaintext}"`);

	// Parse plaintext: "optionIndex|nonce"
	const parts = plaintext.split('|');
	if (parts.length !== 2) {
		throw new Error(`Invalid plaintext format: "${plaintext}" (expected "optionIndex|nonce")`);
	}

	const optionIndex = parseInt(parts[0], 10);
	const nonce = parts[1];

	if (isNaN(optionIndex)) {
		throw new Error(`Invalid optionIndex: "${parts[0]}"`);
	}

	console.log('\n✓ Decryption successful!');
	console.log(`  Option Index: ${optionIndex}`);
	console.log(`  Nonce: ${nonce}`);

	return {
		optionIndex,
		nonce,
		plaintext,
	};
}

/**
 * Verifies that a private key corresponds to the public key
 */
async function verifyKeyPair(privateKey, publicKey) {
	const bjj = await buildBabyjub();

	// Calculate pubKey = privKey * Base8
	const calculatedPubKey = bjj.mulPointEscalar(bjj.Base8, privateKey);

	const pubKeyPoint = [bjj.F.e(publicKey.x), bjj.F.e(publicKey.y)];

	const matches =
		bjj.F.eq(calculatedPubKey[0], pubKeyPoint[0]) &&
		bjj.F.eq(calculatedPubKey[1], pubKeyPoint[1]);

	console.log('Key pair verification:', matches ? '✓ VALID' : '✗ INVALID');
	console.log('  Private key:', privateKey.toString());
	console.log('  Expected public key:', {
		x: publicKey.x.toString(),
		y: publicKey.y.toString(),
	});
	console.log('  Calculated public key:', {
		x: bjj.F.toObject(calculatedPubKey[0]).toString(),
		y: bjj.F.toObject(calculatedPubKey[1]).toString(),
	});

	return matches;
}

// Main execution
async function main() {
	console.log('Vote Decryption Tool');
	console.log('====================\n');

	// Get encrypted vote from command line or use example
	const encryptedVote = process.argv[2];

	if (!encryptedVote) {
		console.log('Usage: node decrypt_votes.js <encryptedVote>');
		console.log('\nExample:');
		console.log('  node decrypt_votes.js 0x1234...');
		console.log('\nVerifying key pair...\n');

		// Verify the key pair
		await verifyKeyPair(ELECTION_PRIVATE_KEY, ELECTION_PUBLIC_KEY);
		return;
	}

	console.log('Encrypted vote:', encryptedVote);
	console.log('Length:', encryptedVote.length, 'characters\n');

	// Verify key pair first
	const validKeyPair = await verifyKeyPair(ELECTION_PRIVATE_KEY, ELECTION_PUBLIC_KEY);

	if (!validKeyPair) {
		console.error('\n❌ Invalid key pair! Cannot decrypt.');
		return;
	}

	console.log('\nDecrypting vote...\n');

	try {
		const result = await decryptVote(encryptedVote, ELECTION_PRIVATE_KEY);
		console.log('\n' + '='.repeat(50));
		console.log('DECRYPTION RESULT:');
		console.log('='.repeat(50));
		console.log(JSON.stringify(result, null, 2));
	} catch (error) {
		console.error('\n❌ Decryption failed:', error.message);
	}
}

// Run if called directly
main().catch(console.error);
