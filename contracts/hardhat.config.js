require('@nomicfoundation/hardhat-toolbox');

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
};
