const { expect } = require('chai');
const { ethers, network } = require('hardhat');
const { loadFixture, setCode } = require('@nomicfoundation/hardhat-network-helpers');

/**
 * ShioraSealAttestation — consensus-anchored clinical/consent attestation.
 *
 * The ISeal precompile lives at a fixed address (0x0900) on Aethelred, so the
 * suite installs MockISeal's runtime bytecode there with setCode. NOTE: setCode
 * wipes storage — mock seals must be (re)populated AFTER the code is installed.
 * The REAL precompile binding (real seal keeper, vendored bytecode, live
 * revocation) is proven in the aethelred repo's evmhost test. No PHI appears
 * anywhere: attestations bind a subject address + a scope hash only.
 */
describe('ShioraSealAttestation', function () {
  const SEAL_PRECOMPILE = '0x0000000000000000000000000000000000000900';
  const JOB = 'job-clinical-001';
  const SEAL_ID = 'a'.repeat(64);

  const scope = ethers.keccak256(ethers.toUtf8Bytes('clinical:cycle_prediction'));
  const otherScope = ethers.keccak256(ethers.toUtf8Bytes('clinical:condition_flag'));

  const purposeFor = (subject, s) => `shiora:${subject.toLowerCase()}:${s.toLowerCase()}`;

  async function deployFixture() {
    const [governance, subject, provider, stranger] = await ethers.getSigners();

    const MockISeal = await ethers.getContractFactory('MockISeal');
    const deployed = await MockISeal.deploy();
    await deployed.waitForDeployment();
    const runtime = await ethers.provider.getCode(await deployed.getAddress());
    await setCode(SEAL_PRECOMPILE, runtime);
    const seal = MockISeal.attach(SEAL_PRECOMPILE);
    await seal.setPolicyResult(true, '');

    const Registry = await ethers.getContractFactory('ShioraSealAttestation');
    const registry = await Registry.deploy(governance.address);
    await registry.waitForDeployment();

    return { registry, seal, governance, subject, provider, stranger };
  }

  async function mintSeal(seal, subject, s, { job = JOB, sealId = SEAL_ID, active = true } = {}) {
    await seal.setSeal(job, sealId, purposeFor(subject.address, s), active);
  }

  describe('anchoring', function () {
    it('anchors a bound, active, policy-satisfying attestation (permissionless)', async function () {
      const { registry, seal, subject, stranger } = await loadFixture(deployFixture);
      await mintSeal(seal, subject, scope);
      expect(await registry.isAttested(subject.address, scope)).to.equal(false);

      // A relayer (stranger) can anchor — the seal's purpose binds the subject.
      await expect(registry.connect(stranger).attest(subject.address, scope, JOB))
        .to.emit(registry, 'AttestationAnchored')
        .withArgs(subject.address, scope, SEAL_ID, JOB);

      expect(await registry.isAttested(subject.address, scope)).to.equal(true);
      const rec = await registry.getAttestation(subject.address, scope);
      expect(rec.sealId).to.equal(SEAL_ID);
      expect(rec.exists).to.equal(true);
      expect(rec.revoked).to.equal(false);
    });

    it('rejects a seal bound to a different subject', async function () {
      const { registry, seal, subject, stranger } = await loadFixture(deployFixture);
      await mintSeal(seal, stranger, scope); // bound to stranger, not subject
      await expect(registry.attest(subject.address, scope, JOB)).to.be.revertedWithCustomError(
        registry,
        'SealNotBoundToScope',
      );
    });

    it('rejects a seal bound to a different scope', async function () {
      const { registry, seal, subject } = await loadFixture(deployFixture);
      await mintSeal(seal, subject, otherScope); // bound to otherScope
      await expect(registry.attest(subject.address, scope, JOB)).to.be.revertedWithCustomError(
        registry,
        'SealNotBoundToScope',
      );
    });

    it('rejects a seal that fails the CEAP compliance policy', async function () {
      const { registry, seal, subject } = await loadFixture(deployFixture);
      await mintSeal(seal, subject, scope);
      await seal.setPolicyResult(false, 'backend not permitted');
      await expect(registry.attest(subject.address, scope, JOB))
        .to.be.revertedWithCustomError(registry, 'PolicyNotSatisfied')
        .withArgs('backend not permitted');
    });

    it('rejects an inactive (revoked/expired) seal', async function () {
      const { registry, seal, subject } = await loadFixture(deployFixture);
      await mintSeal(seal, subject, scope, { active: false });
      await expect(registry.attest(subject.address, scope, JOB)).to.be.revertedWithCustomError(
        registry,
        'SealNotActive',
      );
    });

    it('rejects seal replay across (subject, scope) pairs', async function () {
      const { registry, seal, subject } = await loadFixture(deployFixture);
      await mintSeal(seal, subject, scope);
      await registry.attest(subject.address, scope, JOB);

      await seal.setSeal('job-2', SEAL_ID, purposeFor(subject.address, otherScope), true);
      await expect(
        registry.attest(subject.address, otherScope, 'job-2'),
      ).to.be.revertedWithCustomError(registry, 'SealAlreadyUsed');
    });

    it('rejects a zero scope', async function () {
      const { registry, subject } = await loadFixture(deployFixture);
      await expect(
        registry.attest(subject.address, ethers.ZeroHash, JOB),
      ).to.be.revertedWithCustomError(registry, 'ZeroScope');
    });

    it('one (subject, scope), one attestation: a live record cannot be overwritten', async function () {
      const { registry, seal, subject } = await loadFixture(deployFixture);
      await mintSeal(seal, subject, scope);
      await registry.attest(subject.address, scope, JOB);
      const before = await registry.getAttestation(subject.address, scope);

      await seal.setSeal('job-dup', 'c'.repeat(64), purposeFor(subject.address, scope), true);
      await expect(registry.attest(subject.address, scope, 'job-dup'))
        .to.be.revertedWithCustomError(registry, 'AlreadyAttested')
        .withArgs(subject.address, scope);

      const after = await registry.getAttestation(subject.address, scope);
      expect(after.sealId).to.equal(before.sealId);
      expect(after.attestedAt).to.equal(before.attestedAt);
    });

    it('SECURITY: a revocation cannot be undone by re-attesting with a fresh seal', async function () {
      const { registry, seal, governance, subject, stranger } = await loadFixture(deployFixture);
      await mintSeal(seal, subject, scope);
      await registry.attest(subject.address, scope, JOB);
      await registry.connect(governance).revoke(subject.address, scope);
      expect(await registry.isAttested(subject.address, scope)).to.equal(false);

      await seal.setSeal('job-fresh', 'd'.repeat(64), purposeFor(subject.address, scope), true);
      await expect(
        registry.connect(stranger).attest(subject.address, scope, 'job-fresh'),
      ).to.be.revertedWithCustomError(registry, 'AlreadyAttested');

      expect(await registry.isAttested(subject.address, scope)).to.equal(false);
      expect((await registry.getAttestation(subject.address, scope)).revoked).to.equal(true);
    });
  });

  describe('live consensus revocation', function () {
    it('an attestation goes invalid the moment the chain revokes the seal — no Shiora tx', async function () {
      const { registry, seal, subject } = await loadFixture(deployFixture);
      await mintSeal(seal, subject, scope);
      await registry.attest(subject.address, scope, JOB);
      expect(await registry.isAttested(subject.address, scope)).to.equal(true);

      await seal.setActive(SEAL_ID, false); // consensus-side revocation
      expect(await registry.isAttested(subject.address, scope)).to.equal(false);
      await expect(registry.requireAttested(subject.address, scope)).to.be.revertedWithCustomError(
        registry,
        'NoSuchAttestation',
      );
    });
  });

  describe('revocation', function () {
    it('the subject can self-revoke (e.g. consent withdrawal)', async function () {
      const { registry, seal, subject } = await loadFixture(deployFixture);
      await mintSeal(seal, subject, scope);
      await registry.attest(subject.address, scope, JOB);

      await expect(registry.connect(subject).revoke(subject.address, scope))
        .to.emit(registry, 'AttestationRevoked')
        .withArgs(subject.address, scope, subject.address);
      expect(await registry.isAttested(subject.address, scope)).to.equal(false);
    });

    it('governance can revoke', async function () {
      const { registry, seal, governance, subject } = await loadFixture(deployFixture);
      await mintSeal(seal, subject, scope);
      await registry.attest(subject.address, scope, JOB);
      await expect(registry.connect(governance).revoke(subject.address, scope)).to.emit(
        registry,
        'AttestationRevoked',
      );
    });

    it('a stranger cannot revoke', async function () {
      const { registry, seal, subject, stranger } = await loadFixture(deployFixture);
      await mintSeal(seal, subject, scope);
      await registry.attest(subject.address, scope, JOB);
      await expect(
        registry.connect(stranger).revoke(subject.address, scope),
      ).to.be.revertedWithCustomError(registry, 'NotSubjectOrOwner');
    });

    it('revoking a non-existent attestation reverts', async function () {
      const { registry, governance, subject } = await loadFixture(deployFixture);
      await expect(
        registry.connect(governance).revoke(subject.address, scope),
      ).to.be.revertedWithCustomError(registry, 'NoSuchAttestation');
    });
  });

  describe('governance', function () {
    it('only owner can set the compliance policy', async function () {
      const { registry, governance, stranger } = await loadFixture(deployFixture);
      await expect(
        registry.connect(stranger).setCompliancePolicy(['fhe'], '', [], false, ['EU']),
      ).to.be.revertedWithCustomError(registry, 'OwnableUnauthorizedAccount');

      await registry.connect(governance).setCompliancePolicy(['fhe'], '', [], false, ['EU']);
      const policy = await registry.compliancePolicy();
      expect(policy[0]).to.deep.equal(['fhe']);
      expect(policy[4]).to.deep.equal(['EU']);
    });

    it('ownership transfer is two-step; non-pending acceptor rejected', async function () {
      const { registry, governance, subject, stranger } = await loadFixture(deployFixture);
      await registry.connect(governance).transferOwnership(subject.address);
      expect(await registry.owner()).to.equal(governance.address); // not yet

      await expect(registry.connect(stranger).acceptOwnership()).to.be.revertedWithCustomError(
        registry,
        'OwnableUnauthorizedAccount',
      );
      await registry.connect(subject).acceptOwnership();
      expect(await registry.owner()).to.equal(subject.address);
    });

    it('pause blocks anchoring but verification stays live; owner-only both ways', async function () {
      const { registry, seal, governance, subject, stranger } = await loadFixture(deployFixture);
      await mintSeal(seal, subject, scope);
      await registry.attest(subject.address, scope, JOB);

      await expect(registry.connect(stranger).pause()).to.be.revertedWithCustomError(
        registry,
        'OwnableUnauthorizedAccount',
      );
      await registry.connect(governance).pause();

      await seal.setSeal('job-2', 'b'.repeat(64), purposeFor(subject.address, otherScope), true);
      await expect(
        registry.attest(subject.address, otherScope, 'job-2'),
      ).to.be.revertedWithCustomError(registry, 'EnforcedPause');

      // Reads unaffected while paused.
      expect(await registry.isAttested(subject.address, scope)).to.equal(true);

      await expect(registry.connect(stranger).unpause()).to.be.revertedWithCustomError(
        registry,
        'OwnableUnauthorizedAccount',
      );
      await registry.connect(governance).unpause();
      await registry.attest(subject.address, otherScope, 'job-2');
      expect(await registry.isAttested(subject.address, otherScope)).to.equal(true);
    });
  });

  describe('helpers', function () {
    it('expectedPurpose returns the canonical binding string', async function () {
      const { registry, subject } = await loadFixture(deployFixture);
      expect(await registry.expectedPurpose(subject.address, scope)).to.equal(
        purposeFor(subject.address, scope),
      );
    });

    it('requireAttested passes silently for a live attestation (hard-gate success path)', async function () {
      const { registry, seal, subject } = await loadFixture(deployFixture);
      await mintSeal(seal, subject, scope);
      await registry.attest(subject.address, scope, JOB);
      await registry.requireAttested(subject.address, scope); // must not revert
    });

    it('getAttestation on an unknown record returns an empty struct', async function () {
      const { registry, subject } = await loadFixture(deployFixture);
      const rec = await registry.getAttestation(subject.address, scope);
      expect(rec.exists).to.equal(false);
      expect(rec.revoked).to.equal(false);
      expect(rec.sealId).to.equal('');
      expect(rec.attestedAt).to.equal(0);
    });

    it('compliancePolicy starts empty (any backend/jurisdiction) until set', async function () {
      const { registry } = await loadFixture(deployFixture);
      const policy = await registry.compliancePolicy();
      expect(policy[0]).to.deep.equal([]);
      expect(policy[1]).to.equal('');
      expect(policy[2]).to.deep.equal([]);
      expect(policy[3]).to.equal(false);
      expect(policy[4]).to.deep.equal([]);
    });
  });
});
