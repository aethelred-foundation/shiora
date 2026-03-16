// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title ShioraConsentManager
 * @author Shiora Health AI on Aethelred
 * @notice Manages granular, time-limited, scope-limited, revocable consent
 *         permissions for health data sharing between patients and providers.
 *         Consents can carry multiple scopes, auto-renew, and reference
 *         off-chain privacy policies via a policyId.
 */
contract ShioraConsentManager is Ownable, ReentrancyGuard, Pausable {

    // ────────────────────────────────────────────────────────
    // Enums
    // ────────────────────────────────────────────────────────

    enum ConsentStatus {
        ACTIVE,
        EXPIRED,
        REVOKED,
        PENDING
    }

    // ────────────────────────────────────────────────────────
    // Structs
    // ────────────────────────────────────────────────────────

    struct Consent {
        address patient;
        address provider;
        bytes32[] scopes;
        uint256 grantedAt;
        uint256 expiresAt;
        bool autoRenew;
        ConsentStatus status;
        bytes32 policyId;
        bytes32 attestation;
    }

    // ────────────────────────────────────────────────────────
    // State
    // ────────────────────────────────────────────────────────

    /// @notice Consent records by ID
    mapping(bytes32 => Consent) private _consents;

    /// @notice Consent IDs per patient
    mapping(address => bytes32[]) private _patientConsents;

    /// @notice Consent IDs per (patient, provider) pair
    mapping(address => mapping(address => bytes32[])) private _providerConsents;

    /// @notice Total number of consents created
    uint256 public totalConsents;

    /// @notice Nonce for unique consent ID generation
    uint256 private _nonce;

    /// @notice Maximum consent duration (365 days)
    uint256 public constant MAX_DURATION = 365 days;

    /// @notice Minimum consent duration (1 hour)
    uint256 public constant MIN_DURATION = 1 hours;

    /// @notice Maximum number of scopes per consent
    uint256 public constant MAX_SCOPES = 10;

    // ────────────────────────────────────────────────────────
    // Events
    // ────────────────────────────────────────────────────────

    event ConsentGranted(
        bytes32 indexed consentId,
        address indexed patient,
        address indexed provider,
        bytes32[] scopes,
        uint256 expiresAt,
        bytes32 policyId
    );

    event ConsentRevoked(
        bytes32 indexed consentId,
        address indexed patient,
        address indexed provider,
        uint256 revokedAt
    );

    event ConsentModified(
        bytes32 indexed consentId,
        address indexed patient,
        bytes32[] newScopes,
        uint256 newExpiresAt
    );

    event ConsentExpired(
        bytes32 indexed consentId,
        address indexed patient,
        address indexed provider,
        uint256 expiredAt
    );

    event AllConsentsRevoked(
        address indexed patient,
        address indexed provider,
        uint256 revokedAt,
        uint256 count
    );

    // ────────────────────────────────────────────────────────
    // Errors
    // ────────────────────────────────────────────────────────

    error InvalidProvider();
    error InvalidScope();
    error InvalidDuration();
    error ConsentNotFound();
    error NotConsentOwner();
    error ConsentAlreadyRevoked();
    error SelfConsentNotAllowed();
    error TooManyScopes();

    // ────────────────────────────────────────────────────────
    // Modifiers
    // ────────────────────────────────────────────────────────

    modifier onlyConsentOwner(bytes32 consentId) {
        if (_consents[consentId].patient == address(0)) revert ConsentNotFound();
        if (_consents[consentId].patient != msg.sender) revert NotConsentOwner();
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
     * @notice Grant a provider consent to access health data with specific scopes.
     * @param provider Address of the healthcare provider
     * @param scopes Array of scope identifiers (e.g., keccak256("lab_results"))
     * @param durationSeconds Duration of the consent in seconds
     * @param autoRenew Whether the consent should auto-renew upon expiry
     * @param policyId Reference to an off-chain privacy policy
     * @param attestation TEE attestation hash for the consent creation
     * @return consentId Unique identifier for the new consent
     */
    function grantConsent(
        address provider,
        bytes32[] calldata scopes,
        uint256 durationSeconds,
        bool autoRenew,
        bytes32 policyId,
        bytes32 attestation
    ) external nonReentrant whenNotPaused returns (bytes32 consentId) {
        if (provider == address(0)) revert InvalidProvider();
        if (provider == msg.sender) revert SelfConsentNotAllowed();
        if (scopes.length == 0) revert InvalidScope();
        if (scopes.length > MAX_SCOPES) revert TooManyScopes();
        if (durationSeconds < MIN_DURATION || durationSeconds > MAX_DURATION) {
            revert InvalidDuration();
        }

        // Validate that no scope is the zero hash
        for (uint256 i = 0; i < scopes.length; i++) {
            if (scopes[i] == bytes32(0)) revert InvalidScope();
        }

        _nonce++;
        consentId = keccak256(
            abi.encodePacked(msg.sender, provider, block.timestamp, _nonce)
        );

        uint256 expiresAt = block.timestamp + durationSeconds;

        _consents[consentId] = Consent({
            patient: msg.sender,
            provider: provider,
            scopes: scopes,
            grantedAt: block.timestamp,
            expiresAt: expiresAt,
            autoRenew: autoRenew,
            status: ConsentStatus.ACTIVE,
            policyId: policyId,
            attestation: attestation
        });

        _patientConsents[msg.sender].push(consentId);
        _providerConsents[msg.sender][provider].push(consentId);
        totalConsents++;

        emit ConsentGranted(consentId, msg.sender, provider, scopes, expiresAt, policyId);
    }

    /**
     * @notice Revoke an existing consent. Only the patient can revoke.
     * @param consentId The consent to revoke
     */
    function revokeConsent(
        bytes32 consentId
    ) external nonReentrant onlyConsentOwner(consentId) {
        Consent storage consent = _consents[consentId];

        if (consent.status == ConsentStatus.REVOKED) revert ConsentAlreadyRevoked();

        consent.status = ConsentStatus.REVOKED;

        emit ConsentRevoked(consentId, msg.sender, consent.provider, block.timestamp);
    }

    /**
     * @notice Modify an existing consent's scopes and/or duration.
     * @param consentId The consent to modify
     * @param newScopes New scope array (empty to keep current)
     * @param newDurationSeconds New duration from now (0 to keep current)
     */
    function modifyConsent(
        bytes32 consentId,
        bytes32[] calldata newScopes,
        uint256 newDurationSeconds
    ) external nonReentrant onlyConsentOwner(consentId) {
        Consent storage consent = _consents[consentId];

        if (consent.status == ConsentStatus.REVOKED) revert ConsentAlreadyRevoked();
        if (block.timestamp >= consent.expiresAt && !consent.autoRenew) {
            revert ConsentNotFound();
        }

        if (newScopes.length > 0) {
            if (newScopes.length > MAX_SCOPES) revert TooManyScopes();
            for (uint256 i = 0; i < newScopes.length; i++) {
                if (newScopes[i] == bytes32(0)) revert InvalidScope();
            }
            consent.scopes = newScopes;
        }

        if (newDurationSeconds > 0) {
            if (newDurationSeconds < MIN_DURATION || newDurationSeconds > MAX_DURATION) {
                revert InvalidDuration();
            }
            consent.expiresAt = block.timestamp + newDurationSeconds;
        }

        emit ConsentModified(consentId, msg.sender, consent.scopes, consent.expiresAt);
    }

    /**
     * @notice Revoke all active consents from a specific provider.
     * @param provider The provider whose consents should be revoked
     */
    function revokeAllFromProvider(
        address provider
    ) external nonReentrant {
        if (provider == address(0)) revert InvalidProvider();

        bytes32[] storage consentIds = _providerConsents[msg.sender][provider];
        uint256 revokedCount = 0;

        for (uint256 i = 0; i < consentIds.length; i++) {
            Consent storage consent = _consents[consentIds[i]];
            if (consent.status == ConsentStatus.ACTIVE) {
                consent.status = ConsentStatus.REVOKED;
                revokedCount++;
            }
        }

        emit AllConsentsRevoked(msg.sender, provider, block.timestamp, revokedCount);
    }

    // ────────────────────────────────────────────────────────
    // View Functions
    // ────────────────────────────────────────────────────────

    /**
     * @notice Check whether a patient has given a provider consent for a specific scope.
     * @param patient The patient address
     * @param provider The provider address
     * @param scope The scope to check
     * @return True if an active, non-expired consent exists for the scope
     */
    function checkConsent(
        address patient,
        address provider,
        bytes32 scope
    ) external view returns (bool) {
        bytes32[] storage consentIds = _providerConsents[patient][provider];

        for (uint256 i = 0; i < consentIds.length; i++) {
            Consent storage consent = _consents[consentIds[i]];
            if (consent.status != ConsentStatus.ACTIVE) continue;
            if (block.timestamp >= consent.expiresAt) continue;

            for (uint256 j = 0; j < consent.scopes.length; j++) {
                if (consent.scopes[j] == scope) return true;
            }
        }

        return false;
    }

    /**
     * @notice Get all consent IDs for a patient (active and historical).
     * @param patient The patient address
     * @return Array of consent IDs
     */
    function getActiveConsents(
        address patient
    ) external view returns (bytes32[] memory) {
        return _patientConsents[patient];
    }

    /**
     * @notice Get all consent IDs between a patient and a specific provider.
     * @param patient The patient address
     * @param provider The provider address
     * @return Array of consent IDs
     */
    function getProviderConsents(
        address patient,
        address provider
    ) external view returns (bytes32[] memory) {
        return _providerConsents[patient][provider];
    }

    /**
     * @notice Get full consent details by ID.
     * @param consentId The consent to look up
     * @return The consent record
     */
    function getConsent(
        bytes32 consentId
    ) external view returns (Consent memory) {
        if (_consents[consentId].patient == address(0)) revert ConsentNotFound();
        return _consents[consentId];
    }

    /**
     * @notice Get the effective status of a consent, accounting for auto-expiry.
     * @param consentId The consent to check
     * @return The effective status
     */
    function getEffectiveStatus(
        bytes32 consentId
    ) external view returns (ConsentStatus) {
        Consent storage consent = _consents[consentId];
        if (consent.patient == address(0)) revert ConsentNotFound();

        if (consent.status == ConsentStatus.REVOKED) return ConsentStatus.REVOKED;
        if (block.timestamp >= consent.expiresAt) return ConsentStatus.EXPIRED;
        return consent.status;
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
