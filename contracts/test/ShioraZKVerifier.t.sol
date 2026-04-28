// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { ShioraZKVerifier } from "../privacy/ShioraZKVerifier.sol";

interface Vm {
    function addr(uint256 privateKey) external returns (address);
    function prank(address sender) external;
    function expectRevert(bytes4 selector) external;
    function sign(uint256 privateKey, bytes32 digest) external returns (uint8 v, bytes32 r, bytes32 s);
    function warp(uint256 timestamp) external;
}

contract ShioraZKVerifierTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    ShioraZKVerifier private verifier;

    uint256 private constant VERIFIER_KEY = 0xA11CE;
    address private constant CLAIMANT = address(0x3001);
    address private constant ATTACKER = address(0x3002);

    function setUp() public {
        verifier = new ShioraZKVerifier();
        verifier.registerVerifier(vm.addr(VERIFIER_KEY));
    }

    function testRegisteredVerifierCanVerifyMatchingProofAndInputs() public {
        bytes memory publicInputs = abi.encode("age_range", "18-44", "jurisdiction:US");
        bytes32 proofHash = keccak256("valid-zk-proof");
        bytes32 claimId = _submitClaim(proofHash, keccak256(publicInputs));

        vm.prank(vm.addr(VERIFIER_KEY));
        verifier.verifyClaim(claimId, _signProof(proofHash), publicInputs);

        require(verifier.isClaimValid(claimId), "claim should be valid");

        ShioraZKVerifier.Claim memory claim = verifier.getClaim(claimId);
        require(claim.verified, "claim not marked verified");
        require(verifier.totalVerified() == 1, "verified counter");
    }

    function testUnregisteredCallerCannotVerifyEvenWithValidSignature() public {
        bytes memory publicInputs = abi.encode("provider_verified", "npi:123");
        bytes32 proofHash = keccak256("valid-zk-proof");
        bytes32 claimId = _submitClaim(proofHash, keccak256(publicInputs));

        vm.prank(ATTACKER);
        vm.expectRevert(ShioraZKVerifier.NotVerifier.selector);
        verifier.verifyClaim(claimId, _signProof(proofHash), publicInputs);
    }

    function testMismatchedPublicInputsAreRejected() public {
        bytes memory publicInputs = abi.encode("condition_present", "hypertension");
        bytes32 proofHash = keccak256("valid-zk-proof");
        bytes32 claimId = _submitClaim(proofHash, keccak256(publicInputs));

        vm.prank(vm.addr(VERIFIER_KEY));
        vm.expectRevert(ShioraZKVerifier.InvalidProof.selector);
        verifier.verifyClaim(claimId, _signProof(proofHash), abi.encode("condition_present", "diabetes"));
    }

    function testExpiredClaimCannotBeVerified() public {
        bytes memory publicInputs = abi.encode("medication_active", "metformin");
        bytes32 proofHash = keccak256("valid-zk-proof");
        bytes32 claimId = _submitClaim(proofHash, keccak256(publicInputs));

        vm.warp(block.timestamp + verifier.MIN_CLAIM_DURATION() + 1);

        vm.prank(vm.addr(VERIFIER_KEY));
        vm.expectRevert(ShioraZKVerifier.ClaimExpired_.selector);
        verifier.verifyClaim(claimId, _signProof(proofHash), publicInputs);
    }

    function _submitClaim(
        bytes32 proofHash,
        bytes32 publicInputsHash
    ) private returns (bytes32 claimId) {
        vm.prank(CLAIMANT);
        claimId = verifier.submitClaim(
            keccak256("age_range"),
            proofHash,
            publicInputsHash,
            block.timestamp + 1 hours
        );
    }

    function _signProof(bytes32 proofHash) private returns (bytes memory) {
        bytes32 digest = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", proofHash)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(VERIFIER_KEY, digest);
        return abi.encodePacked(r, s, v);
    }
}
