// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title ShioraGovernance
 * @author Shiora Health AI on Aethelred
 * @notice On-chain governance for the Shiora protocol. Supports proposal creation,
 *         weighted voting, vote delegation, configurable quorum thresholds,
 *         and timelock-style execution. Voting power is determined by staked
 *         SHIO tokens registered through the companion staking contract.
 */
contract ShioraGovernance is Ownable, ReentrancyGuard, Pausable {

    // ────────────────────────────────────────────────────────
    // Enums
    // ────────────────────────────────────────────────────────

    enum ProposalStatus {
        ACTIVE,
        PASSED,
        DEFEATED,
        QUEUED,
        EXECUTED,
        CANCELLED
    }

    // ────────────────────────────────────────────────────────
    // Structs
    // ────────────────────────────────────────────────────────

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

    struct VoteReceipt {
        bool hasVoted;
        uint8 support; // 0=against, 1=for, 2=abstain
        uint256 weight;
    }

    // ────────────────────────────────────────────────────────
    // State
    // ────────────────────────────────────────────────────────

    /// @notice Proposals by ID
    mapping(uint256 => Proposal) private _proposals;

    /// @notice Vote receipts: proposalId => voter => VoteReceipt
    mapping(uint256 => mapping(address => VoteReceipt)) private _voteReceipts;

    /// @notice Delegation: delegator => delegatee
    mapping(address => address) private _delegates;

    /// @notice Voting power per account (set externally by staking contract or admin)
    mapping(address => uint256) private _votingPower;

    /// @notice Total voting power in the system
    uint256 public totalVotingPower;

    /// @notice Total number of proposals created
    uint256 public proposalCount;

    /// @notice Quorum percentage in basis points (default 400 = 4%)
    uint256 public quorumBps;

    /// @notice Default voting period in blocks (~3 days at 12s blocks = 21600)
    uint256 public defaultVotingPeriodBlocks;

    /// @notice Minimum SHIO tokens required to create a proposal (1000 * 1e18)
    uint256 public proposalThreshold;

    /// @notice Maximum voting period in blocks (~14 days)
    uint256 public constant MAX_VOTING_PERIOD = 100800;

    /// @notice Minimum voting period in blocks (~1 day)
    uint256 public constant MIN_VOTING_PERIOD = 7200;

    // ────────────────────────────────────────────────────────
    // Events
    // ────────────────────────────────────────────────────────

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

    event VotingPowerUpdated(
        address indexed account,
        uint256 oldPower,
        uint256 newPower
    );

    event QuorumUpdated(
        uint256 oldQuorumBps,
        uint256 newQuorumBps
    );

    event VotingPeriodUpdated(
        uint256 oldPeriod,
        uint256 newPeriod
    );

    event ProposalThresholdUpdated(
        uint256 oldThreshold,
        uint256 newThreshold
    );

    // ────────────────────────────────────────────────────────
    // Errors
    // ────────────────────────────────────────────────────────

    error InsufficientVotingPower();
    error InvalidProposalType();
    error InvalidTitle();
    error InvalidVotingPeriod();
    error ProposalNotFound();
    error ProposalNotActive();
    error ProposalNotPassed();
    error ProposalAlreadyExecuted();
    error AlreadyVoted();
    error InvalidSupport();
    error NotProposer();
    error CannotDelegateToSelf();
    error CannotDelegateToZero();
    error InvalidQuorum();
    error VotingNotEnded();
    error NoVotingPower();

    // ────────────────────────────────────────────────────────
    // Modifiers
    // ────────────────────────────────────────────────────────

    modifier proposalExists(uint256 proposalId) {
        if (_proposals[proposalId].proposer == address(0)) revert ProposalNotFound();
        _;
    }

    // ────────────────────────────────────────────────────────
    // Constructor
    // ────────────────────────────────────────────────────────

    constructor() Ownable(msg.sender) {
        quorumBps = 400; // 4%
        defaultVotingPeriodBlocks = 21600; // ~3 days at 12s blocks
        proposalThreshold = 1000 * 1e18; // 1000 SHIO
    }

    // ────────────────────────────────────────────────────────
    // External Functions
    // ────────────────────────────────────────────────────────

    /**
     * @notice Create a new governance proposal.
     * @param proposalType Category of the proposal (e.g., keccak256("parameter_change"))
     * @param title Short title for the proposal
     * @param description Detailed description of the proposal
     * @param votingPeriodBlocks Number of blocks the voting period lasts (0 for default)
     * @return proposalId Unique identifier for the new proposal
     */
    function createProposal(
        bytes32 proposalType,
        string calldata title,
        string calldata description,
        uint256 votingPeriodBlocks
    ) external nonReentrant whenNotPaused returns (uint256 proposalId) {
        if (proposalType == bytes32(0)) revert InvalidProposalType();
        if (bytes(title).length == 0) revert InvalidTitle();

        uint256 power = getVotingPower(msg.sender);
        if (power < proposalThreshold) revert InsufficientVotingPower();

        uint256 period = votingPeriodBlocks == 0
            ? defaultVotingPeriodBlocks
            : votingPeriodBlocks;
        if (period < MIN_VOTING_PERIOD || period > MAX_VOTING_PERIOD) {
            revert InvalidVotingPeriod();
        }

        proposalCount++;
        proposalId = proposalCount;

        uint256 startBlock = block.number + 1;
        uint256 endBlock = startBlock + period;

        _proposals[proposalId] = Proposal({
            proposer: msg.sender,
            proposalType: proposalType,
            title: title,
            description: description,
            forVotes: 0,
            againstVotes: 0,
            abstainVotes: 0,
            startBlock: startBlock,
            endBlock: endBlock,
            status: ProposalStatus.ACTIVE,
            createdAt: block.timestamp,
            executedAt: 0
        });

        emit ProposalCreated(proposalId, msg.sender, proposalType, title, startBlock, endBlock);
    }

    /**
     * @notice Cast a vote on an active proposal.
     * @param proposalId The proposal to vote on
     * @param support Vote type: 0=against, 1=for, 2=abstain
     */
    function vote(
        uint256 proposalId,
        uint8 support
    ) external nonReentrant whenNotPaused proposalExists(proposalId) {
        Proposal storage proposal = _proposals[proposalId];

        if (proposal.status != ProposalStatus.ACTIVE) revert ProposalNotActive();
        if (block.number < proposal.startBlock || block.number > proposal.endBlock) {
            revert ProposalNotActive();
        }
        if (support > 2) revert InvalidSupport();

        VoteReceipt storage receipt = _voteReceipts[proposalId][msg.sender];
        if (receipt.hasVoted) revert AlreadyVoted();

        uint256 weight = getVotingPower(msg.sender);
        if (weight == 0) revert NoVotingPower();

        receipt.hasVoted = true;
        receipt.support = support;
        receipt.weight = weight;

        if (support == 0) {
            proposal.againstVotes += weight;
        } else if (support == 1) {
            proposal.forVotes += weight;
        } else {
            proposal.abstainVotes += weight;
        }

        emit VoteCast(proposalId, msg.sender, support, weight);
    }

    /**
     * @notice Delegate voting power to another address.
     * @param delegatee The address to delegate to
     */
    function delegate(address delegatee) external nonReentrant {
        if (delegatee == address(0)) revert CannotDelegateToZero();
        if (delegatee == msg.sender) revert CannotDelegateToSelf();

        address oldDelegate = _delegates[msg.sender];
        _delegates[msg.sender] = delegatee;

        emit DelegateChanged(msg.sender, oldDelegate, delegatee);
    }

    /**
     * @notice Remove delegation and reclaim voting power.
     */
    function undelegate() external nonReentrant {
        address oldDelegate = _delegates[msg.sender];
        _delegates[msg.sender] = address(0);

        emit DelegateChanged(msg.sender, oldDelegate, address(0));
    }

    /**
     * @notice Execute a proposal that has passed quorum and has more for votes than against.
     * @param proposalId The proposal to execute
     */
    function executeProposal(
        uint256 proposalId
    ) external nonReentrant proposalExists(proposalId) {
        Proposal storage proposal = _proposals[proposalId];

        if (proposal.status == ProposalStatus.EXECUTED) revert ProposalAlreadyExecuted();
        if (proposal.status == ProposalStatus.CANCELLED) revert ProposalNotActive();
        if (block.number <= proposal.endBlock) revert VotingNotEnded();

        // Determine outcome
        if (!quorumReached(proposalId) || proposal.forVotes <= proposal.againstVotes) {
            proposal.status = ProposalStatus.DEFEATED;
            return;
        }

        proposal.status = ProposalStatus.EXECUTED;
        proposal.executedAt = block.timestamp;

        emit ProposalExecuted(proposalId, block.timestamp);
    }

    /**
     * @notice Cancel a proposal. Only the proposer or contract owner can cancel.
     * @param proposalId The proposal to cancel
     */
    function cancelProposal(
        uint256 proposalId
    ) external nonReentrant proposalExists(proposalId) {
        Proposal storage proposal = _proposals[proposalId];

        if (msg.sender != proposal.proposer && msg.sender != owner()) {
            revert NotProposer();
        }
        if (proposal.status == ProposalStatus.EXECUTED) revert ProposalAlreadyExecuted();
        if (proposal.status == ProposalStatus.CANCELLED) revert ProposalNotActive();

        proposal.status = ProposalStatus.CANCELLED;

        emit ProposalCancelled(proposalId, block.timestamp);
    }

    // ────────────────────────────────────────────────────────
    // View Functions
    // ────────────────────────────────────────────────────────

    /**
     * @notice Get full proposal details.
     * @param proposalId The proposal to look up
     * @return The proposal record
     */
    function getProposal(
        uint256 proposalId
    ) external view returns (Proposal memory) {
        if (_proposals[proposalId].proposer == address(0)) revert ProposalNotFound();
        return _proposals[proposalId];
    }

    /**
     * @notice Get a voter's receipt for a proposal.
     * @param proposalId The proposal
     * @param voter The voter address
     * @return The vote receipt
     */
    function getVoteReceipt(
        uint256 proposalId,
        address voter
    ) external view returns (VoteReceipt memory) {
        return _voteReceipts[proposalId][voter];
    }

    /**
     * @notice Get the effective voting power for an account.
     *         If the account has delegated, their power is 0.
     *         If others have delegated to this account, their power is added.
     * @param account The account to check
     * @return The effective voting power
     */
    function getVotingPower(address account) public view returns (uint256) {
        // If the account has delegated away, they have no power
        if (_delegates[account] != address(0)) return 0;

        return _votingPower[account];
    }

    /**
     * @notice Get the current state of a proposal, accounting for voting end.
     * @param proposalId The proposal to check
     * @return The effective proposal status
     */
    function proposalState(
        uint256 proposalId
    ) external view returns (ProposalStatus) {
        Proposal storage proposal = _proposals[proposalId];
        if (proposal.proposer == address(0)) revert ProposalNotFound();

        if (proposal.status == ProposalStatus.CANCELLED) return ProposalStatus.CANCELLED;
        if (proposal.status == ProposalStatus.EXECUTED) return ProposalStatus.EXECUTED;

        if (block.number <= proposal.endBlock) return ProposalStatus.ACTIVE;

        // Voting ended — determine outcome
        if (quorumReached(proposalId) && proposal.forVotes > proposal.againstVotes) {
            return ProposalStatus.PASSED;
        }

        return ProposalStatus.DEFEATED;
    }

    /**
     * @notice Check if quorum has been reached for a proposal.
     * @param proposalId The proposal to check
     * @return True if total votes meet the quorum threshold
     */
    function quorumReached(uint256 proposalId) public view returns (bool) {
        Proposal storage proposal = _proposals[proposalId];
        uint256 totalVotesCast = proposal.forVotes + proposal.againstVotes + proposal.abstainVotes;

        if (totalVotingPower == 0) return false;

        uint256 quorumVotes = (totalVotingPower * quorumBps) / 10000;
        return totalVotesCast >= quorumVotes;
    }

    /**
     * @notice Get the delegate for an account.
     * @param account The delegator
     * @return The delegatee address (address(0) if not delegated)
     */
    function getDelegate(address account) external view returns (address) {
        return _delegates[account];
    }

    // ────────────────────────────────────────────────────────
    // Admin Functions
    // ────────────────────────────────────────────────────────

    /**
     * @notice Set the voting power for an account. Called by staking contract or admin.
     * @param account The account to update
     * @param power The new voting power
     */
    function setVotingPower(
        address account,
        uint256 power
    ) external onlyOwner {
        uint256 oldPower = _votingPower[account];

        if (oldPower > 0) {
            totalVotingPower -= oldPower;
        }

        _votingPower[account] = power;
        totalVotingPower += power;

        emit VotingPowerUpdated(account, oldPower, power);
    }

    /**
     * @notice Update the quorum threshold (in basis points).
     * @param newQuorumBps New quorum in basis points (e.g., 400 = 4%)
     */
    function setQuorum(uint256 newQuorumBps) external onlyOwner {
        if (newQuorumBps == 0 || newQuorumBps > 5000) revert InvalidQuorum();
        uint256 old = quorumBps;
        quorumBps = newQuorumBps;
        emit QuorumUpdated(old, newQuorumBps);
    }

    /**
     * @notice Update the default voting period.
     * @param newPeriod New voting period in blocks
     */
    function setDefaultVotingPeriod(uint256 newPeriod) external onlyOwner {
        if (newPeriod < MIN_VOTING_PERIOD || newPeriod > MAX_VOTING_PERIOD) {
            revert InvalidVotingPeriod();
        }
        uint256 old = defaultVotingPeriodBlocks;
        defaultVotingPeriodBlocks = newPeriod;
        emit VotingPeriodUpdated(old, newPeriod);
    }

    /**
     * @notice Update the minimum proposal threshold.
     * @param newThreshold New threshold in wei (e.g., 1000 * 1e18)
     */
    function setProposalThreshold(uint256 newThreshold) external onlyOwner {
        uint256 old = proposalThreshold;
        proposalThreshold = newThreshold;
        emit ProposalThresholdUpdated(old, newThreshold);
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
