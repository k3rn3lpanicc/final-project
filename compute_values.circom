pragma circom 2.0.0;

include "circomlib/circuits/poseidon.circom";

template ComputeValues() {
    signal input ID;
    signal input X;
    signal input Xp;
    signal input electionId;
    
    signal output hashXp;
    signal output msgField;
    signal output nullifier;
    
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
    
    // Compute nullifier
    component Hnh = Poseidon(3);
    Hnh.inputs[0] <== X;
    Hnh.inputs[1] <== Xp;
    Hnh.inputs[2] <== electionId;
    nullifier <== Hnh.out;
}

component main = ComputeValues();
