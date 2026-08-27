// ============================================================
// Shiora on Aethelred — Hardware attestation verification (public surface)
// ============================================================

export type {
  AttestationDocument,
  AttestationFailure,
  AttestationPlatform,
  AttestationPolicy,
  AttestationResult,
} from './types';
export { verifyAttestation, attestationReference } from './verifier';
export {
  registerTrustRoot,
  loadTrustRootsFromEnv,
  getTrustRoots,
  clearTrustRootsForTests,
} from './trust-roots';
export { verifyCertChain, parseCertBundle } from './x509-chain';
export { parseSnpReport, verifySnpSignature, SNP_LAYOUT } from './snp-report';
