// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title ShioraTEEVerifier
 * @author Shiora Health AI on Aethelred
 * @notice Stores TEE attestations on-chain, verifies attestation signatures,
 *         manages a model registry, and tracks AI inferences inside
 *         secure enclaves (Intel SGX, AWS Nitro, AMD SEV).
 */
contract ShioraTEEVerifier is Ownable, ReentrancyGuard, Pausable {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // ────────────────────────────────────────────────────────
    // Enums
    // ────────────────────────────────────────────────────────

    enum Platform {
        INTEL_SGX,
        AWS_NITRO,
        AMD_SEV
    }

    // ────────────────────────────────────────────────────────
    // Structs
    // ────────────────────────────────────────────────────────

    struct Attestation {
        bytes32 attestationHash;
        Platform platform;
        bytes32 enclaveId;
        address submitter;
        uint256 timestamp;
        bool verified;
        bytes signature;
    }

    struct Model {
        string name;
        string version;
        bytes32 modelHash;
        Platform platform;
        bool active;
        uint256 registeredAt;
        uint256 totalInferences;
        address registeredBy;
    }

    struct Inference {
        bytes32 modelId;
        bytes32 inputHash;
        bytes32 outputHash;
        bytes32 attestationHash;
        address submitter;
        uint256 timestamp;
        uint256 confidence; // basis points (0-10000 = 0.00%-100.00%)
    }

    // ────────────────────────────────────────────────────────
    // State
    // ────────────────────────────────────────────────────────

    /// @notice Attestations by hash
    mapping(bytes32 => Attestation) private _attestations;

    /// @notice All attestation hashes
    bytes32[] private _attestationHashes;

    /// @notice Models by ID
    mapping(bytes32 => Model) private _models;

    /// @notice All model IDs
    bytes32[] private _modelIds;

    /// @notice Inferences by ID
    mapping(bytes32 => Inference) private _inferences;

    /// @notice Inference IDs per model
    mapping(bytes32 => bytes32[]) private _modelInferences;

    /// @notice All inference IDs
    bytes32[] private _inferenceIds;

    /// @notice Authorized enclave operator addresses
    mapping(address => bool) public authorizedOperators;

    /// @notice Trusted attestation signer addresses (TEE key pairs)
    mapping(address => bool) public trustedSigners;

    /// @notice Counters
    uint256 public totalAttestations;
    uint256 public totalModels;
    uint256 public totalInferences;

    /// @notice Nonces
    uint256 private _attestationNonce;
    uint256 private _modelNonce;
    uint256 private _inferenceNonce;

    /// @notice Maximum confidence value (100.00%)
    uint256 public constant MAX_CONFIDENCE = 10000;

    // ────────────────────────────────────────────────────────
    // Events
    // ────────────────────────────────────────────────────────

    event AttestationSubmitted(
        bytes32 indexed attestationHash,
        Platform platform,
        bytes32 enclaveId,
        address indexed submitter
    );

    event AttestationVerified(
        bytes32 indexed attestationHash,
        address indexed verifier,
        uint256 verifiedAt
    );

    event ModelRegistered(
        bytes32 indexed modelId,
        string name,
        string version,
        Platform platform
    );

    event ModelDeactivated(
        bytes32 indexed modelId,
        uint256 deactivatedAt
    );

    event ModelActivated(
        bytes32 indexed modelId,
        uint256 activatedAt
    );

    event InferenceRecorded(
        bytes32 indexed inferenceId,
        bytes32 indexed modelId,
        bytes32 attestationHash,
        uint256 confidence
    );

    event OperatorUpdated(address indexed operator, bool authorized);
    event SignerUpdated(address indexed signer, bool trusted);

    // ────────────────────────────────────────────────────────
    // Errors
    // ────────────────────────────────────────────────────────

    error InvalidAttestationHash();
    error AttestationAlreadyExists();
    error AttestationNotFound();
    error AttestationAlreadyVerified();
    error InvalidSignature();
    error NotAuthorizedOperator();
    error InvalidModelName();
    error InvalidModelHash();
    error ModelNotFound();
    error ModelNotActive();
    error ModelAlreadyActive();
    error InvalidInputHash();
    error InvalidOutputHash();
    error InvalidConfidence();
    error InferenceNotFound();
    error NotTrustedSigner();

    // ────────────────────────────────────────────────────────
    // Modifiers
    // ────────────────────────────────────────────────────────

    modifier onlyOperator() {
        if (!authorizedOperators[msg.sender] && msg.sender != owner()) {
            revert NotAuthorizedOperator();
        }
        _;
    }

    // ────────────────────────────────────────────────────────
    // Constructor
    // ────────────────────────────────────────────────────────

    constructor() Ownable(msg.sender) {
        authorizedOperators[msg.sender] = true;
        trustedSigners[msg.sender] = true;
    }

    // ────────────────────────────────────────────────────────
    // Attestation Functions
    // ────────────────────────────────────────────────────────

    /**
     * @notice Submit a new TEE attestation to the chain.
     * @param attestationHash Unique hash of the attestation report
     * @param platform TEE platform (SGX, Nitro, SEV)
     * @param enclaveId Identifier of the enclave that produced the attestation
     * @param signature ECDSA signature over the attestation hash
     * @return The attestation hash (used as ID)
     */
    function submitAttestation(
        bytes32 attestationHash,
        Platform platform,
        bytes32 enclaveId,
        bytes calldata signature
    ) external nonReentrant whenNotPaused onlyOperator returns (bytes32) {
        if (attestationHash == bytes32(0)) revert InvalidAttestationHash();
        if (_attestations[attestationHash].submitter != address(0)) {
            revert AttestationAlreadyExists();
        }
        if (signature.length == 0) revert InvalidSignature();

        _attestations[attestationHash] = Attestation({
            attestationHash: attestationHash,
            platform: platform,
            enclaveId: enclaveId,
            submitter: msg.sender,
            timestamp: block.timestamp,
            verified: false,
            signature: signature
        });

        _attestationHashes.push(attestationHash);
        totalAttestations++;

        emit AttestationSubmitted(attestationHash, platform, enclaveId, msg.sender);

        return attestationHash;
    }

    /**
     * @notice Verify an attestation by checking the signature against trusted signers.
     * @param attestationHash The attestation to verify
     */
    function verifyAttestation(
        bytes32 attestationHash
    ) external nonReentrant onlyOperator {
        Attestation storage att = _attestations[attestationHash];
        if (att.submitter == address(0)) revert AttestationNotFound();
        if (att.verified) revert AttestationAlreadyVerified();

        // Recover signer from the signature
        bytes32 ethSignedHash = attestationHash.toEthSignedMessageHash();
        address recoveredSigner = ethSignedHash.recover(att.signature);

        // Verify the signer is trusted
        if (!trustedSigners[recoveredSigner] && recoveredSigner != att.submitter) {
            revert NotTrustedSigner();
        }

        att.verified = true;

        emit AttestationVerified(attestationHash, msg.sender, block.timestamp);
    }

    // ────────────────────────────────────────────────────────
    // Model Registry Functions
    // ────────────────────────────────────────────────────────

    /**
     * @notice Register a new AI model in the on-chain registry.
     * @param name Human-readable model name
     * @param version Model version string (e.g., "v2.1")
     * @param modelHash Hash of the model weights/binary
     * @param platform TEE platform the model runs on
     * @return modelId Unique identifier for the model
     */
    function registerModel(
        string calldata name,
        string calldata version,
        bytes32 modelHash,
        Platform platform
    ) external nonReentrant whenNotPaused onlyOperator returns (bytes32 modelId) {
        if (bytes(name).length == 0) revert InvalidModelName();
        if (modelHash == bytes32(0)) revert InvalidModelHash();

        _modelNonce++;
        modelId = keccak256(
            abi.encodePacked(name, version, modelHash, block.timestamp, _modelNonce)
        );

        _models[modelId] = Model({
            name: name,
            version: version,
            modelHash: modelHash,
            platform: platform,
            active: true,
            registeredAt: block.timestamp,
            totalInferences: 0,
            registeredBy: msg.sender
        });

        _modelIds.push(modelId);
        totalModels++;

        emit ModelRegistered(modelId, name, version, platform);
    }

    /**
     * @notice Deactivate a model. Deactivated models cannot process new inferences.
     * @param modelId The model to deactivate
     */
    function deactivateModel(
        bytes32 modelId
    ) external nonReentrant onlyOperator {
        Model storage model = _models[modelId];
        if (bytes(model.name).length == 0) revert ModelNotFound();
        if (!model.active) revert ModelNotActive();

        model.active = false;

        emit ModelDeactivated(modelId, block.timestamp);
    }

    /**
     * @notice Re-activate a previously deactivated model.
     * @param modelId The model to activate
     */
    function activateModel(
        bytes32 modelId
    ) external nonReentrant onlyOperator {
        Model storage model = _models[modelId];
        if (bytes(model.name).length == 0) revert ModelNotFound();
        if (model.active) revert ModelAlreadyActive();

        model.active = true;

        emit ModelActivated(modelId, block.timestamp);
    }

    // ────────────────────────────────────────────────────────
    // Inference Tracking Functions
    // ────────────────────────────────────────────────────────

    /**
     * @notice Record a completed AI inference with its attestation.
     * @param modelId The model that performed the inference
     * @param inputHash Hash of the input data
     * @param outputHash Hash of the inference output
     * @param attestationHash TEE attestation hash for this inference
     * @param confidence Confidence score in basis points (0-10000)
     * @return inferenceId Unique identifier for the inference record
     */
    function recordInference(
        bytes32 modelId,
        bytes32 inputHash,
        bytes32 outputHash,
        bytes32 attestationHash,
        uint256 confidence
    ) external nonReentrant whenNotPaused onlyOperator returns (bytes32 inferenceId) {
        Model storage model = _models[modelId];
        if (bytes(model.name).length == 0) revert ModelNotFound();
        if (!model.active) revert ModelNotActive();
        if (inputHash == bytes32(0)) revert InvalidInputHash();
        if (outputHash == bytes32(0)) revert InvalidOutputHash();
        if (confidence > MAX_CONFIDENCE) revert InvalidConfidence();

        // Attestation must exist (but does not need to be verified yet)
        if (attestationHash != bytes32(0)) {
            if (_attestations[attestationHash].submitter == address(0)) {
                revert AttestationNotFound();
            }
        }

        _inferenceNonce++;
        inferenceId = keccak256(
            abi.encodePacked(modelId, inputHash, outputHash, block.timestamp, _inferenceNonce)
        );

        _inferences[inferenceId] = Inference({
            modelId: modelId,
            inputHash: inputHash,
            outputHash: outputHash,
            attestationHash: attestationHash,
            submitter: msg.sender,
            timestamp: block.timestamp,
            confidence: confidence
        });

        _modelInferences[modelId].push(inferenceId);
        _inferenceIds.push(inferenceId);
        model.totalInferences++;
        totalInferences++;

        emit InferenceRecorded(inferenceId, modelId, attestationHash, confidence);
    }

    // ────────────────────────────────────────────────────────
    // View Functions
    // ────────────────────────────────────────────────────────

    /**
     * @notice Get attestation details by hash.
     */
    function getAttestation(
        bytes32 attestationHash
    ) external view returns (Attestation memory) {
        if (_attestations[attestationHash].submitter == address(0)) {
            revert AttestationNotFound();
        }
        return _attestations[attestationHash];
    }

    /**
     * @notice Check whether an attestation is submitted and verified.
     */
    function isAttestationValid(
        bytes32 attestationHash
    ) external view returns (bool) {
        Attestation storage att = _attestations[attestationHash];
        return att.submitter != address(0) && att.verified;
    }

    /**
     * @notice Check whether an attestation has been submitted (regardless of verification).
     */
    function attestationExists(
        bytes32 attestationHash
    ) external view returns (bool) {
        return _attestations[attestationHash].submitter != address(0);
    }

    /**
     * @notice Get model details by ID.
     */
    function getModel(
        bytes32 modelId
    ) external view returns (Model memory) {
        if (bytes(_models[modelId].name).length == 0) revert ModelNotFound();
        return _models[modelId];
    }

    /**
     * @notice Get all registered model IDs.
     */
    function getAllModelIds() external view returns (bytes32[] memory) {
        return _modelIds;
    }

    /**
     * @notice Get inference details by ID.
     */
    function getInference(
        bytes32 inferenceId
    ) external view returns (Inference memory) {
        if (_inferences[inferenceId].modelId == bytes32(0)) {
            revert InferenceNotFound();
        }
        return _inferences[inferenceId];
    }

    /**
     * @notice Get the total inference count for a model.
     */
    function getModelInferenceCount(
        bytes32 modelId
    ) external view returns (uint256) {
        if (bytes(_models[modelId].name).length == 0) revert ModelNotFound();
        return _models[modelId].totalInferences;
    }

    /**
     * @notice Get inference IDs for a specific model.
     */
    function getModelInferences(
        bytes32 modelId
    ) external view returns (bytes32[] memory) {
        return _modelInferences[modelId];
    }

    /**
     * @notice Get all attestation hashes.
     */
    function getAllAttestationHashes() external view returns (bytes32[] memory) {
        return _attestationHashes;
    }

    /**
     * @notice Get attestation count.
     */
    function getAttestationCount() external view returns (uint256) {
        return _attestationHashes.length;
    }

    // ────────────────────────────────────────────────────────
    // Admin Functions
    // ────────────────────────────────────────────────────────

    /**
     * @notice Add or remove an authorized enclave operator.
     */
    function setOperator(
        address operator,
        bool authorized
    ) external onlyOwner {
        authorizedOperators[operator] = authorized;
        emit OperatorUpdated(operator, authorized);
    }

    /**
     * @notice Add or remove a trusted attestation signer.
     */
    function setSigner(
        address signer,
        bool trusted
    ) external onlyOwner {
        trustedSigners[signer] = trusted;
        emit SignerUpdated(signer, trusted);
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
