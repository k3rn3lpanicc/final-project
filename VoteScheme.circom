pragma circom 2.0.0;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/eddsa.circom";
include "circomlib/circuits/bitify.circom";

template VoteScheme() {
    // -------- Public inputs --------
    signal input nh;          // nullifier = Poseidon(X, Xp, electionId)
    signal input electionId;  // election context

    // Public key of issuer (as 256-bit array)
    signal input A[256];

    // -------- Private inputs --------
    signal input ID;
    signal input X;
    signal input Xp;

    // Signature (as 256-bit arrays)
    signal input R8[256];
    signal input S[256];

    // -------- Output --------
    signal output valid;

    // 1) Compute msg = Poseidon(ID, X, H(X'))
    component Hxp = Poseidon(1);
    Hxp.inputs[0] <== Xp;
    signal hashXp;
    hashXp <== Hxp.out;

    component Hmsg = Poseidon(3);
    Hmsg.inputs[0] <== ID;
    Hmsg.inputs[1] <== X;
    Hmsg.inputs[2] <== hashXp;
    signal msg;
    msg <== Hmsg.out;

    // 2) Convert msg field element to 32 bytes (256 bits) for EdDSA verification
    // This must match exactly what was signed: the 32-byte LE representation
    component msg2bits = Num2Bits(256);
    msg2bits.in <== msg;

    // 3) Signature verification with 256 bits (32 bytes)
    component eddsa = EdDSAVerifier(256);
    for (var i=0; i<256; i++) {
        eddsa.msg[i] <== msg2bits.out[i];
    }

    for (var i=0; i<256; i++) {
        eddsa.A[i] <== A[i];
        eddsa.R8[i] <== R8[i];
        eddsa.S[i] <== S[i];
    }

    // 4) Nullifier check
    component Hnh = Poseidon(3);
    Hnh.inputs[0] <== X;
    Hnh.inputs[1] <== Xp;
    Hnh.inputs[2] <== electionId;
    Hnh.out === nh;

    // If all constraints are satisfied, proof is valid.
    // We don't have eddsa.out, so just set valid = 1.
    valid <== 1;
    
}

component main {public [nh, electionId, A]} = VoteScheme();
