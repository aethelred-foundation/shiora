// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title ShioraAccessControl
 * @author Shiora Health AI on Aethelred
 * @notice Manages granular, time-limited access grants for encrypted health data.
 *         Only the record owner can grant, modify, or revoke provider access.
 *         Grants auto-expire based on the specified duration.
 */
contract ShioraAccessControl is Ownable, ReentrancyGuard, Pausable {

    // ────────────────────────────────────────────────────────
    // Enums
    // ────────────────────────────────────────────────────────

    enum GrantStatus {
        ACTIVE,
        EXPIRED,
        REVOKED
    }

    // ────────────────────────────────────────────────────────
    // Structs
    // ────────────────────────────────────────────────────────

    struct AccessGrant {
        address owner;
        address provider;
        string scope;
        uint256 grantedAt;
        uint256 expiresAt;
        bool canView;
        bool canDownload;
        bool canShare;
        GrantStatus status;
        bytes32 attestationHash;
    }

    // ────────────────────────────────────────────────────────
    // State
    // ────────────────────────────────────────────────────────

    /// @notice All grants by ID
    mapping(bytes32 => AccessGrant) private _grants;

    /// @notice Grant IDs owned by each address
    mapping(address => bytes32[]) private _ownerGrants;

    /// @notice Grant IDs per (owner, provider) pair
    mapping(address => mapping(address => bytes32[])) private _providerGrants;

    /// @notice Total number of grants created
    uint256 public totalGrants;

    /// @notice Nonce for unique grant ID generation
    uint256 private _nonce;

    /// @notice Maximum grant duration (365 days)
    uint256 public constant MAX_DURATION = 365 days;

    /// @notice Minimum grant duration (1 hour)
    uint256 public constant MIN_DURATION = 1 hours;

    // ────────────────────────────────────────────────────────
    // Events
    // ────────────────────────────────────────────────────────

    event AccessGranted(
        bytes32 indexed grantId,
        address indexed owner,
        address indexed provider,
        string scope,
        uint256 expiresAt
    );

    event AccessRevoked(
        bytes32 indexed grantId,
        address indexed owner,
        address indexed provider,
        uint256 revokedAt
    );

    event AccessModified(
        bytes32 indexed grantId,
        address indexed owner,
        string newScope,
        uint256 newExpiresAt
    );

    event AccessChecked(
        bytes32 indexed grantId,
        address indexed provider,
        bool isValid
    );

    // ────────────────────────────────────────────────────────
    // Errors
    // ────────────────────────────────────────────────────────

    error InvalidProvider();
    error InvalidDuration();
    error InvalidScope();
    error GrantNotFound();
    error NotGrantOwner();
    error GrantAlreadyRevoked();
    error GrantExpired();
    error SelfGrantNotAllowed();
    error NoPermissionsSet();

    // ────────────────────────────────────────────────────────
    // Modifiers
    // ────────────────────────────────────────────────────────

    modifier onlyGrantOwner(bytes32 grantId) {
        if (_grants[grantId].owner == address(0)) revert GrantNotFound();
        if (_grants[grantId].owner != msg.sender) revert NotGrantOwner();
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
     * @notice Grant a provider time-limited access to health data.
     * @param provider Address of the healthcare provider
     * @param scope Data scope (e.g., "Full Records", "Lab Results Only")
     * @param durationSeconds Duration of the grant in seconds
     * @param canView Whether the provider can view records
     * @param canDownload Whether the provider can download records
     * @param canShare Whether the provider can share records
     * @param attestationHash TEE attestation hash for the grant creation
     * @return grantId Unique identifier for the new grant
     */
    function grantAccess(
        address provider,
        string calldata scope,
        uint256 durationSeconds,
        bool canView,
        bool canDownload,
        bool canShare,
        bytes32 attestationHash
    ) external nonReentrant whenNotPaused returns (bytes32 grantId) {
        if (provider == address(0)) revert InvalidProvider();
        if (provider == msg.sender) revert SelfGrantNotAllowed();
        if (durationSeconds < MIN_DURATION || durationSeconds > MAX_DURATION) {
            revert InvalidDuration();
        }
        if (bytes(scope).length == 0) revert InvalidScope();
        if (!canView && !canDownload && !canShare) revert NoPermissionsSet();

        _nonce++;
        grantId = keccak256(
            abi.encodePacked(msg.sender, provider, block.timestamp, _nonce)
        );

        uint256 expiresAt = block.timestamp + durationSeconds;

        _grants[grantId] = AccessGrant({
            owner: msg.sender,
            provider: provider,
            scope: scope,
            grantedAt: block.timestamp,
            expiresAt: expiresAt,
            canView: canView,
            canDownload: canDownload,
            canShare: canShare,
            status: GrantStatus.ACTIVE,
            attestationHash: attestationHash
        });

        _ownerGrants[msg.sender].push(grantId);
        _providerGrants[msg.sender][provider].push(grantId);
        totalGrants++;

        emit AccessGranted(grantId, msg.sender, provider, scope, expiresAt);
    }

    /**
     * @notice Revoke an existing access grant. Only the owner can revoke.
     * @param grantId The grant to revoke
     */
    function revokeAccess(
        bytes32 grantId
    ) external nonReentrant onlyGrantOwner(grantId) {
        AccessGrant storage grant = _grants[grantId];

        if (grant.status == GrantStatus.REVOKED) revert GrantAlreadyRevoked();

        grant.status = GrantStatus.REVOKED;

        emit AccessRevoked(grantId, msg.sender, grant.provider, block.timestamp);
    }

    /**
     * @notice Modify an existing grant's scope, duration, and permissions.
     * @param grantId The grant to modify
     * @param newScope New data scope
     * @param newDurationSeconds New duration from now (0 to keep current)
     * @param canView Updated view permission
     * @param canDownload Updated download permission
     * @param canShare Updated share permission
     */
    function modifyAccess(
        bytes32 grantId,
        string calldata newScope,
        uint256 newDurationSeconds,
        bool canView,
        bool canDownload,
        bool canShare
    ) external nonReentrant onlyGrantOwner(grantId) {
        AccessGrant storage grant = _grants[grantId];

        if (grant.status == GrantStatus.REVOKED) revert GrantAlreadyRevoked();
        if (block.timestamp >= grant.expiresAt) revert GrantExpired();
        if (!canView && !canDownload && !canShare) revert NoPermissionsSet();

        if (bytes(newScope).length > 0) {
            grant.scope = newScope;
        }

        if (newDurationSeconds > 0) {
            if (newDurationSeconds < MIN_DURATION || newDurationSeconds > MAX_DURATION) {
                revert InvalidDuration();
            }
            grant.expiresAt = block.timestamp + newDurationSeconds;
        }

        grant.canView = canView;
        grant.canDownload = canDownload;
        grant.canShare = canShare;

        emit AccessModified(grantId, msg.sender, grant.scope, grant.expiresAt);
    }

    // ────────────────────────────────────────────────────────
    // View Functions
    // ────────────────────────────────────────────────────────

    /**
     * @notice Get the full details of an access grant.
     */
    function getGrant(
        bytes32 grantId
    ) external view returns (AccessGrant memory) {
        if (_grants[grantId].owner == address(0)) revert GrantNotFound();
        return _grants[grantId];
    }

    /**
     * @notice Check whether an access grant is currently valid.
     *         A grant is valid if it is ACTIVE and has not expired.
     */
    function isAccessValid(bytes32 grantId) external view returns (bool) {
        AccessGrant storage grant = _grants[grantId];
        if (grant.owner == address(0)) return false;
        if (grant.status != GrantStatus.ACTIVE) return false;
        if (block.timestamp >= grant.expiresAt) return false;
        return true;
    }

    /**
     * @notice Check if a provider has a specific permission for a grant.
     */
    function hasPermission(
        bytes32 grantId,
        uint8 permission
    ) external view returns (bool) {
        AccessGrant storage grant = _grants[grantId];
        if (grant.owner == address(0)) return false;
        if (grant.status != GrantStatus.ACTIVE) return false;
        if (block.timestamp >= grant.expiresAt) return false;

        if (permission == 0) return grant.canView;
        if (permission == 1) return grant.canDownload;
        if (permission == 2) return grant.canShare;
        return false;
    }

    /**
     * @notice Get all grant IDs for a specific (owner, provider) pair.
     */
    function getProviderGrants(
        address owner,
        address provider
    ) external view returns (bytes32[] memory) {
        return _providerGrants[owner][provider];
    }

    /**
     * @notice Get all grant IDs for a given owner.
     */
    function getOwnerGrants(
        address owner
    ) external view returns (bytes32[] memory) {
        return _ownerGrants[owner];
    }

    /**
     * @notice Get the effective status of a grant, accounting for auto-expiry.
     */
    function getEffectiveStatus(
        bytes32 grantId
    ) external view returns (GrantStatus) {
        AccessGrant storage grant = _grants[grantId];
        if (grant.owner == address(0)) revert GrantNotFound();

        if (grant.status == GrantStatus.REVOKED) return GrantStatus.REVOKED;
        if (block.timestamp >= grant.expiresAt) return GrantStatus.EXPIRED;
        return grant.status;
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
}
