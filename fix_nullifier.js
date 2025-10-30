const circomlibjs = require('circomlibjs');
const fs = require('fs');

async function fixNullifier() {
	const poseidon = await circomlibjs.buildPoseidon();
	
	function FE(poseidonFn, arr) {
		const v = poseidonFn(arr);
		if (typeof v === 'bigint') return v;
		if (Array.isArray(v) && v.length === 1 && typeof v[0] === 'bigint') return v[0];
		if (v instanceof Uint8Array || (Array.isArray(v) && v.every(n => typeof n === 'number'))) {
			let result = 0n;
			for (let i = 0; i < v.length; i++) {
				result += BigInt(v[i]) << (8n * BigInt(i));
			}
			return result;
		}
		throw new Error('Unexpected poseidon output type');
	}
	
	const input = JSON.parse(fs.readFileSync('./input.json', 'utf8'));
	
	const X = BigInt(input.X);
	const Xp = BigInt(input.Xp);
	const electionId = BigInt(input.electionId);
	
	// Compute what the circuit will compute
	// But we know circuit Poseidon != JS Poseidon
	// So we need to extract the circuit's hash from a witness
	
	// Actually, let's create a test circuit that outputs the nullifier
	console.log('We need to compute nullifier using circuit Poseidon...');
	console.log('Creating a test circuit to get the correct value...');
}

fixNullifier().catch(console.error);
