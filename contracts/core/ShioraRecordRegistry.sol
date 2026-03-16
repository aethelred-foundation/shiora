// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title ShioraRecordRegistry
 * @author Shiora Health AI on Aethelred
 * @notice Manages on-chain registration of encrypted health record metadata.
 *         Records are stored on IPFS; only the CID, content hash, encryption
 *         type, and TEE attestation are registered on-chain for integrity
 *         verification and immutable audit trails.
 */
contract ShioraRecordRegistry is Ownable, ReentrancyGuard, Pausable {

    // ────────────────────────────────────────────────────────
    // Enums
    // ────────────────────────────────────────────────────────

    enum EncryptionType {
        AES_256_GCM,
        AES_256_CBC
    }

    enum RecordStatus {
        PROCESSING,
        PINNING,
        PINNED,
        VERIFIED,
        DELETED
    }

    // ────────────────────────────────────────────────────────
    // Structs
    // ────────────────────────────────────────────────────────

    struct RecordMeta {
        address owner;
        string recordType;
        string ipfsCid;
        EncryptionType encryption;
        bytes32 contentHash;
        bytes32 attestationHash;
        uint256 createdAt;
        uint256 updatedAt;
        RecordStatus status;
        uint256 size;
    }

    // ────────────────────────────────────────────────────────
    // State
    // ────────────────────────────────────────────────────────

    /// @notice Record metadata by ID
    mapping(bytes32 => RecordMeta) private _records;

    /// @notice Record IDs per owner
    mapping(address => bytes32[]) private _ownerRecords;

    /// @notice CID to record ID mapping (prevent duplicate CIDs)
    mapping(string => bytes32) private _cidToRecord;

    /// @notice Total registered records
    uint256 public totalRecords;

    /// @notice Total storage size tracked (bytes)
    uint256 public totalStorageBytes;

    /// @notice Nonce for unique record ID generation
    uint256 private _nonce;

    /// @notice Authorized TEE verifier addresses
    mapping(address => bool) public authorizedVerifiers;

    // ────────────────────────────────────────────────────────
    // Events
    // ────────────────────────────────────────────────────────

    event RecordRegistered(
        bytes32 indexed recordId,
        address indexed owner,
        string recordType,
        string ipfsCid,
        bytes32 contentHash
    );

    event RecordStatusUpdated(
        bytes32 indexed recordId,
        RecordStatus oldStatus,
        RecordStatus newStatus
    );

    event RecordVerified(
        bytes32 indexed recordId,
        bytes32 attestationHash,
        uint256 verifiedAt
    );

    event RecordDeleted(
        bytes32 indexed recordId,
        address indexed owner,
        uint256 deletedAt
    );

    event VerifierUpdated(
        address indexed verifier,
        bool authorized
    );

    // ────────────────────────────────────────────────────────
    // Errors
    // ────────────────────────────────────────────────────────

    error RecordNotFound();
    error NotRecordOwner();
    error InvalidCID();
    error InvalidContentHash();
    error InvalidRecordType();
    error DuplicateCID();
    error RecordAlreadyDeleted();
    error InvalidStatusTransition();
    error NotAuthorizedVerifier();
    error RecordAlreadyVerified();
    error InvalidSize();

    // ────────────────────────────────────────────────────────
    // Modifiers
    // ────────────────────────────────────────────────────────

    modifier onlyRecordOwner(bytes32 recordId) {
        if (_records[recordId].owner == address(0)) revert RecordNotFound();
        if (_records[recordId].owner != msg.sender) revert NotRecordOwner();
        _;
    }

    modifier onlyVerifier() {
        if (!authorizedVerifiers[msg.sender] && msg.sender != owner()) {
            revert NotAuthorizedVerifier();
        }
        _;
    }

    // ────────────────────────────────────────────────────────
    // Constructor
    // ────────────────────────────────────────────────────────

    constructor() Ownable(msg.sender) {
        // Contract deployer is the first authorized verifier
        authorizedVerifiers[msg.sender] = true;
    }

    // ────────────────────────────────────────────────────────
    // External Functions
    // ────────────────────────────────────────────────────────

    /**
     * @notice Register a new encrypted health record on-chain.
     * @param recordType Type of record (e.g., "lab_result", "imaging")
     * @param ipfsCid IPFS CID where the encrypted record is stored
     * @param encryption Encryption algorithm used
     * @param contentHash SHA-256 hash of the encrypted content
     * @param size Size of the encrypted record in bytes
     * @return recordId Unique identifier for the registered record
     */
    function registerRecord(
        string calldata recordType,
        string calldata ipfsCid,
        EncryptionType encryption,
        bytes32 contentHash,
        uint256 size
    ) external nonReentrant whenNotPaused returns (bytes32 recordId) {
        if (bytes(recordType).length == 0) revert InvalidRecordType();
        if (bytes(ipfsCid).length == 0) revert InvalidCID();
        if (contentHash == bytes32(0)) revert InvalidContentHash();
        if (size == 0) revert InvalidSize();
        if (_cidToRecord[ipfsCid] != bytes32(0)) revert DuplicateCID();

        _nonce++;
        recordId = keccak256(
            abi.encodePacked(msg.sender, ipfsCid, block.timestamp, _nonce)
        );

        _records[recordId] = RecordMeta({
            owner: msg.sender,
            recordType: recordType,
            ipfsCid: ipfsCid,
            encryption: encryption,
            contentHash: contentHash,
            attestationHash: bytes32(0),
            createdAt: block.timestamp,
            updatedAt: block.timestamp,
            status: RecordStatus.PROCESSING,
            size: size
        });

        _ownerRecords[msg.sender].push(recordId);
        _cidToRecord[ipfsCid] = recordId;
        totalRecords++;
        totalStorageBytes += size;

        emit RecordRegistered(recordId, msg.sender, recordType, ipfsCid, contentHash);
    }

    /**
     * @notice Update the status of a record.
     *         Only the record owner or an authorized verifier can update status.
     * @param recordId The record to update
     * @param newStatus The new status
     */
    function updateRecordStatus(
        bytes32 recordId,
        RecordStatus newStatus
    ) external nonReentrant {
        RecordMeta storage record = _records[recordId];
        if (record.owner == address(0)) revert RecordNotFound();

        // Only owner or verifier can update status
        if (record.owner != msg.sender && !authorizedVerifiers[msg.sender]) {
            revert NotRecordOwner();
        }

        if (record.status == RecordStatus.DELETED) revert RecordAlreadyDeleted();

        // Validate status transitions
        if (!_isValidTransition(record.status, newStatus)) {
            revert InvalidStatusTransition();
        }

        RecordStatus oldStatus = record.status;
        record.status = newStatus;
        record.updatedAt = block.timestamp;

        emit RecordStatusUpdated(recordId, oldStatus, newStatus);
    }

    /**
     * @notice Verify a record with a TEE attestation hash.
     *         Only authorized verifiers can verify records.
     * @param recordId The record to verify
     * @param attestationHash The TEE attestation hash
     */
    function verifyRecord(
        bytes32 recordId,
        bytes32 attestationHash
    ) external nonReentrant onlyVerifier {
        RecordMeta storage record = _records[recordId];
        if (record.owner == address(0)) revert RecordNotFound();
        if (record.status == RecordStatus.DELETED) revert RecordAlreadyDeleted();
        if (record.status == RecordStatus.VERIFIED) revert RecordAlreadyVerified();
        if (attestationHash == bytes32(0)) revert InvalidContentHash();

        record.attestationHash = attestationHash;
        record.status = RecordStatus.VERIFIED;
        record.updatedAt = block.timestamp;

        emit RecordVerified(recordId, attestationHash, block.timestamp);
    }

    /**
     * @notice Soft-delete a record. Only the owner can delete.
     * @param recordId The record to delete
     */
    function deleteRecord(
        bytes32 recordId
    ) external nonReentrant onlyRecordOwner(recordId) {
        RecordMeta storage record = _records[recordId];
        if (record.status == RecordStatus.DELETED) revert RecordAlreadyDeleted();

        record.status = RecordStatus.DELETED;
        record.updatedAt = block.timestamp;

        if (totalStorageBytes >= record.size) {
            totalStorageBytes -= record.size;
        }

        emit RecordDeleted(recordId, msg.sender, block.timestamp);
    }

    // ────────────────────────────────────────────────────────
    // View Functions
    // ────────────────────────────────────────────────────────

    /**
     * @notice Get the full metadata of a health record.
     */
    function getRecord(
        bytes32 recordId
    ) external view returns (RecordMeta memory) {
        if (_records[recordId].owner == address(0)) revert RecordNotFound();
        return _records[recordId];
    }

    /**
     * @notice Get all record IDs for an owner.
     */
    function getOwnerRecords(
        address owner
    ) external view returns (bytes32[] memory) {
        return _ownerRecords[owner];
    }

    /**
     * @notice Get the number of records for an owner.
     */
    function getRecordCount(
        address owner
    ) external view returns (uint256) {
        return _ownerRecords[owner].length;
    }

    /**
     * @notice Look up a record ID by its IPFS CID.
     */
    function getRecordByCid(
        string calldata ipfsCid
    ) external view returns (bytes32) {
        return _cidToRecord[ipfsCid];
    }

    /**
     * @notice Check if a record exists and is not deleted.
     */
    function recordExists(bytes32 recordId) external view returns (bool) {
        RecordMeta storage record = _records[recordId];
        return record.owner != address(0) && record.status != RecordStatus.DELETED;
    }

    // ────────────────────────────────────────────────────────
    // Admin Functions
    // ────────────────────────────────────────────────────────

    /**
     * @notice Add or remove an authorized TEE verifier address.
     */
    function setVerifier(
        address verifier,
        bool authorized
    ) external onlyOwner {
        authorizedVerifiers[verifier] = authorized;
        emit VerifierUpdated(verifier, authorized);
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

    // ────────────────────────────────────────────────────────
    // Internal Functions
    // ────────────────────────────────────────────────────────

    /**
     * @dev Validate that a status transition is allowed.
     *      PROCESSING -> PINNING -> PINNED -> VERIFIED
     *      Any non-DELETED -> DELETED
     */
    function _isValidTransition(
        RecordStatus current,
        RecordStatus next
    ) internal pure returns (bool) {
        // Cannot transition from DELETED
        if (current == RecordStatus.DELETED) return false;

        // DELETED is always valid as a target (handled by deleteRecord)
        if (next == RecordStatus.DELETED) return true;

        // Forward transitions
        if (current == RecordStatus.PROCESSING && next == RecordStatus.PINNING) return true;
        if (current == RecordStatus.PINNING && next == RecordStatus.PINNED) return true;
        if (current == RecordStatus.PINNED && next == RecordStatus.VERIFIED) return true;

        // Also allow skipping steps for TEE-fast-tracked records
        if (current == RecordStatus.PROCESSING && next == RecordStatus.VERIFIED) return true;
        if (current == RecordStatus.PROCESSING && next == RecordStatus.PINNED) return true;
        if (current == RecordStatus.PINNING && next == RecordStatus.VERIFIED) return true;

        return false;
    }
}
