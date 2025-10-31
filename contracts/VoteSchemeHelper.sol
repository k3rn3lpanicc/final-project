// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

contract ProofHelper {
    uint256 constant r =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;
    // Base field size

    function verifyProof(
        uint[259] calldata _pubSignals
    ) public pure returns (bool) {
        assembly {
            function checkField(v) {
                if iszero(lt(v, r)) {
                    mstore(0, 0)
                    return(0, 0x20)
                }
            }
            // Validate that all evaluations ∈ F

            checkField(calldataload(add(_pubSignals, 0)))

            checkField(calldataload(add(_pubSignals, 32)))

            checkField(calldataload(add(_pubSignals, 64)))

            checkField(calldataload(add(_pubSignals, 96)))

            checkField(calldataload(add(_pubSignals, 128)))

            checkField(calldataload(add(_pubSignals, 160)))

            checkField(calldataload(add(_pubSignals, 192)))

            checkField(calldataload(add(_pubSignals, 224)))

            checkField(calldataload(add(_pubSignals, 256)))

            checkField(calldataload(add(_pubSignals, 288)))

            checkField(calldataload(add(_pubSignals, 320)))

            checkField(calldataload(add(_pubSignals, 352)))

            checkField(calldataload(add(_pubSignals, 384)))

            checkField(calldataload(add(_pubSignals, 416)))

            checkField(calldataload(add(_pubSignals, 448)))

            checkField(calldataload(add(_pubSignals, 480)))

            checkField(calldataload(add(_pubSignals, 512)))

            checkField(calldataload(add(_pubSignals, 544)))

            checkField(calldataload(add(_pubSignals, 576)))

            checkField(calldataload(add(_pubSignals, 608)))

            checkField(calldataload(add(_pubSignals, 640)))

            checkField(calldataload(add(_pubSignals, 672)))

            checkField(calldataload(add(_pubSignals, 704)))

            checkField(calldataload(add(_pubSignals, 736)))

            checkField(calldataload(add(_pubSignals, 768)))

            checkField(calldataload(add(_pubSignals, 800)))

            checkField(calldataload(add(_pubSignals, 832)))

            checkField(calldataload(add(_pubSignals, 864)))

            checkField(calldataload(add(_pubSignals, 896)))

            checkField(calldataload(add(_pubSignals, 928)))

            checkField(calldataload(add(_pubSignals, 960)))

            checkField(calldataload(add(_pubSignals, 992)))

            checkField(calldataload(add(_pubSignals, 1024)))

            checkField(calldataload(add(_pubSignals, 1056)))

            checkField(calldataload(add(_pubSignals, 1088)))

            checkField(calldataload(add(_pubSignals, 1120)))

            checkField(calldataload(add(_pubSignals, 1152)))

            checkField(calldataload(add(_pubSignals, 1184)))

            checkField(calldataload(add(_pubSignals, 1216)))

            checkField(calldataload(add(_pubSignals, 1248)))

            checkField(calldataload(add(_pubSignals, 1280)))

            checkField(calldataload(add(_pubSignals, 1312)))

            checkField(calldataload(add(_pubSignals, 1344)))

            checkField(calldataload(add(_pubSignals, 1376)))

            checkField(calldataload(add(_pubSignals, 1408)))

            checkField(calldataload(add(_pubSignals, 1440)))

            checkField(calldataload(add(_pubSignals, 1472)))

            checkField(calldataload(add(_pubSignals, 1504)))

            checkField(calldataload(add(_pubSignals, 1536)))

            checkField(calldataload(add(_pubSignals, 1568)))

            checkField(calldataload(add(_pubSignals, 1600)))

            checkField(calldataload(add(_pubSignals, 1632)))

            checkField(calldataload(add(_pubSignals, 1664)))

            checkField(calldataload(add(_pubSignals, 1696)))

            checkField(calldataload(add(_pubSignals, 1728)))

            checkField(calldataload(add(_pubSignals, 1760)))

            checkField(calldataload(add(_pubSignals, 1792)))

            checkField(calldataload(add(_pubSignals, 1824)))

            checkField(calldataload(add(_pubSignals, 1856)))

            checkField(calldataload(add(_pubSignals, 1888)))

            checkField(calldataload(add(_pubSignals, 1920)))

            checkField(calldataload(add(_pubSignals, 1952)))

            checkField(calldataload(add(_pubSignals, 1984)))

            checkField(calldataload(add(_pubSignals, 2016)))

            checkField(calldataload(add(_pubSignals, 2048)))

            checkField(calldataload(add(_pubSignals, 2080)))

            checkField(calldataload(add(_pubSignals, 2112)))

            checkField(calldataload(add(_pubSignals, 2144)))

            checkField(calldataload(add(_pubSignals, 2176)))

            checkField(calldataload(add(_pubSignals, 2208)))

            checkField(calldataload(add(_pubSignals, 2240)))

            checkField(calldataload(add(_pubSignals, 2272)))

            checkField(calldataload(add(_pubSignals, 2304)))

            checkField(calldataload(add(_pubSignals, 2336)))

            checkField(calldataload(add(_pubSignals, 2368)))

            checkField(calldataload(add(_pubSignals, 2400)))

            checkField(calldataload(add(_pubSignals, 2432)))

            checkField(calldataload(add(_pubSignals, 2464)))

            checkField(calldataload(add(_pubSignals, 2496)))

            checkField(calldataload(add(_pubSignals, 2528)))

            checkField(calldataload(add(_pubSignals, 2560)))

            checkField(calldataload(add(_pubSignals, 2592)))

            checkField(calldataload(add(_pubSignals, 2624)))

            checkField(calldataload(add(_pubSignals, 2656)))

            checkField(calldataload(add(_pubSignals, 2688)))

            checkField(calldataload(add(_pubSignals, 2720)))

            checkField(calldataload(add(_pubSignals, 2752)))

            checkField(calldataload(add(_pubSignals, 2784)))

            checkField(calldataload(add(_pubSignals, 2816)))

            checkField(calldataload(add(_pubSignals, 2848)))

            checkField(calldataload(add(_pubSignals, 2880)))

            checkField(calldataload(add(_pubSignals, 2912)))

            checkField(calldataload(add(_pubSignals, 2944)))

            checkField(calldataload(add(_pubSignals, 2976)))

            checkField(calldataload(add(_pubSignals, 3008)))

            checkField(calldataload(add(_pubSignals, 3040)))

            checkField(calldataload(add(_pubSignals, 3072)))

            checkField(calldataload(add(_pubSignals, 3104)))

            checkField(calldataload(add(_pubSignals, 3136)))

            checkField(calldataload(add(_pubSignals, 3168)))

            checkField(calldataload(add(_pubSignals, 3200)))

            checkField(calldataload(add(_pubSignals, 3232)))

            checkField(calldataload(add(_pubSignals, 3264)))

            checkField(calldataload(add(_pubSignals, 3296)))

            checkField(calldataload(add(_pubSignals, 3328)))

            checkField(calldataload(add(_pubSignals, 3360)))

            checkField(calldataload(add(_pubSignals, 3392)))

            checkField(calldataload(add(_pubSignals, 3424)))

            checkField(calldataload(add(_pubSignals, 3456)))

            checkField(calldataload(add(_pubSignals, 3488)))

            checkField(calldataload(add(_pubSignals, 3520)))

            checkField(calldataload(add(_pubSignals, 3552)))

            checkField(calldataload(add(_pubSignals, 3584)))

            checkField(calldataload(add(_pubSignals, 3616)))

            checkField(calldataload(add(_pubSignals, 3648)))

            checkField(calldataload(add(_pubSignals, 3680)))

            checkField(calldataload(add(_pubSignals, 3712)))

            checkField(calldataload(add(_pubSignals, 3744)))

            checkField(calldataload(add(_pubSignals, 3776)))

            checkField(calldataload(add(_pubSignals, 3808)))

            checkField(calldataload(add(_pubSignals, 3840)))

            checkField(calldataload(add(_pubSignals, 3872)))

            checkField(calldataload(add(_pubSignals, 3904)))

            checkField(calldataload(add(_pubSignals, 3936)))

            checkField(calldataload(add(_pubSignals, 3968)))

            checkField(calldataload(add(_pubSignals, 4000)))

            checkField(calldataload(add(_pubSignals, 4032)))

            checkField(calldataload(add(_pubSignals, 4064)))

            checkField(calldataload(add(_pubSignals, 4096)))

            checkField(calldataload(add(_pubSignals, 4128)))

            checkField(calldataload(add(_pubSignals, 4160)))

            checkField(calldataload(add(_pubSignals, 4192)))

            checkField(calldataload(add(_pubSignals, 4224)))

            checkField(calldataload(add(_pubSignals, 4256)))

            checkField(calldataload(add(_pubSignals, 4288)))

            checkField(calldataload(add(_pubSignals, 4320)))

            checkField(calldataload(add(_pubSignals, 4352)))

            checkField(calldataload(add(_pubSignals, 4384)))

            checkField(calldataload(add(_pubSignals, 4416)))

            checkField(calldataload(add(_pubSignals, 4448)))

            checkField(calldataload(add(_pubSignals, 4480)))

            checkField(calldataload(add(_pubSignals, 4512)))

            checkField(calldataload(add(_pubSignals, 4544)))

            checkField(calldataload(add(_pubSignals, 4576)))

            checkField(calldataload(add(_pubSignals, 4608)))

            checkField(calldataload(add(_pubSignals, 4640)))

            checkField(calldataload(add(_pubSignals, 4672)))

            checkField(calldataload(add(_pubSignals, 4704)))

            checkField(calldataload(add(_pubSignals, 4736)))

            checkField(calldataload(add(_pubSignals, 4768)))

            checkField(calldataload(add(_pubSignals, 4800)))

            checkField(calldataload(add(_pubSignals, 4832)))

            checkField(calldataload(add(_pubSignals, 4864)))

            checkField(calldataload(add(_pubSignals, 4896)))

            checkField(calldataload(add(_pubSignals, 4928)))

            checkField(calldataload(add(_pubSignals, 4960)))

            checkField(calldataload(add(_pubSignals, 4992)))

            checkField(calldataload(add(_pubSignals, 5024)))

            checkField(calldataload(add(_pubSignals, 5056)))

            checkField(calldataload(add(_pubSignals, 5088)))

            checkField(calldataload(add(_pubSignals, 5120)))

            checkField(calldataload(add(_pubSignals, 5152)))

            checkField(calldataload(add(_pubSignals, 5184)))

            checkField(calldataload(add(_pubSignals, 5216)))

            checkField(calldataload(add(_pubSignals, 5248)))

            checkField(calldataload(add(_pubSignals, 5280)))

            checkField(calldataload(add(_pubSignals, 5312)))

            checkField(calldataload(add(_pubSignals, 5344)))

            checkField(calldataload(add(_pubSignals, 5376)))

            checkField(calldataload(add(_pubSignals, 5408)))

            checkField(calldataload(add(_pubSignals, 5440)))

            checkField(calldataload(add(_pubSignals, 5472)))

            checkField(calldataload(add(_pubSignals, 5504)))

            checkField(calldataload(add(_pubSignals, 5536)))

            checkField(calldataload(add(_pubSignals, 5568)))

            checkField(calldataload(add(_pubSignals, 5600)))

            checkField(calldataload(add(_pubSignals, 5632)))

            checkField(calldataload(add(_pubSignals, 5664)))

            checkField(calldataload(add(_pubSignals, 5696)))

            checkField(calldataload(add(_pubSignals, 5728)))

            checkField(calldataload(add(_pubSignals, 5760)))

            checkField(calldataload(add(_pubSignals, 5792)))

            checkField(calldataload(add(_pubSignals, 5824)))

            checkField(calldataload(add(_pubSignals, 5856)))

            checkField(calldataload(add(_pubSignals, 5888)))

            checkField(calldataload(add(_pubSignals, 5920)))

            checkField(calldataload(add(_pubSignals, 5952)))

            checkField(calldataload(add(_pubSignals, 5984)))

            checkField(calldataload(add(_pubSignals, 6016)))

            checkField(calldataload(add(_pubSignals, 6048)))

            checkField(calldataload(add(_pubSignals, 6080)))

            checkField(calldataload(add(_pubSignals, 6112)))

            checkField(calldataload(add(_pubSignals, 6144)))

            checkField(calldataload(add(_pubSignals, 6176)))

            checkField(calldataload(add(_pubSignals, 6208)))

            checkField(calldataload(add(_pubSignals, 6240)))

            checkField(calldataload(add(_pubSignals, 6272)))

            checkField(calldataload(add(_pubSignals, 6304)))

            checkField(calldataload(add(_pubSignals, 6336)))

            checkField(calldataload(add(_pubSignals, 6368)))

            checkField(calldataload(add(_pubSignals, 6400)))

            checkField(calldataload(add(_pubSignals, 6432)))

            checkField(calldataload(add(_pubSignals, 6464)))

            checkField(calldataload(add(_pubSignals, 6496)))

            checkField(calldataload(add(_pubSignals, 6528)))

            checkField(calldataload(add(_pubSignals, 6560)))

            checkField(calldataload(add(_pubSignals, 6592)))

            checkField(calldataload(add(_pubSignals, 6624)))

            checkField(calldataload(add(_pubSignals, 6656)))

            checkField(calldataload(add(_pubSignals, 6688)))

            checkField(calldataload(add(_pubSignals, 6720)))

            checkField(calldataload(add(_pubSignals, 6752)))

            checkField(calldataload(add(_pubSignals, 6784)))

            checkField(calldataload(add(_pubSignals, 6816)))

            checkField(calldataload(add(_pubSignals, 6848)))

            checkField(calldataload(add(_pubSignals, 6880)))

            checkField(calldataload(add(_pubSignals, 6912)))

            checkField(calldataload(add(_pubSignals, 6944)))

            checkField(calldataload(add(_pubSignals, 6976)))

            checkField(calldataload(add(_pubSignals, 7008)))

            checkField(calldataload(add(_pubSignals, 7040)))

            checkField(calldataload(add(_pubSignals, 7072)))

            checkField(calldataload(add(_pubSignals, 7104)))

            checkField(calldataload(add(_pubSignals, 7136)))

            checkField(calldataload(add(_pubSignals, 7168)))

            checkField(calldataload(add(_pubSignals, 7200)))

            checkField(calldataload(add(_pubSignals, 7232)))

            checkField(calldataload(add(_pubSignals, 7264)))

            checkField(calldataload(add(_pubSignals, 7296)))

            checkField(calldataload(add(_pubSignals, 7328)))

            checkField(calldataload(add(_pubSignals, 7360)))

            checkField(calldataload(add(_pubSignals, 7392)))

            checkField(calldataload(add(_pubSignals, 7424)))

            checkField(calldataload(add(_pubSignals, 7456)))

            checkField(calldataload(add(_pubSignals, 7488)))

            checkField(calldataload(add(_pubSignals, 7520)))

            checkField(calldataload(add(_pubSignals, 7552)))

            checkField(calldataload(add(_pubSignals, 7584)))

            checkField(calldataload(add(_pubSignals, 7616)))

            checkField(calldataload(add(_pubSignals, 7648)))

            checkField(calldataload(add(_pubSignals, 7680)))

            checkField(calldataload(add(_pubSignals, 7712)))

            checkField(calldataload(add(_pubSignals, 7744)))

            checkField(calldataload(add(_pubSignals, 7776)))

            checkField(calldataload(add(_pubSignals, 7808)))

            checkField(calldataload(add(_pubSignals, 7840)))

            checkField(calldataload(add(_pubSignals, 7872)))

            checkField(calldataload(add(_pubSignals, 7904)))

            checkField(calldataload(add(_pubSignals, 7936)))

            checkField(calldataload(add(_pubSignals, 7968)))

            checkField(calldataload(add(_pubSignals, 8000)))

            checkField(calldataload(add(_pubSignals, 8032)))

            checkField(calldataload(add(_pubSignals, 8064)))

            checkField(calldataload(add(_pubSignals, 8096)))

            checkField(calldataload(add(_pubSignals, 8128)))

            checkField(calldataload(add(_pubSignals, 8160)))

            checkField(calldataload(add(_pubSignals, 8192)))

            checkField(calldataload(add(_pubSignals, 8224)))

            checkField(calldataload(add(_pubSignals, 8256)))

            mstore(0, 1)

            return(0, 0x20)
        }
    }
}
