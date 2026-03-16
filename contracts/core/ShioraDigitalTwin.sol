// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title ShioraDigitalTwin
 * @author Shiora Health AI on Aethelred
 * @notice Manages Digital Health Twin registration, parameter snapshots,
 *         and simulation result anchoring — all executed inside TEE enclaves
 *         and verified on-chain via Aethelred attestation proofs.
 */
contract ShioraDigitalTwin is Ownable, ReentrancyGuard, Pausable {

    // ────────────────────────────────────────────────────────
    // Enums
    // ────────────────────────────────────────────────────────

    enum TwinStatus {
        ACTIVE,
        PAUSED,
        ARCHIVED
    }

    enum SimulationStatus {
        PENDING,
        RUNNING,
        COMPLETED,
        FAILED
    }

    // ────────────────────────────────────────────────────────
    // Structs
    // ────────────────────────────────────────────────────────

    struct DigitalTwin {
        address owner;
        bytes32 twinId;
        bytes32 parameterHash;
        bytes32 modelHash;
        uint256 createdAt;
        uint256 lastUpdated;
        uint256 simulationCount;
        TwinStatus status;
        bytes32 teeAttestationHash;
    }

    struct Simulation {
        bytes32 simulationId;
        bytes32 twinId;
        address requestedBy;
        string simulationType;
        bytes32 inputHash;
        bytes32 resultHash;
        bytes32 teeAttestationHash;
        uint256 startedAt;
        uint256 completedAt;
        uint256 confidenceScore;
        SimulationStatus status;
    }

    struct ParameterSnapshot {
        bytes32 snapshotId;
        bytes32 twinId;
        bytes32 parameterHash;
        bytes32 teeAttestationHash;
        uint256 timestamp;
    }

    // ────────────────────────────────────────────────────────
    // State
    // ────────────────────────────────────────────────────────

    mapping(bytes32 => DigitalTwin) private _twins;
    mapping(address => bytes32[]) private _ownerTwins;
    mapping(bytes32 => Simulation[]) private _twinSimulations;
    mapping(bytes32 => ParameterSnapshot[]) private _twinSnapshots;
    mapping(bytes32 => Simulation) private _simulations;

    uint256 public totalTwins;
    uint256 public totalSimulations;
    uint256 private _nonce;

    uint256 public constant MAX_SIMULATIONS_PER_TWIN = 1000;

    // ────────────────────────────────────────────────────────
    // Events
    // ────────────────────────────────────────────────────────

    event TwinRegistered(
        bytes32 indexed twinId,
        address indexed owner,
        bytes32 modelHash,
        bytes32 teeAttestationHash
    );

    event TwinUpdated(
        bytes32 indexed twinId,
        bytes32 newParameterHash,
        bytes32 teeAttestationHash
    );

    event TwinStatusChanged(
        bytes32 indexed twinId,
        TwinStatus newStatus
    );

    event SimulationStarted(
        bytes32 indexed simulationId,
        bytes32 indexed twinId,
        string simulationType,
        bytes32 inputHash
    );

    event SimulationCompleted(
        bytes32 indexed simulationId,
        bytes32 indexed twinId,
        bytes32 resultHash,
        uint256 confidenceScore,
        bytes32 teeAttestationHash
    );

    event ParameterSnapshotTaken(
        bytes32 indexed snapshotId,
        bytes32 indexed twinId,
        bytes32 parameterHash,
        bytes32 teeAttestationHash
    );

    // ────────────────────────────────────────────────────────
    // Errors
    // ────────────────────────────────────────────────────────

    error TwinNotFound();
    error NotTwinOwner();
    error TwinAlreadyArchived();
    error SimulationNotFound();
    error SimulationLimitReached();
    error InvalidHash();
    error InvalidConfidenceScore();
    error SimulationNotPending();

    // ────────────────────────────────────────────────────────
    // Modifiers
    // ────────────────────────────────────────────────────────

    modifier onlyTwinOwner(bytes32 twinId) {
        if (_twins[twinId].owner == address(0)) revert TwinNotFound();
        if (_twins[twinId].owner != msg.sender) revert NotTwinOwner();
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
     * @notice Register a new Digital Health Twin.
     * @param parameterHash Hash of the initial patient parameters (encrypted in TEE)
     * @param modelHash Hash of the AI model used for simulation
     * @param teeAttestationHash TEE attestation proving twin was created in a verified enclave
     * @return twinId Unique identifier for the new twin
     */
    function registerTwin(
        bytes32 parameterHash,
        bytes32 modelHash,
        bytes32 teeAttestationHash
    ) external nonReentrant whenNotPaused returns (bytes32 twinId) {
        if (parameterHash == bytes32(0)) revert InvalidHash();
        if (modelHash == bytes32(0)) revert InvalidHash();
        if (teeAttestationHash == bytes32(0)) revert InvalidHash();

        _nonce++;
        twinId = keccak256(
            abi.encodePacked(msg.sender, block.timestamp, _nonce)
        );

        _twins[twinId] = DigitalTwin({
            owner: msg.sender,
            twinId: twinId,
            parameterHash: parameterHash,
            modelHash: modelHash,
            createdAt: block.timestamp,
            lastUpdated: block.timestamp,
            simulationCount: 0,
            status: TwinStatus.ACTIVE,
            teeAttestationHash: teeAttestationHash
        });

        _ownerTwins[msg.sender].push(twinId);
        totalTwins++;

        // Take initial parameter snapshot
        _takeSnapshot(twinId, parameterHash, teeAttestationHash);

        emit TwinRegistered(twinId, msg.sender, modelHash, teeAttestationHash);
    }

    /**
     * @notice Update twin parameters (e.g. new lab results, weight change).
     * @param twinId The twin to update
     * @param newParameterHash Hash of the updated parameters
     * @param teeAttestationHash TEE attestation for the update computation
     */
    function updateParameters(
        bytes32 twinId,
        bytes32 newParameterHash,
        bytes32 teeAttestationHash
    ) external nonReentrant onlyTwinOwner(twinId) {
        DigitalTwin storage twin = _twins[twinId];
        if (twin.status == TwinStatus.ARCHIVED) revert TwinAlreadyArchived();
        if (newParameterHash == bytes32(0)) revert InvalidHash();

        twin.parameterHash = newParameterHash;
        twin.lastUpdated = block.timestamp;

        _takeSnapshot(twinId, newParameterHash, teeAttestationHash);

        emit TwinUpdated(twinId, newParameterHash, teeAttestationHash);
    }

    /**
     * @notice Start a what-if simulation on the twin.
     * @param twinId The twin to simulate
     * @param simulationType Type of simulation (e.g. "medication_change", "exercise_plan")
     * @param inputHash Hash of the simulation input parameters
     * @return simulationId Unique identifier for the simulation
     */
    function startSimulation(
        bytes32 twinId,
        string calldata simulationType,
        bytes32 inputHash
    ) external nonReentrant onlyTwinOwner(twinId) returns (bytes32 simulationId) {
        DigitalTwin storage twin = _twins[twinId];
        if (twin.status == TwinStatus.ARCHIVED) revert TwinAlreadyArchived();
        if (twin.simulationCount >= MAX_SIMULATIONS_PER_TWIN) revert SimulationLimitReached();
        if (inputHash == bytes32(0)) revert InvalidHash();

        _nonce++;
        simulationId = keccak256(
            abi.encodePacked(twinId, block.timestamp, _nonce)
        );

        Simulation memory sim = Simulation({
            simulationId: simulationId,
            twinId: twinId,
            requestedBy: msg.sender,
            simulationType: simulationType,
            inputHash: inputHash,
            resultHash: bytes32(0),
            teeAttestationHash: bytes32(0),
            startedAt: block.timestamp,
            completedAt: 0,
            confidenceScore: 0,
            status: SimulationStatus.PENDING
        });

        _simulations[simulationId] = sim;
        _twinSimulations[twinId].push(sim);
        twin.simulationCount++;
        totalSimulations++;

        emit SimulationStarted(simulationId, twinId, simulationType, inputHash);
    }

    /**
     * @notice Record the result of a completed simulation (called by TEE oracle).
     * @param simulationId The simulation to complete
     * @param resultHash Hash of the simulation results
     * @param confidenceScore Confidence score (0-10000 = 0%-100.00%)
     * @param teeAttestationHash TEE attestation proving result integrity
     */
    function completeSimulation(
        bytes32 simulationId,
        bytes32 resultHash,
        uint256 confidenceScore,
        bytes32 teeAttestationHash
    ) external nonReentrant onlyOwner {
        Simulation storage sim = _simulations[simulationId];
        if (sim.twinId == bytes32(0)) revert SimulationNotFound();
        if (sim.status != SimulationStatus.PENDING) revert SimulationNotPending();
        if (resultHash == bytes32(0)) revert InvalidHash();
        if (confidenceScore > 10000) revert InvalidConfidenceScore();

        sim.resultHash = resultHash;
        sim.confidenceScore = confidenceScore;
        sim.teeAttestationHash = teeAttestationHash;
        sim.completedAt = block.timestamp;
        sim.status = SimulationStatus.COMPLETED;

        emit SimulationCompleted(
            simulationId, sim.twinId, resultHash, confidenceScore, teeAttestationHash
        );
    }

    /**
     * @notice Change the status of a twin (ACTIVE, PAUSED, ARCHIVED).
     * @param twinId The twin to update
     * @param newStatus The new status
     */
    function setTwinStatus(
        bytes32 twinId,
        TwinStatus newStatus
    ) external onlyTwinOwner(twinId) {
        DigitalTwin storage twin = _twins[twinId];
        if (twin.status == TwinStatus.ARCHIVED) revert TwinAlreadyArchived();

        twin.status = newStatus;
        twin.lastUpdated = block.timestamp;

        emit TwinStatusChanged(twinId, newStatus);
    }

    // ────────────────────────────────────────────────────────
    // View Functions
    // ────────────────────────────────────────────────────────

    function getTwin(bytes32 twinId) external view returns (DigitalTwin memory) {
        if (_twins[twinId].owner == address(0)) revert TwinNotFound();
        return _twins[twinId];
    }

    function getOwnerTwins(address owner) external view returns (bytes32[] memory) {
        return _ownerTwins[owner];
    }

    function getSimulation(bytes32 simulationId) external view returns (Simulation memory) {
        if (_simulations[simulationId].twinId == bytes32(0)) revert SimulationNotFound();
        return _simulations[simulationId];
    }

    function getTwinSimulationCount(bytes32 twinId) external view returns (uint256) {
        return _twinSimulations[twinId].length;
    }

    function getTwinSnapshotCount(bytes32 twinId) external view returns (uint256) {
        return _twinSnapshots[twinId].length;
    }

    // ────────────────────────────────────────────────────────
    // Internal Functions
    // ────────────────────────────────────────────────────────

    function _takeSnapshot(
        bytes32 twinId,
        bytes32 parameterHash,
        bytes32 teeAttestationHash
    ) internal {
        _nonce++;
        bytes32 snapshotId = keccak256(
            abi.encodePacked(twinId, "snapshot", block.timestamp, _nonce)
        );

        _twinSnapshots[twinId].push(ParameterSnapshot({
            snapshotId: snapshotId,
            twinId: twinId,
            parameterHash: parameterHash,
            teeAttestationHash: teeAttestationHash,
            timestamp: block.timestamp
        }));

        emit ParameterSnapshotTaken(snapshotId, twinId, parameterHash, teeAttestationHash);
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
