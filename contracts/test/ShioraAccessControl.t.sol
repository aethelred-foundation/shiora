// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { ShioraAccessControl } from "../core/ShioraAccessControl.sol";

interface Vm {
    function prank(address sender) external;
    function expectRevert(bytes4 selector) external;
    function warp(uint256 timestamp) external;
}

contract ShioraAccessControlTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    ShioraAccessControl private accessControl;

    address private constant OWNER = address(0x2001);
    address private constant PROVIDER = address(0x2002);
    address private constant ATTACKER = address(0x2003);

    function setUp() public {
        accessControl = new ShioraAccessControl();
    }

    function testGrantLifecycleEnforcesOwnerAndExpiry() public {
        bytes32 grantId = _grantAccess();

        require(accessControl.isAccessValid(grantId), "grant should start active");
        require(accessControl.hasPermission(grantId, 0), "view permission");
        require(!accessControl.hasPermission(grantId, 1), "download permission");

        vm.prank(ATTACKER);
        vm.expectRevert(ShioraAccessControl.NotGrantOwner.selector);
        accessControl.modifyAccess(grantId, "stolen scope", 0, true, true, true);

        vm.prank(OWNER);
        accessControl.modifyAccess(grantId, "labs only", 2 hours, true, true, false);

        ShioraAccessControl.AccessGrant memory grant = accessControl.getGrant(grantId);
        require(grant.canDownload, "download permission not updated");
        require(!grant.canShare, "share permission should be false");

        vm.warp(block.timestamp + 3 hours);
        require(!accessControl.isAccessValid(grantId), "grant should expire");
        require(accessControl.getEffectiveStatus(grantId) == ShioraAccessControl.GrantStatus.EXPIRED, "effective expiry");
    }

    function testOnlyOwnerCanRevokeGrant() public {
        bytes32 grantId = _grantAccess();

        vm.prank(ATTACKER);
        vm.expectRevert(ShioraAccessControl.NotGrantOwner.selector);
        accessControl.revokeAccess(grantId);

        vm.prank(OWNER);
        accessControl.revokeAccess(grantId);

        require(!accessControl.isAccessValid(grantId), "revoked grant should be invalid");
        require(accessControl.getEffectiveStatus(grantId) == ShioraAccessControl.GrantStatus.REVOKED, "effective revoked");
    }

    function testInvalidGrantInputsRevert() public {
        vm.prank(OWNER);
        vm.expectRevert(ShioraAccessControl.SelfGrantNotAllowed.selector);
        accessControl.grantAccess(OWNER, "full", 1 hours, true, false, false, bytes32(0));

        vm.prank(OWNER);
        vm.expectRevert(ShioraAccessControl.NoPermissionsSet.selector);
        accessControl.grantAccess(PROVIDER, "full", 1 hours, false, false, false, bytes32(0));

        vm.prank(OWNER);
        vm.expectRevert(ShioraAccessControl.InvalidDuration.selector);
        accessControl.grantAccess(PROVIDER, "full", 30 minutes, true, false, false, bytes32(0));
    }

    function _grantAccess() private returns (bytes32 grantId) {
        vm.prank(OWNER);
        grantId = accessControl.grantAccess(
            PROVIDER,
            "full record",
            1 hours,
            true,
            false,
            false,
            keccak256("tee-attestation")
        );
    }
}
