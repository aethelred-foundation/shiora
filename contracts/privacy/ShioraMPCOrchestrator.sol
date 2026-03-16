// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title ShioraMPCOrchestrator
 * @author Shiora Health AI on Aethelred
 * @notice Orchestrates Multi-Party Computation sessions for federated
 *         health analytics. Manages session lifecycle, participant enrollment,
 *         result commitment, and differential privacy budget tracking.
 *         All computations run inside TEE enclaves on Aethelred.
 */
contract ShioraMPCOrchestrator is Ownable, ReentrancyGuard, Pausable {

    // ────────────────────────────────────────────────────────
    // Enums
    // ────────────────────────────────────────────────────────

    enum SessionStatus {
        CREATED,
        ENROLLING,
        COMPUTING,
        AGGREGATING,
        COMPLETED,
        FAILED,
        CANCELLED
    }

    enum ProtocolType {
        SECURE_AGGREGATION,
        GARBLED_CIRCUITS,
        SECRET_SHARING,
        HOMOMORPHIC
    }

    enum ParticipantStatus {
        INVITED,
        ENROLLED,
        DATA_SUBMITTED,
        COMPLETED,
        WITHDRAWN
    }

    // ────────────────────────────────────────────────────────
    // Structs
    // ────────────────────────────────────────────────────────

    struct MPCSession {
        bytes32 sessionId;
        address organizer;
        string name;
        string description;
        ProtocolType protocol;
        bytes32 queryHash;
        SessionStatus status;
        uint256 minParticipants;
        uint256 maxParticipants;
        uint256 currentParticipants;
        uint256 privacyBudgetTotal;
        uint256 privacyBudgetUsed;
        bytes32 resultHash;
        bytes32 teeAttestationHash;
        uint256 createdAt;
        uint256 completedAt;
    }

    struct Participant {
        address addr;
        bytes32 dataCommitment;
        bytes32 teeAttestationHash;
        ParticipantStatus status;
        uint256 enrolledAt;
        uint256 dataSubmittedAt;
        uint256 rewardAmount;
    }

    struct MPCResult {
        bytes32 resultId;
        bytes32 sessionId;
        bytes32 aggregatedHash;
        bytes32 teeAttestationHash;
        uint256 participantCount;
        uint256 privacyBudgetConsumed;
        uint256 noiseLevel;
        uint256 completedAt;
    }

    // ────────────────────────────────────────────────────────
    // State
    // ────────────────────────────────────────────────────────

    mapping(bytes32 => MPCSession) private _sessions;
    mapping(bytes32 => mapping(address => Participant)) private _participants;
    mapping(bytes32 => address[]) private _sessionParticipantAddresses;
    mapping(bytes32 => MPCResult) private _results;
    mapping(address => bytes32[]) private _organizerSessions;

    bytes32[] private _allSessionIds;
    uint256 public totalSessions;
    uint256 public totalCompletedSessions;
    uint256 private _nonce;

    uint256 public constant MIN_PARTICIPANTS = 3;
    uint256 public constant MAX_PARTICIPANTS = 100;
    uint256 public constant MAX_PRIVACY_BUDGET = 10000;

    // ────────────────────────────────────────────────────────
    // Events
    // ────────────────────────────────────────────────────────

    event SessionCreated(
        bytes32 indexed sessionId,
        address indexed organizer,
        string name,
        ProtocolType protocol,
        uint256 minParticipants
    );

    event SessionStatusChanged(
        bytes32 indexed sessionId,
        SessionStatus newStatus
    );

    event ParticipantEnrolled(
        bytes32 indexed sessionId,
        address indexed participant,
        bytes32 teeAttestationHash
    );

    event DataSubmitted(
        bytes32 indexed sessionId,
        address indexed participant,
        bytes32 dataCommitment
    );

    event ParticipantWithdrawn(
        bytes32 indexed sessionId,
        address indexed participant
    );

    event ResultCommitted(
        bytes32 indexed resultId,
        bytes32 indexed sessionId,
        uint256 participantCount,
        uint256 privacyBudgetConsumed,
        bytes32 teeAttestationHash
    );

    // ────────────────────────────────────────────────────────
    // Errors
    // ────────────────────────────────────────────────────────

    error SessionNotFound();
    error NotSessionOrganizer();
    error InvalidParticipantCount();
    error InvalidPrivacyBudget();
    error SessionNotInStatus(SessionStatus expected);
    error AlreadyEnrolled();
    error NotEnrolled();
    error SessionFull();
    error InsufficientParticipants();
    error DataAlreadySubmitted();
    error AlreadyWithdrawn();
    error InvalidHash();
    error PrivacyBudgetExceeded();
    error EmptyName();

    // ────────────────────────────────────────────────────────
    // Modifiers
    // ────────────────────────────────────────────────────────

    modifier onlyOrganizer(bytes32 sessionId) {
        if (_sessions[sessionId].organizer == address(0)) revert SessionNotFound();
        if (_sessions[sessionId].organizer != msg.sender) revert NotSessionOrganizer();
        _;
    }

    modifier inStatus(bytes32 sessionId, SessionStatus expected) {
        if (_sessions[sessionId].status != expected) revert SessionNotInStatus(expected);
        _;
    }

    // ────────────────────────────────────────────────────────
    // Constructor
    // ────────────────────────────────────────────────────────

    constructor() Ownable(msg.sender) {}

    // ────────────────────────────────────────────────────────
    // External Functions — Session Management
    // ────────────────────────────────────────────────────────

    /**
     * @notice Create a new MPC session.
     * @param name Session name
     * @param description Session description
     * @param protocol MPC protocol type
     * @param queryHash Hash of the computation query
     * @param minParticipants Minimum participants required
     * @param maxParticipants Maximum participants allowed
     * @param privacyBudget Total differential privacy budget (epsilon * 1000)
     * @return sessionId Unique identifier for the session
     */
    function createSession(
        string calldata name,
        string calldata description,
        ProtocolType protocol,
        bytes32 queryHash,
        uint256 minParticipants,
        uint256 maxParticipants,
        uint256 privacyBudget
    ) external nonReentrant whenNotPaused returns (bytes32 sessionId) {
        if (bytes(name).length == 0) revert EmptyName();
        if (queryHash == bytes32(0)) revert InvalidHash();
        if (minParticipants < MIN_PARTICIPANTS || maxParticipants > MAX_PARTICIPANTS) {
            revert InvalidParticipantCount();
        }
        if (minParticipants > maxParticipants) revert InvalidParticipantCount();
        if (privacyBudget == 0 || privacyBudget > MAX_PRIVACY_BUDGET) {
            revert InvalidPrivacyBudget();
        }

        _nonce++;
        sessionId = keccak256(
            abi.encodePacked(msg.sender, name, block.timestamp, _nonce)
        );

        _sessions[sessionId] = MPCSession({
            sessionId: sessionId,
            organizer: msg.sender,
            name: name,
            description: description,
            protocol: protocol,
            queryHash: queryHash,
            status: SessionStatus.ENROLLING,
            minParticipants: minParticipants,
            maxParticipants: maxParticipants,
            currentParticipants: 0,
            privacyBudgetTotal: privacyBudget,
            privacyBudgetUsed: 0,
            resultHash: bytes32(0),
            teeAttestationHash: bytes32(0),
            createdAt: block.timestamp,
            completedAt: 0
        });

        _allSessionIds.push(sessionId);
        _organizerSessions[msg.sender].push(sessionId);
        totalSessions++;

        emit SessionCreated(sessionId, msg.sender, name, protocol, minParticipants);
    }

    /**
     * @notice Advance session to computing phase (organizer only).
     */
    function startComputation(
        bytes32 sessionId
    ) external onlyOrganizer(sessionId) inStatus(sessionId, SessionStatus.ENROLLING) {
        MPCSession storage session = _sessions[sessionId];
        if (session.currentParticipants < session.minParticipants) {
            revert InsufficientParticipants();
        }

        session.status = SessionStatus.COMPUTING;
        emit SessionStatusChanged(sessionId, SessionStatus.COMPUTING);
    }

    /**
     * @notice Cancel a session (organizer only, before completion).
     */
    function cancelSession(
        bytes32 sessionId
    ) external onlyOrganizer(sessionId) {
        MPCSession storage session = _sessions[sessionId];
        require(
            session.status != SessionStatus.COMPLETED &&
            session.status != SessionStatus.CANCELLED,
            "Cannot cancel"
        );

        session.status = SessionStatus.CANCELLED;
        emit SessionStatusChanged(sessionId, SessionStatus.CANCELLED);
    }

    // ────────────────────────────────────────────────────────
    // External Functions — Participant Management
    // ────────────────────────────────────────────────────────

    /**
     * @notice Enroll in an MPC session.
     * @param sessionId The session to join
     * @param teeAttestationHash TEE attestation proving secure enrollment
     */
    function enroll(
        bytes32 sessionId,
        bytes32 teeAttestationHash
    ) external nonReentrant inStatus(sessionId, SessionStatus.ENROLLING) {
        MPCSession storage session = _sessions[sessionId];
        if (session.currentParticipants >= session.maxParticipants) revert SessionFull();

        Participant storage p = _participants[sessionId][msg.sender];
        if (p.status == ParticipantStatus.ENROLLED || p.status == ParticipantStatus.DATA_SUBMITTED) {
            revert AlreadyEnrolled();
        }

        _participants[sessionId][msg.sender] = Participant({
            addr: msg.sender,
            dataCommitment: bytes32(0),
            teeAttestationHash: teeAttestationHash,
            status: ParticipantStatus.ENROLLED,
            enrolledAt: block.timestamp,
            dataSubmittedAt: 0,
            rewardAmount: 0
        });

        _sessionParticipantAddresses[sessionId].push(msg.sender);
        session.currentParticipants++;

        emit ParticipantEnrolled(sessionId, msg.sender, teeAttestationHash);
    }

    /**
     * @notice Submit encrypted data commitment for computation.
     * @param sessionId The session
     * @param dataCommitment Hash commitment of the participant's encrypted data
     */
    function submitData(
        bytes32 sessionId,
        bytes32 dataCommitment
    ) external nonReentrant inStatus(sessionId, SessionStatus.COMPUTING) {
        Participant storage p = _participants[sessionId][msg.sender];
        if (p.status != ParticipantStatus.ENROLLED) revert NotEnrolled();
        if (dataCommitment == bytes32(0)) revert InvalidHash();

        p.dataCommitment = dataCommitment;
        p.status = ParticipantStatus.DATA_SUBMITTED;
        p.dataSubmittedAt = block.timestamp;

        emit DataSubmitted(sessionId, msg.sender, dataCommitment);
    }

    /**
     * @notice Withdraw from a session (only during enrollment).
     */
    function withdraw(
        bytes32 sessionId
    ) external inStatus(sessionId, SessionStatus.ENROLLING) {
        Participant storage p = _participants[sessionId][msg.sender];
        if (p.status == ParticipantStatus.WITHDRAWN) revert AlreadyWithdrawn();
        if (p.addr == address(0)) revert NotEnrolled();

        p.status = ParticipantStatus.WITHDRAWN;
        _sessions[sessionId].currentParticipants--;

        emit ParticipantWithdrawn(sessionId, msg.sender);
    }

    // ────────────────────────────────────────────────────────
    // External Functions — Result Commitment
    // ────────────────────────────────────────────────────────

    /**
     * @notice Commit the aggregated result of an MPC session (TEE oracle / admin only).
     * @param sessionId The session being completed
     * @param aggregatedHash Hash of the aggregated result
     * @param teeAttestationHash TEE attestation for the aggregation
     * @param privacyBudgetConsumed Privacy budget consumed by the computation
     * @param noiseLevel Differential privacy noise level applied
     * @return resultId Unique identifier for the result
     */
    function commitResult(
        bytes32 sessionId,
        bytes32 aggregatedHash,
        bytes32 teeAttestationHash,
        uint256 privacyBudgetConsumed,
        uint256 noiseLevel
    ) external nonReentrant onlyOwner returns (bytes32 resultId) {
        MPCSession storage session = _sessions[sessionId];
        if (session.organizer == address(0)) revert SessionNotFound();
        if (aggregatedHash == bytes32(0)) revert InvalidHash();
        if (session.privacyBudgetUsed + privacyBudgetConsumed > session.privacyBudgetTotal) {
            revert PrivacyBudgetExceeded();
        }

        _nonce++;
        resultId = keccak256(
            abi.encodePacked(sessionId, "result", block.timestamp, _nonce)
        );

        _results[resultId] = MPCResult({
            resultId: resultId,
            sessionId: sessionId,
            aggregatedHash: aggregatedHash,
            teeAttestationHash: teeAttestationHash,
            participantCount: session.currentParticipants,
            privacyBudgetConsumed: privacyBudgetConsumed,
            noiseLevel: noiseLevel,
            completedAt: block.timestamp
        });

        session.resultHash = aggregatedHash;
        session.teeAttestationHash = teeAttestationHash;
        session.privacyBudgetUsed += privacyBudgetConsumed;
        session.status = SessionStatus.COMPLETED;
        session.completedAt = block.timestamp;

        totalCompletedSessions++;

        emit ResultCommitted(
            resultId, sessionId, session.currentParticipants, privacyBudgetConsumed, teeAttestationHash
        );
        emit SessionStatusChanged(sessionId, SessionStatus.COMPLETED);
    }

    // ────────────────────────────────────────────────────────
    // View Functions
    // ────────────────────────────────────────────────────────

    function getSession(bytes32 sessionId) external view returns (MPCSession memory) {
        if (_sessions[sessionId].organizer == address(0)) revert SessionNotFound();
        return _sessions[sessionId];
    }

    function getParticipant(
        bytes32 sessionId,
        address addr
    ) external view returns (Participant memory) {
        return _participants[sessionId][addr];
    }

    function getSessionParticipants(bytes32 sessionId) external view returns (address[] memory) {
        return _sessionParticipantAddresses[sessionId];
    }

    function getResult(bytes32 resultId) external view returns (MPCResult memory) {
        return _results[resultId];
    }

    function getOrganizerSessions(address organizer) external view returns (bytes32[] memory) {
        return _organizerSessions[organizer];
    }

    function getAllSessionIds() external view returns (bytes32[] memory) {
        return _allSessionIds;
    }

    function getRemainingPrivacyBudget(bytes32 sessionId) external view returns (uint256) {
        MPCSession storage session = _sessions[sessionId];
        return session.privacyBudgetTotal - session.privacyBudgetUsed;
    }

    // ────────────────────────────────────────────────────────
    // Admin Functions
    // ────────────────────────────────────────────────────────

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
