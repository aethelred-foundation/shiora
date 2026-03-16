// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title ShioraMarketplace
 * @author Shiora Health AI on Aethelred
 * @notice Health data marketplace where users can list anonymized, TEE-verified
 *         health datasets for purchase with SHIO tokens. Revenue is split between
 *         the seller (85%), the protocol treasury (10%), and stakers (5%).
 *         Listings carry quality scores from TEE verification and expire after
 *         a configurable duration (max 90 days).
 */
contract ShioraMarketplace is Ownable, ReentrancyGuard, Pausable {

    // ────────────────────────────────────────────────────────
    // Enums
    // ────────────────────────────────────────────────────────

    enum ListingStatus {
        ACTIVE,
        SOLD,
        EXPIRED,
        WITHDRAWN
    }

    // ────────────────────────────────────────────────────────
    // Structs
    // ────────────────────────────────────────────────────────

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

    struct Purchase {
        address buyer;
        uint256 listingId;
        uint256 price;
        uint256 purchasedAt;
        bytes32 txHash;
    }

    struct MarketplaceStats {
        uint256 totalListings;
        uint256 totalPurchases;
        uint256 totalVolume;
        uint256 protocolFees;
        uint256 stakerFees;
    }

    // ────────────────────────────────────────────────────────
    // State
    // ────────────────────────────────────────────────────────

    /// @notice Listings by ID
    mapping(uint256 => Listing) private _listings;

    /// @notice Purchases by ID
    mapping(uint256 => Purchase) private _purchases;

    /// @notice Listing IDs per seller
    mapping(address => uint256[]) private _sellerListings;

    /// @notice Purchase IDs per buyer
    mapping(address => uint256[]) private _buyerPurchases;

    /// @notice Total listings created
    uint256 public totalListings;

    /// @notice Total purchases made
    uint256 public totalPurchases;

    /// @notice Total volume traded in SHIO (wei)
    uint256 public totalVolume;

    /// @notice Protocol fees collected
    uint256 public protocolFees;

    /// @notice Staker fees collected
    uint256 public stakerFees;

    /// @notice SHIO token contract address
    address public shioToken;

    /// @notice Protocol treasury address
    address public protocolTreasury;

    /// @notice Staker reward pool address
    address public stakerRewardPool;

    /// @notice Seller revenue share in basis points (8500 = 85%)
    uint256 public sellerShareBps;

    /// @notice Protocol fee share in basis points (1000 = 10%)
    uint256 public protocolFeeBps;

    /// @notice Staker fee share in basis points (500 = 5%)
    uint256 public stakerFeeBps;

    /// @notice Minimum listing price (1 SHIO = 1e18 wei)
    uint256 public constant MIN_PRICE = 1e18;

    /// @notice Maximum listing duration (90 days)
    uint256 public constant MAX_LISTING_DURATION = 90 days;

    /// @notice Minimum listing duration (1 day)
    uint256 public constant MIN_LISTING_DURATION = 1 days;

    /// @notice Maximum quality score
    uint256 public constant MAX_QUALITY_SCORE = 100;

    // ────────────────────────────────────────────────────────
    // Events
    // ────────────────────────────────────────────────────────

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

    event FeeStructureUpdated(
        uint256 sellerBps,
        uint256 protocolBps,
        uint256 stakerBps
    );

    // ────────────────────────────────────────────────────────
    // Errors
    // ────────────────────────────────────────────────────────

    error InvalidCategory();
    error InvalidDataHash();
    error InvalidPrice();
    error InvalidQualityScore();
    error InvalidDuration();
    error InvalidAttestation();
    error ListingNotFound();
    error ListingNotActive();
    error ListingExpired();
    error NotListingSeller();
    error CannotPurchaseOwnListing();
    error TransferFailed();
    error InvalidFeeStructure();
    error InvalidAddress();

    // ────────────────────────────────────────────────────────
    // Modifiers
    // ────────────────────────────────────────────────────────

    modifier onlyListingSeller(uint256 listingId) {
        if (_listings[listingId].seller == address(0)) revert ListingNotFound();
        if (_listings[listingId].seller != msg.sender) revert NotListingSeller();
        _;
    }

    // ────────────────────────────────────────────────────────
    // Constructor
    // ────────────────────────────────────────────────────────

    /**
     * @param shioToken_ Address of the SHIO ERC-20 token contract
     * @param protocolTreasury_ Address of the protocol treasury
     * @param stakerRewardPool_ Address of the staker reward pool
     */
    constructor(
        address shioToken_,
        address protocolTreasury_,
        address stakerRewardPool_
    ) Ownable(msg.sender) {
        if (shioToken_ == address(0)) revert InvalidAddress();
        if (protocolTreasury_ == address(0)) revert InvalidAddress();
        if (stakerRewardPool_ == address(0)) revert InvalidAddress();

        shioToken = shioToken_;
        protocolTreasury = protocolTreasury_;
        stakerRewardPool = stakerRewardPool_;

        sellerShareBps = 8500; // 85%
        protocolFeeBps = 1000; // 10%
        stakerFeeBps = 500;    // 5%
    }

    // ────────────────────────────────────────────────────────
    // External Functions
    // ────────────────────────────────────────────────────────

    /**
     * @notice List a health dataset for sale on the marketplace.
     * @param category Data category (e.g., keccak256("genomics"))
     * @param dataHash Hash of the encrypted dataset
     * @param price Price in SHIO tokens (wei)
     * @param attestation TEE attestation hash verifying data quality
     * @param qualityScore Quality score assigned by TEE (0-100)
     * @param durationDays Number of days the listing is active
     * @return listingId Unique identifier for the new listing
     */
    function listData(
        bytes32 category,
        bytes32 dataHash,
        uint256 price,
        bytes32 attestation,
        uint256 qualityScore,
        uint256 durationDays
    ) external nonReentrant whenNotPaused returns (uint256 listingId) {
        if (category == bytes32(0)) revert InvalidCategory();
        if (dataHash == bytes32(0)) revert InvalidDataHash();
        if (price < MIN_PRICE) revert InvalidPrice();
        if (qualityScore > MAX_QUALITY_SCORE) revert InvalidQualityScore();

        uint256 durationSeconds = durationDays * 1 days;
        if (durationSeconds < MIN_LISTING_DURATION || durationSeconds > MAX_LISTING_DURATION) {
            revert InvalidDuration();
        }

        totalListings++;
        listingId = totalListings;

        uint256 expiresAt = block.timestamp + durationSeconds;

        _listings[listingId] = Listing({
            seller: msg.sender,
            category: category,
            dataHash: dataHash,
            price: price,
            purchaseCount: 0,
            status: ListingStatus.ACTIVE,
            teeVerified: attestation != bytes32(0),
            attestation: attestation,
            qualityScore: qualityScore,
            createdAt: block.timestamp,
            expiresAt: expiresAt
        });

        _sellerListings[msg.sender].push(listingId);

        emit DataListed(listingId, msg.sender, category, price, qualityScore, expiresAt);
    }

    /**
     * @notice Purchase access to a listed dataset. Buyer must have approved
     *         this contract for the listing price in SHIO tokens.
     * @param listingId The listing to purchase
     * @return purchaseId Unique identifier for the purchase
     */
    function purchaseData(
        uint256 listingId
    ) external nonReentrant whenNotPaused returns (uint256 purchaseId) {
        Listing storage listing = _listings[listingId];
        if (listing.seller == address(0)) revert ListingNotFound();
        if (listing.status != ListingStatus.ACTIVE) revert ListingNotActive();
        if (block.timestamp >= listing.expiresAt) revert ListingExpired();
        if (msg.sender == listing.seller) revert CannotPurchaseOwnListing();

        uint256 price = listing.price;

        // Calculate revenue split
        uint256 sellerAmount = (price * sellerShareBps) / 10000;
        uint256 protocolAmount = (price * protocolFeeBps) / 10000;
        uint256 stakerAmount = price - sellerAmount - protocolAmount;

        // Transfer SHIO from buyer to seller
        bool success = _transferFrom(msg.sender, listing.seller, sellerAmount);
        if (!success) revert TransferFailed();

        // Transfer protocol fee to treasury
        if (protocolAmount > 0) {
            success = _transferFrom(msg.sender, protocolTreasury, protocolAmount);
            if (!success) revert TransferFailed();
        }

        // Transfer staker fee to reward pool
        if (stakerAmount > 0) {
            success = _transferFrom(msg.sender, stakerRewardPool, stakerAmount);
            if (!success) revert TransferFailed();
        }

        listing.purchaseCount++;
        totalVolume += price;
        protocolFees += protocolAmount;
        stakerFees += stakerAmount;

        totalPurchases++;
        purchaseId = totalPurchases;

        bytes32 txHash = keccak256(
            abi.encodePacked(msg.sender, listingId, block.timestamp, purchaseId)
        );

        _purchases[purchaseId] = Purchase({
            buyer: msg.sender,
            listingId: listingId,
            price: price,
            purchasedAt: block.timestamp,
            txHash: txHash
        });

        _buyerPurchases[msg.sender].push(purchaseId);

        emit DataPurchased(
            purchaseId,
            listingId,
            msg.sender,
            price,
            sellerAmount,
            protocolAmount,
            stakerAmount
        );
    }

    /**
     * @notice Withdraw a listing from the marketplace. Only the seller can withdraw.
     * @param listingId The listing to withdraw
     */
    function withdrawListing(
        uint256 listingId
    ) external nonReentrant onlyListingSeller(listingId) {
        Listing storage listing = _listings[listingId];
        if (listing.status != ListingStatus.ACTIVE) revert ListingNotActive();

        listing.status = ListingStatus.WITHDRAWN;

        emit ListingWithdrawn(listingId, msg.sender, block.timestamp);
    }

    /**
     * @notice Update the price of an active listing.
     * @param listingId The listing to update
     * @param newPrice New price in SHIO tokens (wei)
     */
    function updatePrice(
        uint256 listingId,
        uint256 newPrice
    ) external nonReentrant onlyListingSeller(listingId) {
        if (newPrice < MIN_PRICE) revert InvalidPrice();

        Listing storage listing = _listings[listingId];
        if (listing.status != ListingStatus.ACTIVE) revert ListingNotActive();

        uint256 oldPrice = listing.price;
        listing.price = newPrice;

        emit PriceUpdated(listingId, oldPrice, newPrice);
    }

    // ────────────────────────────────────────────────────────
    // View Functions
    // ────────────────────────────────────────────────────────

    /**
     * @notice Get full details of an active listing.
     * @param listingId The listing to look up
     * @return The listing record
     */
    function getActiveListing(
        uint256 listingId
    ) external view returns (Listing memory) {
        if (_listings[listingId].seller == address(0)) revert ListingNotFound();
        return _listings[listingId];
    }

    /**
     * @notice Get all listing IDs for a seller.
     * @param seller The seller address
     * @return Array of listing IDs
     */
    function getSellerListings(
        address seller
    ) external view returns (uint256[] memory) {
        return _sellerListings[seller];
    }

    /**
     * @notice Get all purchase IDs for a buyer.
     * @param buyer The buyer address
     * @return Array of purchase IDs
     */
    function getBuyerPurchases(
        address buyer
    ) external view returns (uint256[] memory) {
        return _buyerPurchases[buyer];
    }

    /**
     * @notice Get a purchase record by ID.
     * @param purchaseId The purchase to look up
     * @return The purchase record
     */
    function getPurchase(
        uint256 purchaseId
    ) external view returns (Purchase memory) {
        return _purchases[purchaseId];
    }

    /**
     * @notice Get aggregate marketplace statistics.
     * @return stats The marketplace stats
     */
    function getMarketplaceStats() external view returns (MarketplaceStats memory stats) {
        stats = MarketplaceStats({
            totalListings: totalListings,
            totalPurchases: totalPurchases,
            totalVolume: totalVolume,
            protocolFees: protocolFees,
            stakerFees: stakerFees
        });
    }

    // ────────────────────────────────────────────────────────
    // Admin Functions
    // ────────────────────────────────────────────────────────

    /**
     * @notice Update the revenue split fee structure.
     *         The three fee components must sum to 10000 (100%).
     * @param sellerBps Seller share in basis points
     * @param protocolBps Protocol fee in basis points
     * @param stakerBps Staker fee in basis points
     */
    function setFeeStructure(
        uint256 sellerBps,
        uint256 protocolBps,
        uint256 stakerBps
    ) external onlyOwner {
        if (sellerBps + protocolBps + stakerBps != 10000) revert InvalidFeeStructure();

        sellerShareBps = sellerBps;
        protocolFeeBps = protocolBps;
        stakerFeeBps = stakerBps;

        emit FeeStructureUpdated(sellerBps, protocolBps, stakerBps);
    }

    /**
     * @notice Update the protocol treasury address.
     * @param newTreasury New treasury address
     */
    function setProtocolTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert InvalidAddress();
        protocolTreasury = newTreasury;
    }

    /**
     * @notice Update the staker reward pool address.
     * @param newPool New staker reward pool address
     */
    function setStakerRewardPool(address newPool) external onlyOwner {
        if (newPool == address(0)) revert InvalidAddress();
        stakerRewardPool = newPool;
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
     * @dev Transfer SHIO tokens from one address to another via the token contract.
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
}
