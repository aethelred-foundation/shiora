// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title ShioraClinicalPathway
 * @author Shiora Health AI on Aethelred
 * @notice Immutable on-chain registry for clinical decision support guidelines,
 *         drug interaction checks, and differential diagnosis audit trails.
 *         Every clinical AI decision is TEE-attested and version-tracked.
 */
contract ShioraClinicalPathway is Ownable, ReentrancyGuard, Pausable {

    // ────────────────────────────────────────────────────────
    // Enums
    // ────────────────────────────────────────────────────────

    enum PathwayStatus {
        DRAFT,
        ACTIVE,
        DEPRECATED,
        SUPERSEDED
    }

    enum DecisionSeverity {
        LOW,
        MODERATE,
        HIGH,
        CRITICAL
    }

    // ────────────────────────────────────────────────────────
    // Structs
    // ────────────────────────────────────────────────────────

    struct ClinicalPathway {
        bytes32 pathwayId;
        address publisher;
        string name;
        string condition;
        uint256 version;
        bytes32 guidelineHash;
        bytes32 teeAttestationHash;
        uint256 publishedAt;
        uint256 stepsCount;
        PathwayStatus status;
    }

    struct PathwayStep {
        uint256 stepIndex;
        string action;
        bytes32 criteriaHash;
        bytes32 teeAttestationHash;
    }

    struct DecisionAuditEntry {
        bytes32 entryId;
        bytes32 pathwayId;
        address patient;
        address clinician;
        uint256 stepIndex;
        bytes32 inputHash;
        bytes32 outputHash;
        bytes32 teeAttestationHash;
        DecisionSeverity severity;
        uint256 confidenceScore;
        uint256 timestamp;
    }

    struct DrugInteractionRecord {
        bytes32 recordId;
        address patient;
        bytes32 drug1Hash;
        bytes32 drug2Hash;
        DecisionSeverity severity;
        bytes32 mechanismHash;
        bytes32 recommendationHash;
        bytes32 teeAttestationHash;
        uint256 checkedAt;
    }

    // ────────────────────────────────────────────────────────
    // State
    // ────────────────────────────────────────────────────────

    mapping(bytes32 => ClinicalPathway) private _pathways;
    mapping(bytes32 => PathwayStep[]) private _pathwaySteps;
    mapping(bytes32 => DecisionAuditEntry[]) private _pathwayAudits;
    mapping(address => bytes32[]) private _patientAudits;
    mapping(address => DrugInteractionRecord[]) private _patientInteractions;

    bytes32[] private _allPathwayIds;
    uint256 public totalPathways;
    uint256 public totalDecisions;
    uint256 public totalInteractionChecks;
    uint256 private _nonce;

    // ────────────────────────────────────────────────────────
    // Events
    // ────────────────────────────────────────────────────────

    event PathwayPublished(
        bytes32 indexed pathwayId,
        address indexed publisher,
        string name,
        string condition,
        uint256 version
    );

    event PathwayStatusChanged(
        bytes32 indexed pathwayId,
        PathwayStatus newStatus
    );

    event DecisionRecorded(
        bytes32 indexed entryId,
        bytes32 indexed pathwayId,
        address indexed patient,
        DecisionSeverity severity,
        uint256 confidenceScore,
        bytes32 teeAttestationHash
    );

    event DrugInteractionChecked(
        bytes32 indexed recordId,
        address indexed patient,
        DecisionSeverity severity,
        bytes32 teeAttestationHash
    );

    // ────────────────────────────────────────────────────────
    // Errors
    // ────────────────────────────────────────────────────────

    error PathwayNotFound();
    error NotPathwayPublisher();
    error PathwayNotActive();
    error InvalidStepIndex();
    error InvalidHash();
    error InvalidConfidenceScore();
    error EmptyName();
    error EmptyCondition();
    error NoStepsProvided();

    // ────────────────────────────────────────────────────────
    // Constructor
    // ────────────────────────────────────────────────────────

    constructor() Ownable(msg.sender) {}

    // ────────────────────────────────────────────────────────
    // External Functions
    // ────────────────────────────────────────────────────────

    /**
     * @notice Publish a new clinical pathway with its guideline steps.
     * @param name Name of the pathway (e.g. "Type 2 Diabetes Management")
     * @param condition Target condition (e.g. "Diabetes Mellitus Type 2")
     * @param guidelineHash Hash of the full guideline document
     * @param teeAttestationHash TEE attestation for the guideline validation
     * @param stepActions Array of step action descriptions
     * @param stepCriteriaHashes Array of hashes for each step's criteria
     * @param stepAttestationHashes Array of TEE attestation hashes per step
     * @return pathwayId Unique identifier for the pathway
     */
    function publishPathway(
        string calldata name,
        string calldata condition,
        bytes32 guidelineHash,
        bytes32 teeAttestationHash,
        string[] calldata stepActions,
        bytes32[] calldata stepCriteriaHashes,
        bytes32[] calldata stepAttestationHashes
    ) external nonReentrant whenNotPaused returns (bytes32 pathwayId) {
        if (bytes(name).length == 0) revert EmptyName();
        if (bytes(condition).length == 0) revert EmptyCondition();
        if (guidelineHash == bytes32(0)) revert InvalidHash();
        if (stepActions.length == 0) revert NoStepsProvided();
        require(
            stepActions.length == stepCriteriaHashes.length &&
            stepActions.length == stepAttestationHashes.length,
            "Array length mismatch"
        );

        _nonce++;
        pathwayId = keccak256(
            abi.encodePacked(msg.sender, name, block.timestamp, _nonce)
        );

        _pathways[pathwayId] = ClinicalPathway({
            pathwayId: pathwayId,
            publisher: msg.sender,
            name: name,
            condition: condition,
            version: 1,
            guidelineHash: guidelineHash,
            teeAttestationHash: teeAttestationHash,
            publishedAt: block.timestamp,
            stepsCount: stepActions.length,
            status: PathwayStatus.ACTIVE
        });

        for (uint256 i = 0; i < stepActions.length; i++) {
            _pathwaySteps[pathwayId].push(PathwayStep({
                stepIndex: i,
                action: stepActions[i],
                criteriaHash: stepCriteriaHashes[i],
                teeAttestationHash: stepAttestationHashes[i]
            }));
        }

        _allPathwayIds.push(pathwayId);
        totalPathways++;

        emit PathwayPublished(pathwayId, msg.sender, name, condition, 1);
    }

    /**
     * @notice Record a clinical decision made along a pathway step.
     * @param pathwayId The pathway being followed
     * @param patient Address of the patient
     * @param stepIndex Which step in the pathway
     * @param inputHash Hash of the clinical inputs
     * @param outputHash Hash of the AI recommendation
     * @param teeAttestationHash TEE attestation for the decision computation
     * @param severity Severity classification
     * @param confidenceScore Confidence (0-10000 = 0%-100.00%)
     * @return entryId Unique identifier for the audit entry
     */
    function recordDecision(
        bytes32 pathwayId,
        address patient,
        uint256 stepIndex,
        bytes32 inputHash,
        bytes32 outputHash,
        bytes32 teeAttestationHash,
        DecisionSeverity severity,
        uint256 confidenceScore
    ) external nonReentrant whenNotPaused returns (bytes32 entryId) {
        ClinicalPathway storage pathway = _pathways[pathwayId];
        if (pathway.publisher == address(0)) revert PathwayNotFound();
        if (pathway.status != PathwayStatus.ACTIVE) revert PathwayNotActive();
        if (stepIndex >= pathway.stepsCount) revert InvalidStepIndex();
        if (confidenceScore > 10000) revert InvalidConfidenceScore();

        _nonce++;
        entryId = keccak256(
            abi.encodePacked(pathwayId, patient, block.timestamp, _nonce)
        );

        DecisionAuditEntry memory entry = DecisionAuditEntry({
            entryId: entryId,
            pathwayId: pathwayId,
            patient: patient,
            clinician: msg.sender,
            stepIndex: stepIndex,
            inputHash: inputHash,
            outputHash: outputHash,
            teeAttestationHash: teeAttestationHash,
            severity: severity,
            confidenceScore: confidenceScore,
            timestamp: block.timestamp
        });

        _pathwayAudits[pathwayId].push(entry);
        _patientAudits[patient].push(entryId);
        totalDecisions++;

        emit DecisionRecorded(
            entryId, pathwayId, patient, severity, confidenceScore, teeAttestationHash
        );
    }

    /**
     * @notice Record a drug interaction check result.
     * @param patient Address of the patient
     * @param drug1Hash Hash of the first drug
     * @param drug2Hash Hash of the second drug
     * @param severity Interaction severity
     * @param mechanismHash Hash of the interaction mechanism description
     * @param recommendationHash Hash of the clinical recommendation
     * @param teeAttestationHash TEE attestation for the check computation
     * @return recordId Unique identifier for the interaction record
     */
    function recordDrugInteraction(
        address patient,
        bytes32 drug1Hash,
        bytes32 drug2Hash,
        DecisionSeverity severity,
        bytes32 mechanismHash,
        bytes32 recommendationHash,
        bytes32 teeAttestationHash
    ) external nonReentrant whenNotPaused returns (bytes32 recordId) {
        if (drug1Hash == bytes32(0) || drug2Hash == bytes32(0)) revert InvalidHash();

        _nonce++;
        recordId = keccak256(
            abi.encodePacked(patient, drug1Hash, drug2Hash, block.timestamp, _nonce)
        );

        _patientInteractions[patient].push(DrugInteractionRecord({
            recordId: recordId,
            patient: patient,
            drug1Hash: drug1Hash,
            drug2Hash: drug2Hash,
            severity: severity,
            mechanismHash: mechanismHash,
            recommendationHash: recommendationHash,
            teeAttestationHash: teeAttestationHash,
            checkedAt: block.timestamp
        }));

        totalInteractionChecks++;

        emit DrugInteractionChecked(recordId, patient, severity, teeAttestationHash);
    }

    /**
     * @notice Change the status of a clinical pathway.
     */
    function setPathwayStatus(
        bytes32 pathwayId,
        PathwayStatus newStatus
    ) external {
        ClinicalPathway storage pathway = _pathways[pathwayId];
        if (pathway.publisher == address(0)) revert PathwayNotFound();
        if (pathway.publisher != msg.sender && msg.sender != owner()) revert NotPathwayPublisher();

        pathway.status = newStatus;

        emit PathwayStatusChanged(pathwayId, newStatus);
    }

    // ────────────────────────────────────────────────────────
    // View Functions
    // ────────────────────────────────────────────────────────

    function getPathway(bytes32 pathwayId) external view returns (ClinicalPathway memory) {
        if (_pathways[pathwayId].publisher == address(0)) revert PathwayNotFound();
        return _pathways[pathwayId];
    }

    function getPathwaySteps(bytes32 pathwayId) external view returns (PathwayStep[] memory) {
        return _pathwaySteps[pathwayId];
    }

    function getPathwayAuditCount(bytes32 pathwayId) external view returns (uint256) {
        return _pathwayAudits[pathwayId].length;
    }

    function getPatientAuditIds(address patient) external view returns (bytes32[] memory) {
        return _patientAudits[patient];
    }

    function getPatientInteractions(address patient) external view returns (DrugInteractionRecord[] memory) {
        return _patientInteractions[patient];
    }

    function getAllPathwayIds() external view returns (bytes32[] memory) {
        return _allPathwayIds;
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
