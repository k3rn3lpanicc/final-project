// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IVerifier {
    function verifyProof(
        uint[2] calldata _pA,
        uint[2][2] calldata _pB,
        uint[2] calldata _pC,
        uint[259] calldata _pubSignals
    ) external view returns (bool);
}

abstract contract Ownable {
    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner
    );
    address public owner;

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero owner");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}

contract ZKVoting is Ownable {
    struct Election {
        bool active;
        address verifier;
        bool issuerBound;
        uint256 issuerPublicKey;
        uint8 aIndex;
    }

    mapping(uint256 => Election) public elections;
    mapping(uint256 => mapping(uint256 => bool)) public nullifierUsed;

    event ElectionCreated(uint256 indexed electionId, address verifier);
    event ElectionUpdated(
        uint256 indexed electionId,
        address verifier,
        bool active
    );
    event IssuerBound(
        uint256 indexed electionId,
        uint256 issuerA,
        uint8 aIndex
    );
    event VoteSubmitted(
        uint256 indexed electionId,
        uint256 indexed nullifierHash,
        bytes encryptedVote,
        address indexed sender
    );

    // --- Admin functions ---

    function createElection(
        uint256 electionId,
        address verifier,
        bool active
    ) external onlyOwner {
        require(verifier != address(0), "Verifier=0");
        require(elections[electionId].verifier == address(0), "Exists");
        elections[electionId] = Election({
            active: active,
            verifier: verifier,
            issuerBound: false,
            issuerPublicKey: 0,
            aIndex: 0
        });
        emit ElectionCreated(electionId, verifier);
    }

    function updateElection(
        uint256 electionId,
        address verifier,
        bool active
    ) external onlyOwner {
        Election storage e = elections[electionId];
        require(e.verifier != address(0), "No election");
        if (verifier != address(0)) e.verifier = verifier;
        e.active = active;
        emit ElectionUpdated(electionId, e.verifier, e.active);
    }

    function bindIssuerA(
        uint256 electionId,
        uint256 issuerA,
        uint8 aIndex
    ) external onlyOwner {
        Election storage e = elections[electionId];
        require(e.verifier != address(0), "No election");
        e.issuerBound = true;
        e.issuerPublicKey = issuerA;
        e.aIndex = aIndex;
        emit IssuerBound(electionId, issuerA, aIndex);
    }

    function unbindIssuerA(uint256 electionId) external onlyOwner {
        Election storage e = elections[electionId];
        require(e.verifier != address(0), "No election");
        e.issuerBound = false;
    }

    // --- Voting ---

    function submitVote(
        uint[2] calldata _pA,
        uint[2][2] calldata _pB,
        uint[2] calldata _pC,
        uint[259] calldata _pubSignals,
        bytes calldata encryptedVote
    ) external {
        uint256 nullifierHash = _pubSignals[1];
        uint256 electionId = _pubSignals[2];

        Election storage e = elections[electionId];
        require(e.verifier != address(0), "Unknown election");
        require(e.active, "Election closed");

        if (e.issuerBound) {
            require(e.aIndex < 259, "aIndex OOB");
            require(
                _pubSignals[e.aIndex] == e.issuerPublicKey,
                "Issuer A mismatch"
            );
        }

        require(!nullifierUsed[electionId][nullifierHash], "Nullifier used");

        bool ok = IVerifier(e.verifier).verifyProof(_pA, _pB, _pC, _pubSignals);
        require(ok, "Invalid proof");

        nullifierUsed[electionId][nullifierHash] = true;

        // Emit only — off-chain indexers will reconstruct results
        emit VoteSubmitted(
            electionId,
            nullifierHash,
            encryptedVote,
            msg.sender
        );
    }

    function isNullifierUsed(
        uint256 electionId,
        uint256 nullifierHash
    ) external view returns (bool) {
        return nullifierUsed[electionId][nullifierHash];
    }
}
