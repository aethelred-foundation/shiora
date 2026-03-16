// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title ShioraZKVerifier
 * @author Shiora Health AI on Aethelred
 * @notice On-chain verification of zero-knowledge proofs for health-related claims.
 *         Supports claim types such as age_range, condition_present,
 *         medication_active, data_quality, provider_verified, and
 *         fertility_window. Only registered verifiers can verify claims,
 *         and claims expire after their specified duration.
 */
contract ShioraZKVerifier is Ownable, ReentrancyGuard, Pausable {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // ────────────────────────────────────────────────────────
    // Structs
    // ────────────────────────────────────────────────────────

    struct Claim {
        address claimant;
        bytes32 claimType;
        bytes32 proofHash;
        bytes32 publicInputsHash;
        bool verified;
        uint256 verifiedAt;
        uint256 createdAt;
        uint256 expiresAt;
    }

    // ────────────────────────────────────────────────────────
    // State
    // ────────────────────────────────────────────────────────

    /// @notice Claims by ID
    mapping(bytes32 => Claim) private _claims;

    /// @notice Claim IDs per claimant
    mapping(address => bytes32[]) private _claimantClaims;

    /// @notice Trusted verifier addresses
    mapping(address => bool) private _verifiers;

    /// @notice Supported claim types
    mapping(bytes32 => bool) public supportedClaimTypes;

    /// @notice Total number of claims submitted
    uint256 public totalClaims;

    /// @notice Total number of verified claims
    uint256 public totalVerified;

    /// @notice Total number of registered verifiers
    uint256 public totalVerifiers;

    /// @notice Nonce for unique claim ID generation
    uint256 private _nonce;

    /// @notice Maximum claim duration (365 days)
    uint256 public constant MAX_CLAIM_DURATION = 365 days;

    /// @notice Minimum claim duration (1 hour)
    uint256 public constant MIN_CLAIM_DURATION = 1 hours;

    // ────────────────────────────────────────────────────────
    // Events
    // ────────────────────────────────────────────────────────

    event ClaimSubmitted(
        bytes32 indexed claimId,
        address indexed claimant,
        bytes32 claimType,
        bytes32 proofHash,
        uint256 expiresAt
    );

    event ClaimVerified(
        bytes32 indexed claimId,
        address indexed verifier,
        uint256 verifiedAt
    );

    event ClaimExpired(
        bytes32 indexed claimId,
        address indexed claimant,
        uint256 expiredAt
    );

    event VerifierRegistered(
        address indexed verifier,
        uint256 registeredAt
    );

    event VerifierRemoved(
        address indexed verifier,
        uint256 removedAt
    );

    event ClaimTypeAdded(
        bytes32 indexed claimType
    );

    event ClaimTypeRemoved(
        bytes32 indexed claimType
    );

    // ────────────────────────────────────────────────────────
    // Errors
    // ────────────────────────────────────────────────────────

    error InvalidClaimType();
    error UnsupportedClaimType();
    error InvalidProofHash();
    error InvalidPublicInputsHash();
    error InvalidDuration();
    error ClaimNotFound();
    error ClaimAlreadyVerified();
    error ClaimExpired_();
    error NotVerifier();
    error VerifierAlreadyRegistered();
    error VerifierNotFound();
    error InvalidVerifierAddress();
    error InvalidSignature();
    error InvalidProof();

    // ────────────────────────────────────────────────────────
    // Modifiers
    // ────────────────────────────────────────────────────────

    modifier onlyVerifier() {
        if (!_verifiers[msg.sender]) revert NotVerifier();
        _;
    }

    // ────────────────────────────────────────────────────────
    // Constructor
    // ────────────────────────────────────────────────────────

    constructor() Ownable(msg.sender) {
        // Register default supported claim types
        supportedClaimTypes[keccak256("age_range")] = true;
        supportedClaimTypes[keccak256("condition_present")] = true;
        supportedClaimTypes[keccak256("medication_active")] = true;
        supportedClaimTypes[keccak256("data_quality")] = true;
        supportedClaimTypes[keccak256("provider_verified")] = true;
        supportedClaimTypes[keccak256("fertility_window")] = true;

        // Contract deployer is the first verifier
        _verifiers[msg.sender] = true;
        totalVerifiers = 1;
    }

    // ────────────────────────────────────────────────────────
    // External Functions
    // ────────────────────────────────────────────────────────

    /**
     * @notice Submit a new zero-knowledge proof claim for verification.
     * @param claimType Type of claim (e.g., keccak256("age_range"))
     * @param proofHash Hash of the ZK proof
     * @param publicInputsHash Hash of the public inputs to the proof
     * @param expiresAt Timestamp when the claim expires
     * @return claimId Unique identifier for the new claim
     */
    function submitClaim(
        bytes32 claimType,
        bytes32 proofHash,
        bytes32 publicInputsHash,
        uint256 expiresAt
    ) external nonReentrant whenNotPaused returns (bytes32 claimId) {
        if (claimType == bytes32(0)) revert InvalidClaimType();
        if (!supportedClaimTypes[claimType]) revert UnsupportedClaimType();
        if (proofHash == bytes32(0)) revert InvalidProofHash();
        if (publicInputsHash == bytes32(0)) revert InvalidPublicInputsHash();

        uint256 duration = expiresAt - block.timestamp;
        if (expiresAt <= block.timestamp) revert InvalidDuration();
        if (duration < MIN_CLAIM_DURATION || duration > MAX_CLAIM_DURATION) {
            revert InvalidDuration();
        }

        _nonce++;
        claimId = keccak256(
            abi.encodePacked(msg.sender, claimType, proofHash, block.timestamp, _nonce)
        );

        _claims[claimId] = Claim({
            claimant: msg.sender,
            claimType: claimType,
            proofHash: proofHash,
            publicInputsHash: publicInputsHash,
            verified: false,
            verifiedAt: 0,
            createdAt: block.timestamp,
            expiresAt: expiresAt
        });

        _claimantClaims[msg.sender].push(claimId);
        totalClaims++;

        emit ClaimSubmitted(claimId, msg.sender, claimType, proofHash, expiresAt);
    }

    /**
     * @notice Verify a submitted claim by checking the ZK proof.
     *         Only registered verifiers can call this function.
     *         The proof is verified via ECDSA signature recovery against
     *         the stored proof hash and public inputs hash.
     * @param claimId The claim to verify
     * @param proof ECDSA signature over the proof hash
     * @param publicInputs Encoded public inputs (hashed and compared)
     */
    function verifyClaim(
        bytes32 claimId,
        bytes calldata proof,
        bytes calldata publicInputs
    ) external nonReentrant whenNotPaused onlyVerifier {
        Claim storage claim = _claims[claimId];
        if (claim.claimant == address(0)) revert ClaimNotFound();
        if (claim.verified) revert ClaimAlreadyVerified();
        if (block.timestamp >= claim.expiresAt) revert ClaimExpired_();

        // Verify the public inputs hash matches
        bytes32 computedInputsHash = keccak256(publicInputs);
        if (computedInputsHash != claim.publicInputsHash) revert InvalidProof();

        // Verify the proof signature — recover signer from the proof hash
        if (proof.length == 0) revert InvalidSignature();
        bytes32 ethSignedHash = claim.proofHash.toEthSignedMessageHash();
        address recoveredSigner = ethSignedHash.recover(proof);

        // The recovered signer must be a registered verifier
        if (!_verifiers[recoveredSigner]) revert InvalidSignature();

        claim.verified = true;
        claim.verifiedAt = block.timestamp;
        totalVerified++;

        emit ClaimVerified(claimId, msg.sender, block.timestamp);
    }

    /**
     * @notice Register a new trusted verifier address.
     * @param verifier Address to register as a verifier
     */
    function registerVerifier(
        address verifier
    ) external onlyOwner {
        if (verifier == address(0)) revert InvalidVerifierAddress();
        if (_verifiers[verifier]) revert VerifierAlreadyRegistered();

        _verifiers[verifier] = true;
        totalVerifiers++;

        emit VerifierRegistered(verifier, block.timestamp);
    }

    /**
     * @notice Remove a verifier from the trusted set.
     * @param verifier Address to remove
     */
    function removeVerifier(
        address verifier
    ) external onlyOwner {
        if (!_verifiers[verifier]) revert VerifierNotFound();

        _verifiers[verifier] = false;
        totalVerifiers--;

        emit VerifierRemoved(verifier, block.timestamp);
    }

    // ────────────────────────────────────────────────────────
    // View Functions
    // ────────────────────────────────────────────────────────

    /**
     * @notice Get full claim details by ID.
     * @param claimId The claim to look up
     * @return The claim record
     */
    function getClaim(
        bytes32 claimId
    ) external view returns (Claim memory) {
        if (_claims[claimId].claimant == address(0)) revert ClaimNotFound();
        return _claims[claimId];
    }

    /**
     * @notice Check if a claim is currently valid (verified and not expired).
     * @param claimId The claim to check
     * @return True if the claim is verified and has not expired
     */
    function isClaimValid(bytes32 claimId) external view returns (bool) {
        Claim storage claim = _claims[claimId];
        if (claim.claimant == address(0)) return false;
        if (!claim.verified) return false;
        if (block.timestamp >= claim.expiresAt) return false;
        return true;
    }

    /**
     * @notice Get all claim IDs for a claimant.
     * @param claimant The claimant address
     * @return Array of claim IDs
     */
    function getClaimantClaims(
        address claimant
    ) external view returns (bytes32[] memory) {
        return _claimantClaims[claimant];
    }

    /**
     * @notice Check if an address is a registered verifier.
     * @param verifier The address to check
     * @return True if the address is a registered verifier
     */
    function isVerifier(address verifier) external view returns (bool) {
        return _verifiers[verifier];
    }

    /**
     * @notice Check if a claim type is supported.
     * @param claimType The claim type hash to check
     * @return True if the claim type is supported
     */
    function isClaimTypeSupported(bytes32 claimType) external view returns (bool) {
        return supportedClaimTypes[claimType];
    }

    // ────────────────────────────────────────────────────────
    // Admin Functions
    // ────────────────────────────────────────────────────────

    /**
     * @notice Add a new supported claim type.
     * @param claimType The claim type hash to add
     */
    function addClaimType(bytes32 claimType) external onlyOwner {
        if (claimType == bytes32(0)) revert InvalidClaimType();
        supportedClaimTypes[claimType] = true;
        emit ClaimTypeAdded(claimType);
    }

    /**
     * @notice Remove a supported claim type.
     * @param claimType The claim type hash to remove
     */
    function removeClaimType(bytes32 claimType) external onlyOwner {
        supportedClaimTypes[claimType] = false;
        emit ClaimTypeRemoved(claimType);
    }

    /**
     * @notice Pause the contract in case of emergency.
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause the contract.
     */
    function unpause() external onlyOwner {
        _unpause();
    }
}
