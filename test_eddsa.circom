pragma circom 2.0.0;

include "circomlib/circuits/eddsa.circom";
include "circomlib/circuits/bitify.circom";

template TestEdDSA() {
    signal input msg;  // Field element
    signal input A[256];
    signal input R8[256];
    signal input S[256];
    
    // Convert field element to 256 bits
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
}

component main {public [msg, A]} = TestEdDSA();
