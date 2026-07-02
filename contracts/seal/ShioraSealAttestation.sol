// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "./interfaces/ISeal.sol";

/**
 * @title ShioraSealAttestation — consensus-anchored clinical/consent attestation
 * @author Shiora Health AI on Aethelred
 * @notice The consensus-anchored assurance tier for Shiora's health-data
 *         attestations. Elsewhere in this repo, `ShioraConsentManager` stores an
 *         UNVERIFIED `bytes32 attestation` supplied by the caller, and
 *         `ShioraTEEVerifier` records SELF-SIGNED (ECDSA) enclave attestations —
 *         both bottom out in "trust this key/hash." This contract replaces that
 *         trust with a **Digital Seal** minted by the Aethelred validator quorum:
 *         an attestation is anchored only when the chain's own Proof-of-Useful-
 *         Work pipeline sealed the underlying computation (a clinical AI
 *         inference, or a consent-capture screening) under a CEAP confidentiality
 *         policy, verified in-EVM by the ISeal precompile (0x0900) — the SAME
 *         consensus logic that minted the seal.
 *
 *         Privacy: NO PHI is placed on-chain. An attestation binds a `subject`
 *         address and a `scope` hash (e.g. keccak256("clinical:cycle_prediction")
 *         or a consent-scope id) — the same on-chain surface the existing
 *         consent contracts already use — plus a pointer to the backing seal.
 *
 *         Flow:
 *           1. A PoUW job runs the confidential computation for a
 *              (subject, scope) with purpose `shiora:0x<subject>:0x<scope>` and a
 *              CEAP policy (backend FHE/TEE/MPC, jurisdiction, vendor-root); the
 *              validator quorum mints the Digital Seal binding purpose +
 *              attestation.
 *           2. Anyone (the subject, a Shiora relayer, a provider gateway) calls
 *              {attest} with the job id — the seal is self-authorizing because
 *              its purpose binds the exact (subject, scope), so anchoring is
 *              permissionless by design.
 *           3. Consumers call {isAttested} / {requireAttested}; the registry
 *              re-checks the seal's live ACTIVE status through ISeal, so a seal
 *              revoked on-chain (consent withdrawn, model decertified,
 *              jurisdiction change) invalidates the attestation instantly.
 *
 * @dev One (subject, scope), one attestation, forever ({AlreadyAttested}): a
 *      governance revocation cannot be undone through the permissionless path by
 *      a second bound seal. Deliberately NOT upgradeable — the attestation of
 *      record must not be admin-mutable. Ownable2Step governance surface.
 */
contract ShioraSealAttestation is Ownable2Step, Pausable, ReentrancyGuard {
    /// @dev The ISeal precompile (see aethelred repo precompiles/seal). Only
    ///      real on Aethelred (EVM chain id 7332 / production successor).
    ISeal internal constant SEAL = ISeal(0x0000000000000000000000000000000000000900);

    /// @notice A consensus-anchored attestation for (subject, scope).
    struct Attestation {
        string sealId; // the backing Digital Seal
        uint64 attestedAt; // block time of anchoring
        bool exists; // record present
        bool revoked; // locally revoked by subject or governance
    }

    // subject => scope => attestation
    mapping(address => mapping(bytes32 => Attestation)) private _attestations;
    // a seal admits exactly one attestation (replay protection)
    mapping(string => bool) public sealUsed;

    // CEAP policy every backing seal must satisfy (empty arrays = any).
    string[] private _allowedBackends;
    string private _minVerification;
    string[] private _allowedPlatforms;
    bool private _requireVendorRoot;
    string[] private _dataResidency;

    event AttestationAnchored(
        address indexed subject, bytes32 indexed scope, string sealId, string jobId
    );
    event AttestationRevoked(address indexed subject, bytes32 indexed scope, address indexed by);
    event CompliancePolicySet(
        string[] allowedBackends,
        string minVerification,
        string[] allowedPlatforms,
        bool requireVendorRoot,
        string[] dataResidency
    );

    error ZeroScope();
    error AlreadyAttested(address subject, bytes32 scope);
    error SealAlreadyUsed(string sealId);
    error SealNotActive(string sealId);
    error SealNotBoundToScope(string expectedPurpose);
    error PolicyNotSatisfied(string reason);
    error NoSuchAttestation();
    error NotSubjectOrOwner();

    constructor(address governance) Ownable(governance) {}

    // ── anchoring (consensus-anchored issuance) ──────────────────────────────

    /**
     * @notice Anchor the (subject, scope) attestation to the Digital Seal minted
     *         for `jobId`. Permissionless: the seal's purpose binds the exact
     *         (subject, scope), so no caller can mis-attribute an attestation to
     *         a subject/scope the quorum did not seal. Each seal admits one
     *         attestation; each (subject, scope) admits one record for its life.
     */
    function attest(address subject, bytes32 scope, string calldata jobId)
        external
        whenNotPaused
        nonReentrant
    {
        if (scope == bytes32(0)) revert ZeroScope();

        // One (subject, scope), one attestation, forever. Without this guard a
        // second bound seal could overwrite the record — including rewriting
        // `revoked` back to false, silently undoing a revocation through a
        // permissionless call. A re-run computation is a new scope/version.
        if (_attestations[subject][scope].exists) revert AlreadyAttested(subject, scope);

        // Resolve the seal for the PoUW job (reverts if the job is unsealed).
        string memory sealId = SEAL.getSealIdByJob(jobId);
        if (sealUsed[sealId]) revert SealAlreadyUsed(sealId);
        if (!SEAL.verifySeal(sealId)) revert SealNotActive(sealId);

        // The seal must have been minted FOR this subject AND scope: the PoUW
        // job purpose binds both, so an attestation cannot be replayed for a
        // different subject or re-scoped to a different computation.
        (, , , , , , string memory purpose, , ) = SEAL.getSeal(sealId);
        string memory expected =
            string.concat("shiora:", _toHexAddress(subject), ":", _toHexBytes32(scope));
        if (keccak256(bytes(purpose)) != keccak256(bytes(expected))) {
            revert SealNotBoundToScope(expected);
        }

        // CEAP policy — consensus-parity Satisfies via the precompile.
        (bool ok, string memory reason) = SEAL.requireConfidentiality(
            sealId,
            _allowedBackends,
            _minVerification,
            _allowedPlatforms,
            _requireVendorRoot,
            _dataResidency
        );
        if (!ok) revert PolicyNotSatisfied(reason);

        sealUsed[sealId] = true;
        _attestations[subject][scope] = Attestation({
            sealId: sealId,
            attestedAt: uint64(block.timestamp),
            exists: true,
            revoked: false
        });
        emit AttestationAnchored(subject, scope, sealId, jobId);
    }

    // ── verification (what consumers call) ───────────────────────────────────

    /**
     * @notice True iff the subject holds a live attestation for the scope:
     *         recorded, not locally revoked, AND its backing seal is still
     *         ACTIVE on-chain (revocation propagates from consensus instantly).
     */
    function isAttested(address subject, bytes32 scope) public view returns (bool) {
        Attestation storage a = _attestations[subject][scope];
        if (!a.exists || a.revoked) return false;
        return SEAL.verifySeal(a.sealId);
    }

    /// @notice Reverting variant for integrators that want a hard gate.
    function requireAttested(address subject, bytes32 scope) external view {
        if (!isAttested(subject, scope)) revert NoSuchAttestation();
    }

    /// @notice Full attestation record (sealId, attestedAt, flags).
    function getAttestation(address subject, bytes32 scope)
        external
        view
        returns (Attestation memory)
    {
        return _attestations[subject][scope];
    }

    // ── revocation (withdrawal of trust) ─────────────────────────────────────

    /**
     * @notice Revoke an attestation. Callable by the subject (self-revoke, e.g.
     *         consent withdrawal) or by governance. Revoking the underlying seal
     *         on-chain already invalidates it via the live ISeal check in
     *         {isAttested}; this is the local, record-scoped control.
     */
    function revoke(address subject, bytes32 scope) external {
        if (msg.sender != subject && msg.sender != owner()) revert NotSubjectOrOwner();
        Attestation storage a = _attestations[subject][scope];
        if (!a.exists) revert NoSuchAttestation();
        a.revoked = true;
        emit AttestationRevoked(subject, scope, msg.sender);
    }

    // ── governance ───────────────────────────────────────────────────────────

    /// @notice Set the CEAP policy every backing seal must satisfy.
    function setCompliancePolicy(
        string[] calldata allowedBackends,
        string calldata minVerification,
        string[] calldata allowedPlatforms,
        bool requireVendorRoot,
        string[] calldata dataResidency
    ) external onlyOwner {
        _allowedBackends = allowedBackends;
        _minVerification = minVerification;
        _allowedPlatforms = allowedPlatforms;
        _requireVendorRoot = requireVendorRoot;
        _dataResidency = dataResidency;
        emit CompliancePolicySet(
            allowedBackends, minVerification, allowedPlatforms, requireVendorRoot, dataResidency
        );
    }

    /// @notice Current CEAP policy (for transparency / UIs).
    function compliancePolicy()
        external
        view
        returns (string[] memory, string memory, string[] memory, bool, string[] memory)
    {
        return (_allowedBackends, _minVerification, _allowedPlatforms, _requireVendorRoot, _dataResidency);
    }

    /// @notice Pause anchoring (verification reads stay live).
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice The exact PoUW job purpose a seal must carry to anchor
     *         (subject, scope) — helper for operators and UIs.
     */
    function expectedPurpose(address subject, bytes32 scope)
        external
        pure
        returns (string memory)
    {
        return string.concat("shiora:", _toHexAddress(subject), ":", _toHexBytes32(scope));
    }

    // ── hex helpers (lowercase — purpose strings are canonical) ───────────────

    function _toHexAddress(address account) private pure returns (string memory) {
        return _toHex(abi.encodePacked(account), 20);
    }

    function _toHexBytes32(bytes32 value) private pure returns (string memory) {
        return _toHex(abi.encodePacked(value), 32);
    }

    function _toHex(bytes memory data, uint256 len) private pure returns (string memory) {
        bytes16 alphabet = "0123456789abcdef";
        bytes memory out = new bytes(2 + len * 2);
        out[0] = "0";
        out[1] = "x";
        for (uint256 i = 0; i < len; i++) {
            out[2 + i * 2] = alphabet[uint8(data[i]) >> 4];
            out[3 + i * 2] = alphabet[uint8(data[i]) & 0x0f];
        }
        return string(out);
    }
}
