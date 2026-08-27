// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/ISeal.sol";

/**
 * @title MockISeal
 * @notice Test double for the Aethelred ISeal precompile (0x0900). The unit
 *         suite installs its runtime bytecode at the precompile address with
 *         `hardhat_setCode` — which wipes storage, so tests must (re)populate
 *         seals AFTER installing the code.
 * @dev    The REAL precompile binding is proven in the aethelred repo
 *         (internal/evmhost real-precompile test against a real seal keeper);
 *         this mock only exists to exercise ShioraSealAttestation' own logic.
 */
contract MockISeal is ISeal {
    struct MockSeal {
        string sealId;
        string purpose;
        bool exists;
        bool active;
    }

    mapping(string => MockSeal) private _byJob; // jobId => seal
    mapping(string => MockSeal) private _byId; // sealId => seal

    bool private _policyOk = true;
    string private _policyReason = "";

    // ── test wiring ──────────────────────────────────────────────────────────

    function setSeal(
        string calldata jobId,
        string calldata sealId,
        string calldata purpose,
        bool active
    ) external {
        MockSeal memory s = MockSeal({sealId: sealId, purpose: purpose, exists: true, active: active});
        _byJob[jobId] = s;
        _byId[sealId] = s;
    }

    function setActive(string calldata sealId, bool active) external {
        _byId[sealId].active = active;
    }

    function setPolicyResult(bool ok, string calldata reason) external {
        _policyOk = ok;
        _policyReason = reason;
    }

    // ── ISeal ────────────────────────────────────────────────────────────────

    function getSeal(string calldata sealId)
        external
        view
        returns (
            bytes32,
            bytes32,
            bytes32,
            int64,
            uint64,
            string memory,
            string memory purpose,
            uint8 status,
            string memory
        )
    {
        MockSeal storage s = _byId[sealId];
        require(s.exists, "seal not found");
        return (
            bytes32(0),
            bytes32(0),
            bytes32(0),
            0,
            0,
            "",
            s.purpose,
            s.active ? 2 : 3,
            ""
        );
    }

    function getConfidentiality(string calldata)
        external
        pure
        returns (
            string memory,
            string memory,
            string memory,
            bytes memory,
            string memory,
            string memory,
            bool,
            bytes memory,
            string memory
        )
    {
        return ("", "", "", "", "", "", false, "", "");
    }

    function getSealIdByJob(string calldata jobId) external view returns (string memory) {
        MockSeal storage s = _byJob[jobId];
        require(s.exists, "job not sealed");
        return s.sealId;
    }

    function verifySeal(string calldata sealId) external view returns (bool) {
        MockSeal storage s = _byId[sealId];
        return s.exists && s.active;
    }

    function requireConfidentiality(
        string calldata,
        string[] calldata,
        string calldata,
        string[] calldata,
        bool,
        string[] calldata
    ) external view returns (bool, string memory) {
        return (_policyOk, _policyReason);
    }
}
