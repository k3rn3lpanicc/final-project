pragma circom 2.0.0;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/eddsa.circom";
include "circomlib/circuits/bitify.circom";

template VoteWithPoseidon() {
    signal input ID;
    signal input X;
    signal input Xp;
    signal input A[256];
    signal input R8[256];
    signal input S[256];
    
    signal output valid;
    signal output msgOut; // Output the computed message for debugging
    
    // Compute message using Poseidon
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
    msgOut <== msg;
    
    // Convert msg to bits
    component msg2bits = Num2Bits(256);
    msg2bits.in <== msg;
    
    // Verify signature
    component eddsa = EdDSAVerifier(256);
    for (var i=0; i<256; i++) {
        eddsa.msg[i] <== msg2bits.out[i];
        eddsa.A[i] <== A[i];
        eddsa.R8[i] <== R8[i];
        eddsa.S[i] <== S[i];
    }
    
    valid <== 1;
}

component main = VoteWithPoseidon();
