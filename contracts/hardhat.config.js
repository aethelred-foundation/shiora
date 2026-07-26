require('@nomicfoundation/hardhat-ethers');
require('@nomicfoundation/hardhat-chai-matchers');

/**
 * Isolated Hardhat project for Shiora's consensus-anchored seal tier.
 *
 * `sources: "./seal"` scopes compilation to the ONE tested, consensus-anchored
 * contract (ShioraSealAttestation) plus its vendored ISeal interface and test
 * mock. The pre-existing core/privacy/defi contracts are design artifacts that
 * compile (verified) but are untested and unwired; they are intentionally NOT
 * built here so this project's green status vouches only for the seal tier.
 */
module.exports = {
  solidity: {
    version: '0.8.20',
    settings: { optimizer: { enabled: true, runs: 200 }, viaIR: true },
  },
  paths: { sources: './seal', tests: './test', cache: './cache', artifacts: './artifacts' },
  networks: {
    // Local aethelredd EVM devnet (chain-id 7332) — the live-node target for
    // scripts/devnet-seal-attestation-e2e.js, the running-node counterpart to
    // internal/evmhost/shiora_test.go. Accounts are populated only when a funded
    // DEPLOYER_KEY is supplied; harmless (no accounts) otherwise, so this entry
    // never affects the scoped `sources: './seal'` compile/test path.
    aethelredDevnet: {
      url: process.env.RPC_URL || 'http://127.0.0.1:8545',
      chainId: 7332,
      accounts: process.env.DEPLOYER_KEY ? [process.env.DEPLOYER_KEY] : [],
      // Aethelred's cosmos/evm EVM charges max(actualGas, gasLimit/2) — a refund
      // above half the limit is capped — so an over-large fixed limit overpays.
      // Its eth_estimateGas is accurate, so keep estimation on (do NOT pin a
      // fixed `gas`) and add 2x headroom: the fee stays at the true cost while
      // a disallowed call still reverts at estimate time.
      gasMultiplier: 2,
    },
  },
};
