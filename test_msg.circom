pragma circom 2.0.0;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/bitify.circom";

template TestMsg() {
    signal input ID;
    signal input X;
    signal input Xp;
    
    signal output hashXp;
    signal output msgField;
    
    // Compute hashXp
    component Hxp = Poseidon(1);
    Hxp.inputs[0] <== Xp;
    hashXp <== Hxp.out;
    
    // Compute msgField
    component Hmsg = Poseidon(3);
    Hmsg.inputs[0] <== ID;
    Hmsg.inputs[1] <== X;
    Hmsg.inputs[2] <== hashXp;
    msgField <== Hmsg.out;
}

component main = TestMsg();
