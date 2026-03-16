// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// ============================================================
// Shiora Health AI — Interface Definitions
// Core interfaces for the Shiora protocol on Aethelred
// ============================================================

// ────────────────────────────────────────────────────────────
// IShioraAccessControl
// ────────────────────────────────────────────────────────────

interface IShioraAccessControl {
    /// @notice Permission flags for access grants
    enum Permission {
        VIEW,
        DOWNLOAD,
        SHARE
    }

    /// @notice Status of an access grant
    enum GrantStatus {
        ACTIVE,
        EXPIRED,
        REVOKED
    }

    /// @notice Access grant data structure
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

    // Events
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

    event AccessExpired(
        bytes32 indexed grantId,
        address indexed provider,
        uint256 expiredAt
    );

    // Functions
    function grantAccess(
        address provider,
        string calldata scope,
        uint256 durationSeconds,
        bool canView,
        bool canDownload,
        bool canShare,
        bytes32 attestationHash
    ) external returns (bytes32 grantId);

    function revokeAccess(bytes32 grantId) external;

    function modifyAccess(
        bytes32 grantId,
        string calldata newScope,
        uint256 newDurationSeconds,
        bool canView,
        bool canDownload,
        bool canShare
    ) external;

    function getGrant(bytes32 grantId) external view returns (AccessGrant memory);

    function isAccessValid(bytes32 grantId) external view returns (bool);

    function getProviderGrants(address owner, address provider)
        external
        view
        returns (bytes32[] memory);

    function getOwnerGrants(address owner) external view returns (bytes32[] memory);
}

// ────────────────────────────────────────────────────────────
// IShioraRecordRegistry
// ────────────────────────────────────────────────────────────

interface IShioraRecordRegistry {
    /// @notice Encryption type for records
    enum EncryptionType {
        AES_256_GCM,
        AES_256_CBC
    }

    /// @notice Status of a health record
    enum RecordStatus {
        PROCESSING,
        PINNING,
        PINNED,
        VERIFIED,
        DELETED
    }

    /// @notice Health record metadata (stored on-chain)
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

    // Events
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

    event RecordDeleted(
        bytes32 indexed recordId,
        address indexed owner,
        uint256 deletedAt
    );

    event RecordVerified(
        bytes32 indexed recordId,
        bytes32 attestationHash,
        uint256 verifiedAt
    );

    // Functions
    function registerRecord(
        string calldata recordType,
        string calldata ipfsCid,
        EncryptionType encryption,
        bytes32 contentHash,
        uint256 size
    ) external returns (bytes32 recordId);

    function updateRecordStatus(
        bytes32 recordId,
        RecordStatus newStatus
    ) external;

    function verifyRecord(
        bytes32 recordId,
        bytes32 attestationHash
    ) external;

    function deleteRecord(bytes32 recordId) external;

    function getRecord(bytes32 recordId) external view returns (RecordMeta memory);

    function getOwnerRecords(address owner) external view returns (bytes32[] memory);

    function getRecordCount(address owner) external view returns (uint256);
}

// ────────────────────────────────────────────────────────────
// IShioraTEEVerifier
// ────────────────────────────────────────────────────────────

interface IShioraTEEVerifier {
    /// @notice TEE platform type
    enum Platform {
        INTEL_SGX,
        AWS_NITRO,
        AMD_SEV
    }

    /// @notice Attestation data structure
    struct Attestation {
        bytes32 attestationHash;
        Platform platform;
        bytes32 enclaveId;
        address submitter;
        uint256 timestamp;
        bool verified;
        bytes signature;
    }

    /// @notice Registered AI model
    struct Model {
        string name;
        string version;
        bytes32 modelHash;
        Platform platform;
        bool active;
        uint256 registeredAt;
        uint256 totalInferences;
    }

    /// @notice Inference record
    struct Inference {
        bytes32 modelId;
        bytes32 inputHash;
        bytes32 outputHash;
        bytes32 attestationHash;
        uint256 timestamp;
        uint256 confidence;
    }

    // Events
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

    event InferenceRecorded(
        bytes32 indexed inferenceId,
        bytes32 indexed modelId,
        bytes32 attestationHash,
        uint256 confidence
    );

    // Functions
    function submitAttestation(
        bytes32 attestationHash,
        Platform platform,
        bytes32 enclaveId,
        bytes calldata signature
    ) external returns (bytes32);

    function verifyAttestation(bytes32 attestationHash) external;

    function registerModel(
        string calldata name,
        string calldata version,
        bytes32 modelHash,
        Platform platform
    ) external returns (bytes32 modelId);

    function deactivateModel(bytes32 modelId) external;

    function recordInference(
        bytes32 modelId,
        bytes32 inputHash,
        bytes32 outputHash,
        bytes32 attestationHash,
        uint256 confidence
    ) external returns (bytes32 inferenceId);

    function getAttestation(bytes32 attestationHash)
        external
        view
        returns (Attestation memory);

    function isAttestationValid(bytes32 attestationHash)
        external
        view
        returns (bool);

    function getModel(bytes32 modelId) external view returns (Model memory);

    function getInference(bytes32 inferenceId)
        external
        view
        returns (Inference memory);

    function getModelInferenceCount(bytes32 modelId)
        external
        view
        returns (uint256);
}

// ────────────────────────────────────────────────────────────
// IShioraConsentManager
// ────────────────────────────────────────────────────────────

interface IShioraConsentManager {
    /// @notice Status of a consent record
    enum ConsentStatus {
        ACTIVE,
        EXPIRED,
        REVOKED,
        PENDING
    }

    /// @notice Consent data structure
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

    // Events
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

    // Functions
    function grantConsent(
        address provider,
        bytes32[] calldata scopes,
        uint256 durationSeconds,
        bool autoRenew,
        bytes32 policyId,
        bytes32 attestation
    ) external returns (bytes32 consentId);

    function revokeConsent(bytes32 consentId) external;

    function modifyConsent(
        bytes32 consentId,
        bytes32[] calldata newScopes,
        uint256 newDurationSeconds
    ) external;

    function revokeAllFromProvider(address provider) external;

    function checkConsent(
        address patient,
        address provider,
        bytes32 scope
    ) external view returns (bool);

    function getActiveConsents(address patient)
        external
        view
        returns (bytes32[] memory);

    function getProviderConsents(address patient, address provider)
        external
        view
        returns (bytes32[] memory);

    function getConsent(bytes32 consentId)
        external
        view
        returns (Consent memory);
}

// ────────────────────────────────────────────────────────────
// IShioraReproductiveVault
// ────────────────────────────────────────────────────────────

interface IShioraReproductiveVault {
    /// @notice Encrypted data compartment
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

    /// @notice Per-compartment access grant
    struct CompartmentAccess {
        address provider;
        uint256 grantedAt;
        uint256 expiresAt;
        bool active;
    }

    // Events
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

    // Functions
    function createCompartment(
        bytes32 category,
        bytes32 encryptionKeyHash
    ) external returns (bytes32 compartmentId);

    function lockCompartment(bytes32 compartmentId) external;

    function unlockCompartment(bytes32 compartmentId) external;

    function grantCompartmentAccess(
        bytes32 compartmentId,
        address provider,
        uint256 durationSeconds
    ) external;

    function revokeCompartmentAccess(
        bytes32 compartmentId,
        address provider
    ) external;

    function updateCompartmentStats(
        bytes32 compartmentId,
        uint256 recordCount,
        uint256 storageUsed
    ) external;

    function setJurisdictionFlags(
        bytes32 compartmentId,
        uint256 flags
    ) external;

    function emergencyLockAll() external;

    function getCompartment(bytes32 compartmentId)
        external
        view
        returns (Compartment memory);

    function getCompartmentAccess(bytes32 compartmentId, address provider)
        external
        view
        returns (CompartmentAccess memory);

    function isCompartmentAccessValid(bytes32 compartmentId, address provider)
        external
        view
        returns (bool);

    function getOwnerCompartments(address owner)
        external
        view
        returns (bytes32[] memory);

    function getJurisdictionFlags(bytes32 compartmentId)
        external
        view
        returns (uint256);
}

// ────────────────────────────────────────────────────────────
// IShioraGovernance
// ────────────────────────────────────────────────────────────

interface IShioraGovernance {
    /// @notice Status of a governance proposal
    enum ProposalStatus {
        ACTIVE,
        PASSED,
        DEFEATED,
        QUEUED,
        EXECUTED,
        CANCELLED
    }

    /// @notice Governance proposal
    struct Proposal {
        address proposer;
        bytes32 proposalType;
        string title;
        string description;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 abstainVotes;
        uint256 startBlock;
        uint256 endBlock;
        ProposalStatus status;
        uint256 createdAt;
        uint256 executedAt;
    }

    /// @notice Vote receipt for a voter on a proposal
    struct VoteReceipt {
        bool hasVoted;
        uint8 support;
        uint256 weight;
    }

    // Events
    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed proposer,
        bytes32 proposalType,
        string title,
        uint256 startBlock,
        uint256 endBlock
    );

    event VoteCast(
        uint256 indexed proposalId,
        address indexed voter,
        uint8 support,
        uint256 weight
    );

    event ProposalExecuted(
        uint256 indexed proposalId,
        uint256 executedAt
    );

    event ProposalCancelled(
        uint256 indexed proposalId,
        uint256 cancelledAt
    );

    event DelegateChanged(
        address indexed delegator,
        address indexed fromDelegate,
        address indexed toDelegate
    );

    // Functions
    function createProposal(
        bytes32 proposalType,
        string calldata title,
        string calldata description,
        uint256 votingPeriodBlocks
    ) external returns (uint256 proposalId);

    function vote(uint256 proposalId, uint8 support) external;

    function delegate(address delegatee) external;

    function undelegate() external;

    function executeProposal(uint256 proposalId) external;

    function cancelProposal(uint256 proposalId) external;

    function getProposal(uint256 proposalId)
        external
        view
        returns (Proposal memory);

    function getVoteReceipt(uint256 proposalId, address voter)
        external
        view
        returns (VoteReceipt memory);

    function getVotingPower(address account)
        external
        view
        returns (uint256);

    function proposalState(uint256 proposalId)
        external
        view
        returns (ProposalStatus);

    function quorumReached(uint256 proposalId)
        external
        view
        returns (bool);

    function getDelegate(address account)
        external
        view
        returns (address);
}

// ────────────────────────────────────────────────────────────
// IShioraStaking
// ────────────────────────────────────────────────────────────

interface IShioraStaking {
    /// @notice Status of a stake position
    enum StakeStatus {
        STAKED,
        UNSTAKING,
        WITHDRAWN
    }

    /// @notice Stake position data
    struct StakePosition {
        address staker;
        uint256 amount;
        uint256 stakedAt;
        uint256 unlockAt;
        StakeStatus status;
        uint256 rewardsEarned;
        uint256 rewardsClaimed;
    }

    // Events
    event Staked(
        uint256 indexed positionId,
        address indexed staker,
        uint256 amount,
        uint256 stakedAt
    );

    event UnstakeInitiated(
        uint256 indexed positionId,
        address indexed staker,
        uint256 unlockAt
    );

    event Withdrawn(
        uint256 indexed positionId,
        address indexed staker,
        uint256 amount,
        uint256 withdrawnAt
    );

    event RewardsClaimed(
        uint256 indexed positionId,
        address indexed staker,
        uint256 amount
    );

    event RewardRateUpdated(
        uint256 oldRate,
        uint256 newRate
    );

    // Functions
    function stake(uint256 amount) external returns (uint256 positionId);

    function unstake(uint256 positionId) external;

    function withdraw(uint256 positionId) external;

    function claimRewards(uint256 positionId) external;

    function fundRewardPool(uint256 amount) external;

    function getStakePosition(uint256 positionId)
        external
        view
        returns (StakePosition memory);

    function getStakerPositions(address staker)
        external
        view
        returns (uint256[] memory);

    function calculatePendingRewards(uint256 positionId)
        external
        view
        returns (uint256);

    function getTotalStaked() external view returns (uint256);

    function getStakerVotingPower(address staker)
        external
        view
        returns (uint256);
}

// ────────────────────────────────────────────────────────────
// IShioraMarketplace
// ────────────────────────────────────────────────────────────

interface IShioraMarketplace {
    /// @notice Status of a marketplace listing
    enum ListingStatus {
        ACTIVE,
        SOLD,
        EXPIRED,
        WITHDRAWN
    }

    /// @notice Health data listing
    struct Listing {
        address seller;
        bytes32 category;
        bytes32 dataHash;
        uint256 price;
        uint256 purchaseCount;
        ListingStatus status;
        bool teeVerified;
        bytes32 attestation;
        uint256 qualityScore;
        uint256 createdAt;
        uint256 expiresAt;
    }

    /// @notice Purchase record
    struct Purchase {
        address buyer;
        uint256 listingId;
        uint256 price;
        uint256 purchasedAt;
        bytes32 txHash;
    }

    /// @notice Aggregate marketplace statistics
    struct MarketplaceStats {
        uint256 totalListings;
        uint256 totalPurchases;
        uint256 totalVolume;
        uint256 protocolFees;
        uint256 stakerFees;
    }

    // Events
    event DataListed(
        uint256 indexed listingId,
        address indexed seller,
        bytes32 category,
        uint256 price,
        uint256 qualityScore,
        uint256 expiresAt
    );

    event DataPurchased(
        uint256 indexed purchaseId,
        uint256 indexed listingId,
        address indexed buyer,
        uint256 price,
        uint256 sellerAmount,
        uint256 protocolAmount,
        uint256 stakerAmount
    );

    event ListingWithdrawn(
        uint256 indexed listingId,
        address indexed seller,
        uint256 withdrawnAt
    );

    event PriceUpdated(
        uint256 indexed listingId,
        uint256 oldPrice,
        uint256 newPrice
    );

    // Functions
    function listData(
        bytes32 category,
        bytes32 dataHash,
        uint256 price,
        bytes32 attestation,
        uint256 qualityScore,
        uint256 durationDays
    ) external returns (uint256 listingId);

    function purchaseData(uint256 listingId)
        external
        returns (uint256 purchaseId);

    function withdrawListing(uint256 listingId) external;

    function updatePrice(uint256 listingId, uint256 newPrice) external;

    function getActiveListing(uint256 listingId)
        external
        view
        returns (Listing memory);

    function getSellerListings(address seller)
        external
        view
        returns (uint256[] memory);

    function getBuyerPurchases(address buyer)
        external
        view
        returns (uint256[] memory);

    function getMarketplaceStats()
        external
        view
        returns (MarketplaceStats memory);
}

// ────────────────────────────────────────────────────────────
// IShioraZKVerifier
// ────────────────────────────────────────────────────────────

interface IShioraZKVerifier {
    /// @notice ZK proof claim
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

    // Events
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

    // Functions
    function submitClaim(
        bytes32 claimType,
        bytes32 proofHash,
        bytes32 publicInputsHash,
        uint256 expiresAt
    ) external returns (bytes32 claimId);

    function verifyClaim(
        bytes32 claimId,
        bytes calldata proof,
        bytes calldata publicInputs
    ) external;

    function registerVerifier(address verifier) external;

    function removeVerifier(address verifier) external;

    function getClaim(bytes32 claimId)
        external
        view
        returns (Claim memory);

    function isClaimValid(bytes32 claimId) external view returns (bool);

    function getClaimantClaims(address claimant)
        external
        view
        returns (bytes32[] memory);

    function isVerifier(address verifier) external view returns (bool);

    function isClaimTypeSupported(bytes32 claimType)
        external
        view
        returns (bool);
}
