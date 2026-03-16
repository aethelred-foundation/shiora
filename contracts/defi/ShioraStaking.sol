// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title ShioraStaking
 * @author Shiora Health AI on Aethelred
 * @notice Allows users to stake SHIO tokens for governance voting weight and
 *         protocol rewards. Stake positions are time-locked with a 7-day
 *         cooldown for unstaking. Rewards accrue based on staking duration
 *         and amount, with 1 staked SHIO = 1 vote of governance power.
 */
contract ShioraStaking is Ownable, ReentrancyGuard, Pausable {

    // ────────────────────────────────────────────────────────
    // Enums
    // ────────────────────────────────────────────────────────

    enum StakeStatus {
        STAKED,
        UNSTAKING,
        WITHDRAWN
    }

    // ────────────────────────────────────────────────────────
    // Structs
    // ────────────────────────────────────────────────────────

    struct StakePosition {
        address staker;
        uint256 amount;
        uint256 stakedAt;
        uint256 unlockAt;
        StakeStatus status;
        uint256 rewardsEarned;
        uint256 rewardsClaimed;
    }

    // ────────────────────────────────────────────────────────
    // State
    // ────────────────────────────────────────────────────────

    /// @notice Stake positions by ID
    mapping(uint256 => StakePosition) private _positions;

    /// @notice Position IDs per staker
    mapping(address => uint256[]) private _stakerPositions;

    /// @notice Total number of stake positions created
    uint256 public positionCount;

    /// @notice Total SHIO currently staked across all positions
    uint256 public totalStaked;

    /// @notice Total rewards distributed
    uint256 public totalRewardsDistributed;

    /// @notice Reward rate per second per staked token (in wei)
    uint256 public rewardRatePerSecond;

    /// @notice Cooldown period for unstaking (7 days)
    uint256 public constant UNSTAKE_COOLDOWN = 7 days;

    /// @notice Minimum stake amount (100 SHIO = 100 * 1e18)
    uint256 public constant MIN_STAKE = 100 * 1e18;

    /// @notice SHIO token contract address
    address public shioToken;

    /// @notice Reward pool balance
    uint256 public rewardPool;

    // ────────────────────────────────────────────────────────
    // Events
    // ────────────────────────────────────────────────────────

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

    event RewardPoolFunded(
        address indexed funder,
        uint256 amount
    );

    // ────────────────────────────────────────────────────────
    // Errors
    // ────────────────────────────────────────────────────────

    error InsufficientStakeAmount();
    error PositionNotFound();
    error NotPositionOwner();
    error PositionNotStaked();
    error PositionNotUnstaking();
    error CooldownNotElapsed();
    error PositionAlreadyWithdrawn();
    error NoRewardsToClaim();
    error InsufficientRewardPool();
    error InvalidTokenAddress();
    error TransferFailed();

    // ────────────────────────────────────────────────────────
    // Modifiers
    // ────────────────────────────────────────────────────────

    modifier onlyPositionOwner(uint256 positionId) {
        if (_positions[positionId].staker == address(0)) revert PositionNotFound();
        if (_positions[positionId].staker != msg.sender) revert NotPositionOwner();
        _;
    }

    // ────────────────────────────────────────────────────────
    // Constructor
    // ────────────────────────────────────────────────────────

    /**
     * @param shioToken_ Address of the SHIO ERC-20 token contract
     * @param initialRewardRate Initial reward rate per second per token (in wei)
     */
    constructor(
        address shioToken_,
        uint256 initialRewardRate
    ) Ownable(msg.sender) {
        if (shioToken_ == address(0)) revert InvalidTokenAddress();
        shioToken = shioToken_;
        rewardRatePerSecond = initialRewardRate;
    }

    // ────────────────────────────────────────────────────────
    // External Functions
    // ────────────────────────────────────────────────────────

    /**
     * @notice Stake SHIO tokens to earn rewards and governance power.
     *         Caller must have approved this contract for the stake amount.
     * @param amount Amount of SHIO tokens to stake (in wei)
     * @return positionId Unique identifier for the new stake position
     */
    function stake(
        uint256 amount
    ) external nonReentrant whenNotPaused returns (uint256 positionId) {
        if (amount < MIN_STAKE) revert InsufficientStakeAmount();

        // Transfer SHIO tokens from the staker to this contract
        bool success = _transferFrom(msg.sender, address(this), amount);
        if (!success) revert TransferFailed();

        positionCount++;
        positionId = positionCount;

        _positions[positionId] = StakePosition({
            staker: msg.sender,
            amount: amount,
            stakedAt: block.timestamp,
            unlockAt: 0,
            status: StakeStatus.STAKED,
            rewardsEarned: 0,
            rewardsClaimed: 0
        });

        _stakerPositions[msg.sender].push(positionId);
        totalStaked += amount;

        emit Staked(positionId, msg.sender, amount, block.timestamp);
    }

    /**
     * @notice Initiate unstaking. The staker must wait the cooldown period
     *         before they can withdraw their tokens.
     * @param positionId The position to unstake
     */
    function unstake(
        uint256 positionId
    ) external nonReentrant onlyPositionOwner(positionId) {
        StakePosition storage position = _positions[positionId];

        if (position.status != StakeStatus.STAKED) revert PositionNotStaked();

        // Calculate and lock final rewards before unstaking
        uint256 pending = _calculatePendingRewards(positionId);
        position.rewardsEarned += pending;

        position.status = StakeStatus.UNSTAKING;
        position.unlockAt = block.timestamp + UNSTAKE_COOLDOWN;
        totalStaked -= position.amount;

        emit UnstakeInitiated(positionId, msg.sender, position.unlockAt);
    }

    /**
     * @notice Withdraw staked tokens after the cooldown period has elapsed.
     * @param positionId The position to withdraw from
     */
    function withdraw(
        uint256 positionId
    ) external nonReentrant onlyPositionOwner(positionId) {
        StakePosition storage position = _positions[positionId];

        if (position.status == StakeStatus.WITHDRAWN) revert PositionAlreadyWithdrawn();
        if (position.status != StakeStatus.UNSTAKING) revert PositionNotUnstaking();
        if (block.timestamp < position.unlockAt) revert CooldownNotElapsed();

        position.status = StakeStatus.WITHDRAWN;

        // Transfer staked tokens back to the staker
        bool success = _transfer(msg.sender, position.amount);
        if (!success) revert TransferFailed();

        emit Withdrawn(positionId, msg.sender, position.amount, block.timestamp);
    }

    /**
     * @notice Claim accrued rewards for a stake position.
     * @param positionId The position to claim rewards for
     */
    function claimRewards(
        uint256 positionId
    ) external nonReentrant onlyPositionOwner(positionId) {
        StakePosition storage position = _positions[positionId];

        // Calculate pending rewards for active positions
        uint256 pending = 0;
        if (position.status == StakeStatus.STAKED) {
            pending = _calculatePendingRewards(positionId);
            position.rewardsEarned += pending;
        }

        uint256 claimable = position.rewardsEarned - position.rewardsClaimed;
        if (claimable == 0) revert NoRewardsToClaim();
        if (claimable > rewardPool) revert InsufficientRewardPool();

        position.rewardsClaimed += claimable;
        rewardPool -= claimable;
        totalRewardsDistributed += claimable;

        // Transfer rewards to the staker
        bool success = _transfer(msg.sender, claimable);
        if (!success) revert TransferFailed();

        emit RewardsClaimed(positionId, msg.sender, claimable);
    }

    /**
     * @notice Fund the reward pool. Caller must have approved this contract.
     * @param amount Amount of SHIO tokens to add to the reward pool
     */
    function fundRewardPool(uint256 amount) external nonReentrant {
        bool success = _transferFrom(msg.sender, address(this), amount);
        if (!success) revert TransferFailed();

        rewardPool += amount;

        emit RewardPoolFunded(msg.sender, amount);
    }

    // ────────────────────────────────────────────────────────
    // View Functions
    // ────────────────────────────────────────────────────────

    /**
     * @notice Get full details of a stake position.
     * @param positionId The position to look up
     * @return The stake position record
     */
    function getStakePosition(
        uint256 positionId
    ) external view returns (StakePosition memory) {
        if (_positions[positionId].staker == address(0)) revert PositionNotFound();
        return _positions[positionId];
    }

    /**
     * @notice Get all position IDs for a staker.
     * @param staker The staker address
     * @return Array of position IDs
     */
    function getStakerPositions(
        address staker
    ) external view returns (uint256[] memory) {
        return _stakerPositions[staker];
    }

    /**
     * @notice Calculate the pending (unclaimed) rewards for a position.
     * @param positionId The position to check
     * @return Pending reward amount in wei
     */
    function calculatePendingRewards(
        uint256 positionId
    ) external view returns (uint256) {
        if (_positions[positionId].staker == address(0)) revert PositionNotFound();

        StakePosition storage position = _positions[positionId];
        if (position.status != StakeStatus.STAKED) {
            return position.rewardsEarned - position.rewardsClaimed;
        }

        uint256 pending = _calculatePendingRewards(positionId);
        return (position.rewardsEarned + pending) - position.rewardsClaimed;
    }

    /**
     * @notice Get the total amount of SHIO currently staked.
     * @return Total staked amount
     */
    function getTotalStaked() external view returns (uint256) {
        return totalStaked;
    }

    /**
     * @notice Get the total governance voting power for a staker.
     *         1 staked SHIO = 1 vote. Only STAKED positions count.
     * @param staker The staker address
     * @return Total voting power
     */
    function getStakerVotingPower(
        address staker
    ) external view returns (uint256) {
        uint256[] storage positionIds = _stakerPositions[staker];
        uint256 power = 0;

        for (uint256 i = 0; i < positionIds.length; i++) {
            StakePosition storage position = _positions[positionIds[i]];
            if (position.status == StakeStatus.STAKED) {
                power += position.amount;
            }
        }

        return power;
    }

    // ────────────────────────────────────────────────────────
    // Admin Functions
    // ────────────────────────────────────────────────────────

    /**
     * @notice Update the reward rate per second per staked token.
     * @param newRate New reward rate in wei
     */
    function setRewardRate(uint256 newRate) external onlyOwner {
        uint256 oldRate = rewardRatePerSecond;
        rewardRatePerSecond = newRate;
        emit RewardRateUpdated(oldRate, newRate);
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
     * @dev Calculate pending rewards for an active stake position.
     *      Rewards = amount * duration * rewardRatePerSecond / 1e18
     */
    function _calculatePendingRewards(
        uint256 positionId
    ) internal view returns (uint256) {
        StakePosition storage position = _positions[positionId];
        if (position.status != StakeStatus.STAKED) return 0;

        uint256 duration = block.timestamp - position.stakedAt;
        return (position.amount * duration * rewardRatePerSecond) / 1e18;
    }

    /**
     * @dev Transfer SHIO tokens from an address to this contract.
     *      Uses low-level call to the ERC-20 transferFrom function.
     */
    function _transferFrom(
        address from,
        address to,
        uint256 amount
    ) internal returns (bool) {
        (bool success, bytes memory data) = shioToken.call(
            abi.encodeWithSignature(
                "transferFrom(address,address,uint256)",
                from,
                to,
                amount
            )
        );
        return success && (data.length == 0 || abi.decode(data, (bool)));
    }

    /**
     * @dev Transfer SHIO tokens from this contract to a recipient.
     *      Uses low-level call to the ERC-20 transfer function.
     */
    function _transfer(
        address to,
        uint256 amount
    ) internal returns (bool) {
        (bool success, bytes memory data) = shioToken.call(
            abi.encodeWithSignature("transfer(address,uint256)", to, amount)
        );
        return success && (data.length == 0 || abi.decode(data, (bool)));
    }
}
