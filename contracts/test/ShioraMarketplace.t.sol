// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { ShioraMarketplace } from "../defi/ShioraMarketplace.sol";

interface Vm {
    function prank(address sender) external;
    function startPrank(address sender) external;
    function stopPrank() external;
    function expectRevert(bytes4 selector) external;
    function warp(uint256 timestamp) external;
}

contract MockShioToken {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    ShioraMarketplace public marketplace;
    uint256 public reentryListingId;
    bool public reentryEnabled;
    bool public reentryAttempted;
    bool public reentrySucceeded;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function setReentry(
        ShioraMarketplace marketplace_,
        uint256 listingId,
        bool enabled
    ) external {
        marketplace = marketplace_;
        reentryListingId = listingId;
        reentryEnabled = enabled;
        reentryAttempted = false;
        reentrySucceeded = false;
    }

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed < amount || balanceOf[from] < amount) {
            return false;
        }

        if (reentryEnabled && !reentryAttempted) {
            reentryAttempted = true;
            (reentrySucceeded,) = address(marketplace).call(
                abi.encodeWithSelector(ShioraMarketplace.purchaseData.selector, reentryListingId)
            );
        }

        allowance[from][msg.sender] = allowed - amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract ShioraMarketplaceTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    MockShioToken private token;
    ShioraMarketplace private marketplace;

    address private constant SELLER = address(0x1001);
    address private constant BUYER = address(0x1002);
    address private constant TREASURY = address(0x1003);
    address private constant STAKER_POOL = address(0x1004);

    function setUp() public {
        token = new MockShioToken();
        marketplace = new ShioraMarketplace(address(token), TREASURY, STAKER_POOL);
        token.mint(BUYER, 100 ether);

        vm.prank(BUYER);
        token.approve(address(marketplace), type(uint256).max);
    }

    function testPurchaseSplitsRevenueAndRecordsAuditTrail() public {
        uint256 listingId = _listData(10 ether);

        vm.prank(BUYER);
        uint256 purchaseId = marketplace.purchaseData(listingId);

        assertEq(purchaseId, 1, "purchase id");
        assertEq(token.balanceOf(SELLER), 8.5 ether, "seller split");
        assertEq(token.balanceOf(TREASURY), 1 ether, "protocol split");
        assertEq(token.balanceOf(STAKER_POOL), 0.5 ether, "staker split");

        ShioraMarketplace.MarketplaceStats memory stats = marketplace.getMarketplaceStats();
        assertEq(stats.totalPurchases, 1, "total purchases");
        assertEq(stats.totalVolume, 10 ether, "total volume");
        assertEq(stats.protocolFees, 1 ether, "protocol fees");
        assertEq(stats.stakerFees, 0.5 ether, "staker fees");

        ShioraMarketplace.Purchase memory purchase = marketplace.getPurchase(purchaseId);
        assertEq(purchase.buyer, BUYER, "purchase buyer");
        assertEq(purchase.listingId, listingId, "purchase listing");
        assertEq(purchase.price, 10 ether, "purchase price");
        require(purchase.txHash != bytes32(0), "purchase hash missing");
    }

    function testSellerCannotBuyOwnListing() public {
        uint256 listingId = _listData(10 ether);

        vm.prank(SELLER);
        vm.expectRevert(ShioraMarketplace.CannotPurchaseOwnListing.selector);
        marketplace.purchaseData(listingId);
    }

    function testExpiredListingCannotBePurchased() public {
        uint256 listingId = _listData(10 ether);

        vm.warp(block.timestamp + marketplace.MIN_LISTING_DURATION() + 1);

        vm.prank(BUYER);
        vm.expectRevert(ShioraMarketplace.ListingExpired.selector);
        marketplace.purchaseData(listingId);
    }

    function testTokenCallbackReentrancyCannotCreateSecondPurchase() public {
        uint256 listingId = _listData(10 ether);
        token.setReentry(marketplace, listingId, true);

        vm.prank(BUYER);
        marketplace.purchaseData(listingId);

        require(token.reentryAttempted(), "reentry not attempted");
        require(!token.reentrySucceeded(), "reentry succeeded");
        assertEq(marketplace.totalPurchases(), 1, "only one purchase recorded");
    }

    function _listData(uint256 price) private returns (uint256 listingId) {
        vm.prank(SELLER);
        listingId = marketplace.listData(
            keccak256("genomics"),
            keccak256("encrypted-dataset"),
            price,
            keccak256("tee-attestation"),
            97,
            1
        );
    }

    function assertEq(uint256 actual, uint256 expected, string memory message) private pure {
        require(actual == expected, message);
    }

    function assertEq(address actual, address expected, string memory message) private pure {
        require(actual == expected, message);
    }
}
