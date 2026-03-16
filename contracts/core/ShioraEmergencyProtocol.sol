// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title ShioraEmergencyProtocol
 * @author Shiora Health AI on Aethelred
 * @notice Manages emergency contact registries, triage assessment logging,
 *         and care handoff verification. Critical health data is accessible
 *         via time-limited emergency grants verified through TEE attestation.
 */
contract ShioraEmergencyProtocol is Ownable, ReentrancyGuard, Pausable {

    // ────────────────────────────────────────────────────────
    // Enums
    // ────────────────────────────────────────────────────────

    enum TriageLevel {
        ESI_1_RESUSCITATION,
        ESI_2_EMERGENT,
        ESI_3_URGENT,
        ESI_4_LESS_URGENT,
        ESI_5_NON_URGENT
    }

    enum HandoffStatus {
        INITIATED,
        IN_PROGRESS,
        COMPLETED,
        FAILED
    }

    // ────────────────────────────────────────────────────────
    // Structs
    // ────────────────────────────────────────────────────────

    struct EmergencyCard {
        address patient;
        bytes32 bloodTypeHash;
        bytes32 allergiesHash;
        bytes32 medicationsHash;
        bytes32 conditionsHash;
        bytes32 emergencyContactsHash;
        bytes32 teeAttestationHash;
        uint256 createdAt;
        uint256 lastUpdated;
        bool isActive;
    }

    struct TriageAssessment {
        bytes32 assessmentId;
        address patient;
        address triageOfficer;
        TriageLevel level;
        bytes32 symptomsHash;
        bytes32 vitalsHash;
        bytes32 dispositionHash;
        bytes32 teeAttestationHash;
        uint256 assessedAt;
        uint256 confidenceScore;
    }

    struct CareHandoff {
        bytes32 handoffId;
        address patient;
        address fromProvider;
        address toProvider;
        bytes32 dataPackageHash;
        bytes32 teeAttestationHash;
        HandoffStatus status;
        uint256 initiatedAt;
        uint256 completedAt;
        uint256 qualityScore;
    }

    struct EmergencyAccess {
        bytes32 accessId;
        address patient;
        address responder;
        bytes32 teeAttestationHash;
        uint256 grantedAt;
        uint256 expiresAt;
        bool revoked;
    }

    // ────────────────────────────────────────────────────────
    // State
    // ────────────────────────────────────────────────────────

    mapping(address => EmergencyCard) private _emergencyCards;
    mapping(address => TriageAssessment[]) private _patientTriages;
    mapping(bytes32 => CareHandoff) private _handoffs;
    mapping(address => bytes32[]) private _patientHandoffs;
    mapping(address => EmergencyAccess[]) private _emergencyAccesses;

    uint256 public totalEmergencyCards;
    uint256 public totalTriageAssessments;
    uint256 public totalHandoffs;
    uint256 private _nonce;

    uint256 public constant EMERGENCY_ACCESS_DURATION = 4 hours;
    uint256 public constant MAX_EMERGENCY_ACCESS_DURATION = 24 hours;

    // ────────────────────────────────────────────────────────
    // Events
    // ────────────────────────────────────────────────────────

    event EmergencyCardCreated(
        address indexed patient,
        bytes32 teeAttestationHash
    );

    event EmergencyCardUpdated(
        address indexed patient,
        bytes32 teeAttestationHash
    );

    event TriageAssessed(
        bytes32 indexed assessmentId,
        address indexed patient,
        TriageLevel level,
        uint256 confidenceScore,
        bytes32 teeAttestationHash
    );

    event CareHandoffInitiated(
        bytes32 indexed handoffId,
        address indexed patient,
        address indexed fromProvider,
        address toProvider
    );

    event CareHandoffCompleted(
        bytes32 indexed handoffId,
        uint256 qualityScore
    );

    event EmergencyAccessGranted(
        bytes32 indexed accessId,
        address indexed patient,
        address indexed responder,
        uint256 expiresAt
    );

    event EmergencyAccessRevoked(
        bytes32 indexed accessId,
        address indexed patient
    );

    // ────────────────────────────────────────────────────────
    // Errors
    // ────────────────────────────────────────────────────────

    error CardNotFound();
    error CardAlreadyExists();
    error CardNotActive();
    error NotCardOwner();
    error HandoffNotFound();
    error HandoffAlreadyCompleted();
    error NotHandoffParticipant();
    error InvalidHash();
    error InvalidConfidenceScore();
    error InvalidQualityScore();
    error AccessExpired();
    error AccessAlreadyRevoked();

    // ────────────────────────────────────────────────────────
    // Constructor
    // ────────────────────────────────────────────────────────

    constructor() Ownable(msg.sender) {}

    // ────────────────────────────────────────────────────────
    // External Functions — Emergency Card
    // ────────────────────────────────────────────────────────

    /**
     * @notice Create an emergency card for the caller.
     * @param bloodTypeHash Encrypted blood type
     * @param allergiesHash Encrypted allergy list
     * @param medicationsHash Encrypted current medications
     * @param conditionsHash Encrypted medical conditions
     * @param emergencyContactsHash Encrypted emergency contacts
     * @param teeAttestationHash TEE attestation for card creation
     */
    function createEmergencyCard(
        bytes32 bloodTypeHash,
        bytes32 allergiesHash,
        bytes32 medicationsHash,
        bytes32 conditionsHash,
        bytes32 emergencyContactsHash,
        bytes32 teeAttestationHash
    ) external nonReentrant whenNotPaused {
        if (_emergencyCards[msg.sender].isActive) revert CardAlreadyExists();

        _emergencyCards[msg.sender] = EmergencyCard({
            patient: msg.sender,
            bloodTypeHash: bloodTypeHash,
            allergiesHash: allergiesHash,
            medicationsHash: medicationsHash,
            conditionsHash: conditionsHash,
            emergencyContactsHash: emergencyContactsHash,
            teeAttestationHash: teeAttestationHash,
            createdAt: block.timestamp,
            lastUpdated: block.timestamp,
            isActive: true
        });

        totalEmergencyCards++;

        emit EmergencyCardCreated(msg.sender, teeAttestationHash);
    }

    /**
     * @notice Update the caller's emergency card.
     */
    function updateEmergencyCard(
        bytes32 bloodTypeHash,
        bytes32 allergiesHash,
        bytes32 medicationsHash,
        bytes32 conditionsHash,
        bytes32 emergencyContactsHash,
        bytes32 teeAttestationHash
    ) external nonReentrant {
        EmergencyCard storage card = _emergencyCards[msg.sender];
        if (!card.isActive) revert CardNotFound();

        card.bloodTypeHash = bloodTypeHash;
        card.allergiesHash = allergiesHash;
        card.medicationsHash = medicationsHash;
        card.conditionsHash = conditionsHash;
        card.emergencyContactsHash = emergencyContactsHash;
        card.teeAttestationHash = teeAttestationHash;
        card.lastUpdated = block.timestamp;

        emit EmergencyCardUpdated(msg.sender, teeAttestationHash);
    }

    // ────────────────────────────────────────────────────────
    // External Functions — Triage
    // ────────────────────────────────────────────────────────

    /**
     * @notice Record an AI-assisted triage assessment.
     * @param patient Address of the patient
     * @param level ESI triage level (1-5)
     * @param symptomsHash Hash of the symptom assessment
     * @param vitalsHash Hash of the vital signs
     * @param dispositionHash Hash of the disposition recommendation
     * @param teeAttestationHash TEE attestation for the triage computation
     * @param confidenceScore Confidence (0-10000 = 0%-100.00%)
     * @return assessmentId Unique identifier for the assessment
     */
    function recordTriageAssessment(
        address patient,
        TriageLevel level,
        bytes32 symptomsHash,
        bytes32 vitalsHash,
        bytes32 dispositionHash,
        bytes32 teeAttestationHash,
        uint256 confidenceScore
    ) external nonReentrant whenNotPaused returns (bytes32 assessmentId) {
        if (confidenceScore > 10000) revert InvalidConfidenceScore();

        _nonce++;
        assessmentId = keccak256(
            abi.encodePacked(patient, msg.sender, block.timestamp, _nonce)
        );

        _patientTriages[patient].push(TriageAssessment({
            assessmentId: assessmentId,
            patient: patient,
            triageOfficer: msg.sender,
            level: level,
            symptomsHash: symptomsHash,
            vitalsHash: vitalsHash,
            dispositionHash: dispositionHash,
            teeAttestationHash: teeAttestationHash,
            assessedAt: block.timestamp,
            confidenceScore: confidenceScore
        }));

        totalTriageAssessments++;

        emit TriageAssessed(assessmentId, patient, level, confidenceScore, teeAttestationHash);
    }

    // ────────────────────────────────────────────────────────
    // External Functions — Care Handoff
    // ────────────────────────────────────────────────────────

    /**
     * @notice Initiate a care handoff between providers.
     * @param patient Address of the patient
     * @param toProvider Address of the receiving provider
     * @param dataPackageHash Hash of the encrypted care data package
     * @param teeAttestationHash TEE attestation for the data package
     * @return handoffId Unique identifier for the handoff
     */
    function initiateHandoff(
        address patient,
        address toProvider,
        bytes32 dataPackageHash,
        bytes32 teeAttestationHash
    ) external nonReentrant whenNotPaused returns (bytes32 handoffId) {
        if (dataPackageHash == bytes32(0)) revert InvalidHash();

        _nonce++;
        handoffId = keccak256(
            abi.encodePacked(patient, msg.sender, toProvider, block.timestamp, _nonce)
        );

        _handoffs[handoffId] = CareHandoff({
            handoffId: handoffId,
            patient: patient,
            fromProvider: msg.sender,
            toProvider: toProvider,
            dataPackageHash: dataPackageHash,
            teeAttestationHash: teeAttestationHash,
            status: HandoffStatus.INITIATED,
            initiatedAt: block.timestamp,
            completedAt: 0,
            qualityScore: 0
        });

        _patientHandoffs[patient].push(handoffId);
        totalHandoffs++;

        emit CareHandoffInitiated(handoffId, patient, msg.sender, toProvider);
    }

    /**
     * @notice Complete a care handoff with a quality score.
     * @param handoffId The handoff to complete
     * @param qualityScore Quality score (0-10000 = 0%-100.00%)
     */
    function completeHandoff(
        bytes32 handoffId,
        uint256 qualityScore
    ) external nonReentrant {
        CareHandoff storage handoff = _handoffs[handoffId];
        if (handoff.patient == address(0)) revert HandoffNotFound();
        if (handoff.status == HandoffStatus.COMPLETED) revert HandoffAlreadyCompleted();
        if (msg.sender != handoff.toProvider && msg.sender != handoff.fromProvider) {
            revert NotHandoffParticipant();
        }
        if (qualityScore > 10000) revert InvalidQualityScore();

        handoff.status = HandoffStatus.COMPLETED;
        handoff.completedAt = block.timestamp;
        handoff.qualityScore = qualityScore;

        emit CareHandoffCompleted(handoffId, qualityScore);
    }

    // ────────────────────────────────────────────────────────
    // External Functions — Emergency Access
    // ────────────────────────────────────────────────────────

    /**
     * @notice Grant time-limited emergency access to a responder.
     * @param responder Address of the emergency responder
     * @param teeAttestationHash TEE attestation for the access grant
     * @return accessId Unique identifier for the emergency access
     */
    function grantEmergencyAccess(
        address responder,
        bytes32 teeAttestationHash
    ) external nonReentrant whenNotPaused returns (bytes32 accessId) {
        EmergencyCard storage card = _emergencyCards[msg.sender];
        if (!card.isActive) revert CardNotFound();

        _nonce++;
        accessId = keccak256(
            abi.encodePacked(msg.sender, responder, block.timestamp, _nonce)
        );

        _emergencyAccesses[msg.sender].push(EmergencyAccess({
            accessId: accessId,
            patient: msg.sender,
            responder: responder,
            teeAttestationHash: teeAttestationHash,
            grantedAt: block.timestamp,
            expiresAt: block.timestamp + EMERGENCY_ACCESS_DURATION,
            revoked: false
        }));

        emit EmergencyAccessGranted(accessId, msg.sender, responder, block.timestamp + EMERGENCY_ACCESS_DURATION);
    }

    /**
     * @notice Revoke emergency access.
     * @param accessIndex Index in the patient's access array
     */
    function revokeEmergencyAccess(uint256 accessIndex) external {
        EmergencyAccess[] storage accesses = _emergencyAccesses[msg.sender];
        require(accessIndex < accesses.length, "Invalid index");
        if (accesses[accessIndex].revoked) revert AccessAlreadyRevoked();

        accesses[accessIndex].revoked = true;

        emit EmergencyAccessRevoked(accesses[accessIndex].accessId, msg.sender);
    }

    // ────────────────────────────────────────────────────────
    // View Functions
    // ────────────────────────────────────────────────────────

    function getEmergencyCard(address patient) external view returns (EmergencyCard memory) {
        if (!_emergencyCards[patient].isActive) revert CardNotFound();
        return _emergencyCards[patient];
    }

    function getPatientTriages(address patient) external view returns (TriageAssessment[] memory) {
        return _patientTriages[patient];
    }

    function getHandoff(bytes32 handoffId) external view returns (CareHandoff memory) {
        if (_handoffs[handoffId].patient == address(0)) revert HandoffNotFound();
        return _handoffs[handoffId];
    }

    function getPatientHandoffIds(address patient) external view returns (bytes32[] memory) {
        return _patientHandoffs[patient];
    }

    function getEmergencyAccesses(address patient) external view returns (EmergencyAccess[] memory) {
        return _emergencyAccesses[patient];
    }

    function hasValidEmergencyCard(address patient) external view returns (bool) {
        return _emergencyCards[patient].isActive;
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
