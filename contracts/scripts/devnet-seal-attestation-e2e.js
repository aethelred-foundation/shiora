const { ethers, network } = require('hardhat');

/**
 * Shiora seal-anchored attestation E2E — the consensus-anchored clinical
 * attestation, live.
 *
 * Proves the health-data flow no self-signed TEE badge or operator-held key can
 * offer: a (subject, scope) attestation — e.g. "this patient's cycle-prediction
 * inference ran under consent, in-jurisdiction, in a verified enclave" — is
 * valid only when a Digital Seal minted by the chain's own attested-compute
 * (PoUW) pipeline exists, is ACTIVE, is bound to THIS exact (subject, scope),
 * and satisfies the CEAP policy — all checked by consensus logic via the ISeal
 * precompile (0x0900):
 *
 *   1. deploy ShioraSealAttestation(governance) (or reuse REGISTRY_ADDRESS)
 *   2. governance sets the CEAP policy (fhe backend, EU residency)
 *   3. isAttested(subject, scope) === false — no seal yet
 *   4. a PoUW clinical job runs on-chain with purpose
 *      `shiora:0x<subject>:0x<scope>` → validators verify → quorum mints the
 *      Digital Seal (driven by the operator via the aethelredd CLI; this script
 *      prints the exact command, using the contract's own expectedPurpose())
 *   5. attest(subject, scope, JOB_ID) verifies the seal via ISeal (ACTIVE +
 *      purpose bound to THIS subject + scope + CEAP policy satisfied) and
 *      records the attestation; isAttested flips true
 *
 * No PHI ever touches the chain: the record binds a subject address and a scope
 * hash only. This is an operator playbook — it automates every EVM-side step and,
 * when the PoUW seal is ready, pass its JOB_ID to complete the attestation.
 * Without JOB_ID it stops after proving no-seal-no-attestation and printing the
 * mint command.
 *
 * The definitive seal-binding proof (real ISeal precompile + real seal keeper +
 * this exact bytecode, incl. live revocation + re-attest permanence) lives in
 * the aethelred repo at internal/evmhost/shiora_test.go — this script is the
 * live-node counterpart.
 *
 * Run (local aethelredd devnet):
 *   RPC_URL=http://127.0.0.1:8545 DEPLOYER_KEY=<funded-key> \
 *   [REGISTRY_ADDRESS=0x…] [SUBJECT=0x…] [SCOPE=<label>] [JOB_ID=<sealed-job>] \
 *   npx hardhat run scripts/devnet-seal-attestation-e2e.js --network aethelredDevnet
 */

const REGISTRY_ADDRESS = process.env.REGISTRY_ADDRESS ?? '';
const JOB_ID = process.env.JOB_ID ?? '';
const SCOPE = ethers.keccak256(
  ethers.toUtf8Bytes(process.env.SCOPE ?? 'clinical:cycle_prediction'),
);

function step(msg) {
  console.log(`\n== ${msg}`);
}

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

async function main() {
  step('chain identity');
  const { chainId } = await ethers.provider.getNetwork();
  if (chainId !== 7332n) {
    fail(`chain id ${chainId}, want 7332 (network: ${network.name})`);
  }
  const [governance] = await ethers.getSigners();
  if (!governance) {
    fail('no signer — set DEPLOYER_KEY (funded account; also governance)');
  }

  // The subject is the data owner (patient). Default = deployer for a
  // self-contained run; in production the subject is a distinct patient address.
  const SUBJECT = (process.env.SUBJECT ?? governance.address).toLowerCase();

  console.log(`eth_chainId: ${chainId}`);
  console.log(`governance:  ${governance.address}`);
  console.log(`subject:     ${SUBJECT}`);
  console.log(`scope:       ${SCOPE}`);

  const Registry = await ethers.getContractFactory('ShioraSealAttestation');
  let registry;
  if (REGISTRY_ADDRESS) {
    registry = Registry.attach(REGISTRY_ADDRESS);
    console.log(`\nusing REGISTRY_ADDRESS ${REGISTRY_ADDRESS}`);
  } else {
    step('deploy ShioraSealAttestation(governance)');
    registry = await Registry.deploy(governance.address);
    await registry.waitForDeployment();
    console.log(`deployed at ${await registry.getAddress()}`);
  }

  step('governance: set CEAP policy (fhe backend, EU residency)');
  await (await registry.setCompliancePolicy(['fhe'], '', [], false, ['EU'])).wait();
  const policy = await registry.compliancePolicy();
  console.log(
    `policy read-back: backends=${JSON.stringify(policy[0])} residency=${JSON.stringify(policy[4])}`,
  );

  step('no seal yet: isAttested must be false');
  if (await registry.isAttested(SUBJECT, SCOPE)) {
    fail('attested before any seal — gate is not closed');
  }
  console.log('isAttested = false (no consensus anchor) ✓');

  // The contract itself is the source of truth for the required purpose string.
  const expected = await registry.expectedPurpose(SUBJECT, SCOPE);

  if (!JOB_ID) {
    step('mint the backing seal (operator step)');
    console.log('Run a PoUW clinical job whose purpose binds this exact');
    console.log('(subject, scope), then re-run with JOB_ID set:\n');
    console.log(
      `  aethelredd tx pouw register-model --model shiora-clinical-v1 --model-id shiora-clinical \\\n` +
        `    --from validator --chain-id <id> --keyring-backend test --yes`,
    );
    console.log(
      `  aethelredd tx pouw submit-job --model shiora-clinical-v1 --input subject-${SUBJECT.slice(2, 10)} \\\n` +
        `    --proof-type tee --purpose "${expected}" \\\n` +
        `    --conf-backends fhe --conf-residency EU \\\n` +
        `    --from validator --chain-id <id> --keyring-backend test --yes`,
    );
    console.log(
      `\nWait for the quorum-minted seal, then:\n  JOB_ID=<job-id> REGISTRY_ADDRESS=${await registry.getAddress()} \\\n` +
        `    SUBJECT=${SUBJECT} DEPLOYER_KEY=<key> \\\n` +
        `    npx hardhat run scripts/devnet-seal-attestation-e2e.js --network aethelredDevnet`,
    );
    console.log(
      '\nGATE PROVEN CLOSED. Provide JOB_ID to complete the consensus-anchored attestation.',
    );
    return;
  }

  step(`attest(subject, scope, ${JOB_ID}) — verify seal via ISeal + record attestation`);
  await (await registry.attest(SUBJECT, SCOPE, JOB_ID)).wait();
  if (!(await registry.isAttested(SUBJECT, SCOPE))) {
    fail('not attested after attest()');
  }
  console.log('isAttested = true (anchored to Digital Seal) ✓');

  step('requireAttested must not revert for the anchored (subject, scope)');
  await registry.requireAttested(SUBJECT, SCOPE);
  console.log('requireAttested passed ✓');

  console.log(
    '\nCONSENSUS-ANCHORED ATTESTATION LIVE: no seal → no attestation; ' +
      'quorum-minted, subject+scope-bound, policy-satisfying seal → attestation. ' +
      'Revoke the seal on-chain (consent withdrawn / model decertified) and ' +
      'isAttested flips false with no Shiora tx.',
  );
}

main().catch((e) => {
  fail(e instanceof Error ? e.message : String(e));
});
