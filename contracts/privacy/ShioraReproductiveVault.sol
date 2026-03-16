// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title ShioraReproductiveVault
 * @author Shiora Health AI on Aethelred
 * @notice Manages encrypted data compartments with per-compartment access control
 *         and jurisdictional compliance flags. Designed for sensitive reproductive
 *         and women's health data that requires enhanced privacy protections,
 *         compartment-level locking, and jurisdiction-aware data governance.
 */
contract ShioraReproductiveVault is Ownable, ReentrancyGuard, Pausable {

    // ────────────────────────────────────────────────────────
    // Structs
    // ────────────────────────────────────────────────────────

    struct Compartment {
        address owner;
        bytes32 category;
        bytes32 encryptionKeyHash;
        uint256 recordCount;
        uint256 storageUsed;
        bool locked;
        uint256 createdAt;
        uint256 lastAccessed;
    }

    struct CompartmentAccess {
        address provider;
        uint256 grantedAt;
        uint256 expiresAt;
        bool active;
    }

    // ────────────────────────────────────────────────────────
    // State
    // ────────────────────────────────────────────────────────

    /// @notice Compartment data by ID
    mapping(bytes32 => Compartment) private _compartments;

    /// @notice Access grants per compartment per provider
    mapping(bytes32 => mapping(address => CompartmentAccess)) private _access;

    /// @notice Jurisdiction flags per compartment (bitfield for compliance)
    mapping(bytes32 => uint256) private _jurisdictionFlags;

    /// @notice Compartment IDs per owner
    mapping(address => bytes32[]) private _ownerCompartments;

    /// @notice Provider list per compartment (for enumeration)
    mapping(bytes32 => address[]) private _compartmentProviders;

    /// @notice Total number of compartments created
    uint256 public totalCompartments;

    /// @notice Nonce for unique compartment ID generation
    uint256 private _nonce;

    /// @notice Maximum compartments per user
    uint256 public constant MAX_COMPARTMENTS_PER_USER = 20;

    /// @notice Maximum access duration (365 days)
    uint256 public constant MAX_ACCESS_DURATION = 365 days;

    /// @notice Minimum access duration (1 hour)
    uint256 public constant MIN_ACCESS_DURATION = 1 hours;

    // ────────────────────────────────────────────────────────
    // Events
    // ────────────────────────────────────────────────────────

    event CompartmentCreated(
        bytes32 indexed compartmentId,
        address indexed owner,
        bytes32 category,
        uint256 createdAt
    );

    event CompartmentLocked(
        bytes32 indexed compartmentId,
        address indexed owner,
        uint256 lockedAt
    );

    event CompartmentUnlocked(
        bytes32 indexed compartmentId,
        address indexed owner,
        uint256 unlockedAt
    );

    event CompartmentAccessGranted(
        bytes32 indexed compartmentId,
        address indexed owner,
        address indexed provider,
        uint256 expiresAt
    );

    event CompartmentAccessRevoked(
        bytes32 indexed compartmentId,
        address indexed owner,
        address indexed provider,
        uint256 revokedAt
    );

    event JurisdictionFlagsUpdated(
        bytes32 indexed compartmentId,
        uint256 oldFlags,
        uint256 newFlags
    );

    event CompartmentStatsUpdated(
        bytes32 indexed compartmentId,
        uint256 recordCount,
        uint256 storageUsed
    );

    event EmergencyLockAll(
        address indexed owner,
        uint256 lockedAt,
        uint256 count
    );

    // ────────────────────────────────────────────────────────
    // Errors
    // ────────────────────────────────────────────────────────

    error InvalidCategory();
    error InvalidEncryptionKeyHash();
    error InvalidProvider();
    error InvalidDuration();
    error CompartmentNotFound();
    error NotCompartmentOwner();
    error CompartmentLocked_();
    error CompartmentNotLocked();
    error CompartmentAlreadyLocked();
    error MaxCompartmentsReached();
    error AccessAlreadyGranted();
    error AccessNotFound();
    error SelfAccessNotAllowed();

    // ────────────────────────────────────────────────────────
    // Modifiers
    // ────────────────────────────────────────────────────────

    modifier onlyCompartmentOwner(bytes32 compartmentId) {
        if (_compartments[compartmentId].owner == address(0)) revert CompartmentNotFound();
        if (_compartments[compartmentId].owner != msg.sender) revert NotCompartmentOwner();
        _;
    }

    modifier compartmentNotLocked(bytes32 compartmentId) {
        if (_compartments[compartmentId].locked) revert CompartmentLocked_();
        _;
    }

    // ────────────────────────────────────────────────────────
    // Constructor
    // ────────────────────────────────────────────────────────

    constructor() Ownable(msg.sender) {}

    // ────────────────────────────────────────────────────────
    // External Functions
    // ────────────────────────────────────────────────────────

    /**
     * @notice Create a new encrypted data compartment.
     * @param category Compartment category (e.g., keccak256("fertility_tracking"))
     * @param encryptionKeyHash Hash of the encryption key for this compartment
     * @return compartmentId Unique identifier for the new compartment
     */
    function createCompartment(
        bytes32 category,
        bytes32 encryptionKeyHash
    ) external nonReentrant whenNotPaused returns (bytes32 compartmentId) {
        if (category == bytes32(0)) revert InvalidCategory();
        if (encryptionKeyHash == bytes32(0)) revert InvalidEncryptionKeyHash();
        if (_ownerCompartments[msg.sender].length >= MAX_COMPARTMENTS_PER_USER) {
            revert MaxCompartmentsReached();
        }

        _nonce++;
        compartmentId = keccak256(
            abi.encodePacked(msg.sender, category, block.timestamp, _nonce)
        );

        _compartments[compartmentId] = Compartment({
            owner: msg.sender,
            category: category,
            encryptionKeyHash: encryptionKeyHash,
            recordCount: 0,
            storageUsed: 0,
            locked: false,
            createdAt: block.timestamp,
            lastAccessed: block.timestamp
        });

        _ownerCompartments[msg.sender].push(compartmentId);
        totalCompartments++;

        emit CompartmentCreated(compartmentId, msg.sender, category, block.timestamp);
    }

    /**
     * @notice Lock a compartment, preventing all access until unlocked.
     * @param compartmentId The compartment to lock
     */
    function lockCompartment(
        bytes32 compartmentId
    ) external nonReentrant onlyCompartmentOwner(compartmentId) {
        Compartment storage compartment = _compartments[compartmentId];
        if (compartment.locked) revert CompartmentAlreadyLocked();

        compartment.locked = true;

        emit CompartmentLocked(compartmentId, msg.sender, block.timestamp);
    }

    /**
     * @notice Unlock a previously locked compartment.
     * @param compartmentId The compartment to unlock
     */
    function unlockCompartment(
        bytes32 compartmentId
    ) external nonReentrant onlyCompartmentOwner(compartmentId) {
        Compartment storage compartment = _compartments[compartmentId];
        if (!compartment.locked) revert CompartmentNotLocked();

        compartment.locked = false;

        emit CompartmentUnlocked(compartmentId, msg.sender, block.timestamp);
    }

    /**
     * @notice Grant a provider time-limited access to a compartment.
     * @param compartmentId The compartment to grant access to
     * @param provider Address of the healthcare provider
     * @param durationSeconds Duration of the access grant in seconds
     */
    function grantCompartmentAccess(
        bytes32 compartmentId,
        address provider,
        uint256 durationSeconds
    ) external nonReentrant whenNotPaused onlyCompartmentOwner(compartmentId) compartmentNotLocked(compartmentId) {
        if (provider == address(0)) revert InvalidProvider();
        if (provider == msg.sender) revert SelfAccessNotAllowed();
        if (durationSeconds < MIN_ACCESS_DURATION || durationSeconds > MAX_ACCESS_DURATION) {
            revert InvalidDuration();
        }

        CompartmentAccess storage access = _access[compartmentId][provider];
        if (access.active && block.timestamp < access.expiresAt) {
            revert AccessAlreadyGranted();
        }

        uint256 expiresAt = block.timestamp + durationSeconds;

        _access[compartmentId][provider] = CompartmentAccess({
            provider: provider,
            grantedAt: block.timestamp,
            expiresAt: expiresAt,
            active: true
        });

        // Track provider for this compartment (only add if new)
        if (!_isProviderTracked(compartmentId, provider)) {
            _compartmentProviders[compartmentId].push(provider);
        }

        _compartments[compartmentId].lastAccessed = block.timestamp;

        emit CompartmentAccessGranted(compartmentId, msg.sender, provider, expiresAt);
    }

    /**
     * @notice Revoke a provider's access to a compartment.
     * @param compartmentId The compartment to revoke access from
     * @param provider Address of the provider to revoke
     */
    function revokeCompartmentAccess(
        bytes32 compartmentId,
        address provider
    ) external nonReentrant onlyCompartmentOwner(compartmentId) {
        CompartmentAccess storage access = _access[compartmentId][provider];
        if (!access.active) revert AccessNotFound();

        access.active = false;

        emit CompartmentAccessRevoked(compartmentId, msg.sender, provider, block.timestamp);
    }

    /**
     * @notice Update the record count and storage used for a compartment.
     *         Only the compartment owner can update stats.
     * @param compartmentId The compartment to update
     * @param recordCount New record count
     * @param storageUsed New storage used in bytes
     */
    function updateCompartmentStats(
        bytes32 compartmentId,
        uint256 recordCount,
        uint256 storageUsed
    ) external nonReentrant onlyCompartmentOwner(compartmentId) compartmentNotLocked(compartmentId) {
        Compartment storage compartment = _compartments[compartmentId];

        compartment.recordCount = recordCount;
        compartment.storageUsed = storageUsed;
        compartment.lastAccessed = block.timestamp;

        emit CompartmentStatsUpdated(compartmentId, recordCount, storageUsed);
    }

    /**
     * @notice Set jurisdictional compliance flags for a compartment.
     *         Flags are a bitfield where each bit represents a jurisdiction rule.
     * @param compartmentId The compartment to update
     * @param flags New jurisdiction flags bitfield
     */
    function setJurisdictionFlags(
        bytes32 compartmentId,
        uint256 flags
    ) external nonReentrant onlyCompartmentOwner(compartmentId) {
        uint256 oldFlags = _jurisdictionFlags[compartmentId];
        _jurisdictionFlags[compartmentId] = flags;

        emit JurisdictionFlagsUpdated(compartmentId, oldFlags, flags);
    }

    /**
     * @notice Emergency lock all compartments owned by the caller.
     */
    function emergencyLockAll() external nonReentrant {
        bytes32[] storage ids = _ownerCompartments[msg.sender];
        uint256 lockedCount = 0;

        for (uint256 i = 0; i < ids.length; i++) {
            Compartment storage compartment = _compartments[ids[i]];
            if (!compartment.locked) {
                compartment.locked = true;
                lockedCount++;
            }
        }

        emit EmergencyLockAll(msg.sender, block.timestamp, lockedCount);
    }

    // ────────────────────────────────────────────────────────
    // View Functions
    // ────────────────────────────────────────────────────────

    /**
     * @notice Get full compartment details by ID.
     * @param compartmentId The compartment to look up
     * @return The compartment record
     */
    function getCompartment(
        bytes32 compartmentId
    ) external view returns (Compartment memory) {
        if (_compartments[compartmentId].owner == address(0)) revert CompartmentNotFound();
        return _compartments[compartmentId];
    }

    /**
     * @notice Get access details for a provider on a compartment.
     * @param compartmentId The compartment
     * @param provider The provider address
     * @return The access record
     */
    function getCompartmentAccess(
        bytes32 compartmentId,
        address provider
    ) external view returns (CompartmentAccess memory) {
        return _access[compartmentId][provider];
    }

    /**
     * @notice Check if a provider's access to a compartment is currently valid.
     * @param compartmentId The compartment
     * @param provider The provider address
     * @return True if access is active, not expired, and compartment is not locked
     */
    function isCompartmentAccessValid(
        bytes32 compartmentId,
        address provider
    ) external view returns (bool) {
        Compartment storage compartment = _compartments[compartmentId];
        if (compartment.owner == address(0)) return false;
        if (compartment.locked) return false;

        CompartmentAccess storage access = _access[compartmentId][provider];
        if (!access.active) return false;
        if (block.timestamp >= access.expiresAt) return false;

        return true;
    }

    /**
     * @notice Get all compartment IDs for an owner.
     * @param owner_ The owner address
     * @return Array of compartment IDs
     */
    function getOwnerCompartments(
        address owner_
    ) external view returns (bytes32[] memory) {
        return _ownerCompartments[owner_];
    }

    /**
     * @notice Get the jurisdiction flags for a compartment.
     * @param compartmentId The compartment
     * @return The jurisdiction flags bitfield
     */
    function getJurisdictionFlags(
        bytes32 compartmentId
    ) external view returns (uint256) {
        return _jurisdictionFlags[compartmentId];
    }

    // ────────────────────────────────────────────────────────
    // Admin Functions
    // ────────────────────────────────────────────────────────

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
     * @dev Check if a provider is already tracked for a compartment.
     */
    function _isProviderTracked(
        bytes32 compartmentId,
        address provider
    ) internal view returns (bool) {
        address[] storage providers = _compartmentProviders[compartmentId];
        for (uint256 i = 0; i < providers.length; i++) {
            if (providers[i] == provider) return true;
        }
        return false;
    }
}
