const { ethers, network } = require('hardhat');

const EXPECTED_CHAIN_ID = 7332n;

function fail(message) {
  throw new Error(message);
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value || value.includes('<') || value.includes('>')) {
    fail(`${name} is required and must not contain a template placeholder.`);
  }
  return value;
}

function csv(name, { requiredValue = false } = {}) {
  const raw = requiredValue ? required(name) : (process.env[name]?.trim() ?? '');
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function requiredBoolean(name) {
  const value = required(name);
  if (value !== 'true' && value !== 'false') {
    fail(`${name} must be exactly true or false.`);
  }
  return value === 'true';
}

function sameStrings(actual, expected) {
  return (
    actual.length === expected.length && actual.every((value, index) => value === expected[index])
  );
}

async function main() {
  required('AETHELRED_TESTNET_RPC_URL');
  required('SHIORA_DEPLOYER_PRIVATE_KEY');

  const allowedBackends = csv('SHIORA_CEAP_ALLOWED_BACKENDS', { requiredValue: true });
  const dataResidency = csv('SHIORA_CEAP_DATA_RESIDENCY', { requiredValue: true });
  const minVerification = process.env.SHIORA_CEAP_MIN_VERIFICATION?.trim() ?? '';
  const allowedPlatforms = csv('SHIORA_CEAP_ALLOWED_PLATFORMS');
  const requireVendorRoot = requiredBoolean('SHIORA_CEAP_REQUIRE_VENDOR_ROOT');

  const { chainId } = await ethers.provider.getNetwork();
  if (chainId !== EXPECTED_CHAIN_ID) {
    fail(
      `Refusing deployment: ${network.name} reports chain id ${chainId}; expected ${EXPECTED_CHAIN_ID}.`,
    );
  }

  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    fail('No signer is configured. Set SHIORA_DEPLOYER_PRIVATE_KEY.');
  }
  const balance = await ethers.provider.getBalance(deployer.address);
  if (balance === 0n) {
    fail(`Deployer ${deployer.address} has no testnet balance.`);
  }

  // The deployer is the initial Ownable2Step governance account so policy
  // configuration is completed before handoff. Transfer ownership only after
  // this script succeeds and the intended governance account can accept it.
  const Factory = await ethers.getContractFactory('ShioraSealAttestation', deployer);
  const registry = await Factory.deploy(deployer.address);
  await registry.waitForDeployment();

  const address = await registry.getAddress();
  const deploymentTransaction = registry.deploymentTransaction();
  if (!deploymentTransaction) {
    fail('The deployment transaction is unavailable; no manifest can be produced safely.');
  }
  const deploymentReceipt = await deploymentTransaction.wait();
  if (!deploymentReceipt) {
    fail('The deployment transaction did not produce a receipt.');
  }

  const policyTransaction = await registry.setCompliancePolicy(
    allowedBackends,
    minVerification,
    allowedPlatforms,
    requireVendorRoot,
    dataResidency,
  );
  const policyReceipt = await policyTransaction.wait();
  if (!policyReceipt) {
    fail('The policy transaction did not produce a receipt.');
  }

  const owner = await registry.owner();
  const policy = await registry.compliancePolicy();
  const code = await ethers.provider.getCode(address);
  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    fail(`Owner verification failed: got ${owner}, expected ${deployer.address}.`);
  }
  if (code === '0x') {
    fail(`No runtime bytecode was found at ${address}.`);
  }
  if (
    !sameStrings([...policy[0]], allowedBackends) ||
    policy[1] !== minVerification ||
    !sameStrings([...policy[2]], allowedPlatforms) ||
    policy[3] !== requireVendorRoot ||
    !sameStrings([...policy[4]], dataResidency)
  ) {
    fail('Compliance-policy read-back does not match the approved deployment inputs.');
  }

  const manifest = {
    network: network.name,
    chainId: chainId.toString(),
    contract: 'ShioraSealAttestation',
    address,
    owner,
    deploymentTransaction: deploymentTransaction.hash,
    deploymentBlock: deploymentReceipt.blockNumber,
    policyTransaction: policyTransaction.hash,
    policyBlock: policyReceipt.blockNumber,
    policy: {
      allowedBackends: [...policy[0]],
      minVerification: policy[1],
      allowedPlatforms: [...policy[2]],
      requireVendorRoot: policy[3],
      dataResidency: [...policy[4]],
    },
  };

  console.log('\nDeployment manifest (retain with the release record):');
  console.log(JSON.stringify(manifest, null, 2));
  console.log(
    '\nThe application audit-anchor variables remain unset. ' +
      'This attestation registry is not an audit-anchor receiver.',
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
