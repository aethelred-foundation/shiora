# Attestation test PKI — TEST FIXTURES ONLY

These ECDSA-P384 certificates and private keys are **test-only** fixtures for
the attestation verifier unit tests. They mirror the AMD SEV-SNP trust chain
(ARK root → ASK intermediate → VCEK leaf) plus a `rogue` untrusted root.

They are NOT secrets and are NOT used in production. Production pins AMD's
published ARK via `registerTrustRoot()` / `SHIORA_ATTEST_ROOT_AMD_SEV_SNP`.

Regenerate with: `bash scripts/gen-attestation-test-pki.sh`
