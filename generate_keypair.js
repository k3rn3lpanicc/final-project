// Generate a new ElGamal key pair for election encryption
const { buildBabyjub } = require('circomlibjs');
const crypto = require('crypto');

async function generateKeyPair() {
	const bjj = await buildBabyjub();
	
	// Generate random private key (must be less than curve order)
	const privateKey = BigInt(
		'0x' + crypto.randomBytes(31).toString('hex')
	) % bjj.subOrder;
	
	// Calculate public key: pubKey = privKey * Base8
	const publicKeyPoint = bjj.mulPointEscalar(bjj.Base8, privateKey);
	
	const publicKey = {
		x: bjj.F.toObject(publicKeyPoint[0]),
		y: bjj.F.toObject(publicKeyPoint[1])
	};
	
	console.log('Generated Election Key Pair');
	console.log('============================\n');
	console.log('Private Key (keep secret until election ends):');
	console.log(`  ${privateKey.toString()}\n`);
	console.log('Public Key (share with voters):');
	console.log(`  x: ${publicKey.x.toString()}`);
	console.log(`  y: ${publicKey.y.toString()}\n`);
	console.log('For TypeScript/JavaScript code:');
	console.log('--------------------------------');
	console.log(`const ELECTION_PRIVATE_KEY = BigInt('${privateKey.toString()}');\n`);
	console.log('export const ELECTION_PUBLIC_KEY = {');
	console.log(`\tx: BigInt('${publicKey.x.toString()}'),`);
	console.log(`\ty: BigInt('${publicKey.y.toString()}'),`);
	console.log('};\n');
	
	// Verify the key pair
	console.log('Verifying key pair...');
	const verifyPoint = bjj.mulPointEscalar(bjj.Base8, privateKey);
	const matches = bjj.F.eq(verifyPoint[0], publicKeyPoint[0]) && 
	                bjj.F.eq(verifyPoint[1], publicKeyPoint[1]);
	console.log('Verification:', matches ? '✓ VALID' : '✗ INVALID\n');
	
	return { privateKey, publicKey };
}

generateKeyPair().catch(console.error);
