#!/usr/bin/env bash
# ============================================================
# Generates a REAL ECDSA-P384 test PKI mirroring the AMD SEV-SNP trust chain
# (ARK root -> ASK intermediate -> VCEK leaf) for the attestation-verifier unit
# tests. These are TEST fixtures only — production pins AMD's published ARK via
# registerTrustRoot()/SHIORA_ATTEST_ROOT_AMD_SEV_SNP. Re-run to regenerate.
#
#   bash scripts/gen-attestation-test-pki.sh
# ============================================================
set -euo pipefail

OUT="src/lib/attestation/__testpki__"
mkdir -p "$OUT"
cd "$OUT"

DAYS=29219 # ~80 years, so the "valid" fixtures never age out of the test window

curve="-name secp384r1"

# --- ARK (self-signed root) ---
openssl ecparam $curve -genkey -noout -out ark.key
openssl req -x509 -new -key ark.key -sha384 -subj "/CN=Shiora Test ARK" \
  -days "$DAYS" -addext "basicConstraints=critical,CA:TRUE" -out ark.crt

# --- ASK (intermediate, issued by ARK) ---
openssl ecparam $curve -genkey -noout -out ask.key
openssl req -new -key ask.key -subj "/CN=Shiora Test ASK" -out ask.csr
openssl x509 -req -in ask.csr -CA ark.crt -CAkey ark.key -sha384 \
  -CAcreateserial -days "$DAYS" \
  -extfile <(printf "basicConstraints=critical,CA:TRUE") -out ask.crt

# --- VCEK (leaf, issued by ASK) ---
openssl ecparam $curve -genkey -noout -out vcek.key
openssl req -new -key vcek.key -subj "/CN=Shiora Test VCEK" -out vcek.csr
openssl x509 -req -in vcek.csr -CA ask.crt -CAkey ask.key -sha384 \
  -CAcreateserial -days "$DAYS" \
  -extfile <(printf "basicConstraints=critical,CA:FALSE") -out vcek.crt

# NOTE: expiry / not-yet-valid are tested by injecting a clock into the verifier
# (a future/past `now`), so no separate expired fixture is generated — this keeps
# the fixtures stable and OpenSSL-version independent.

# --- ROGUE (independent self-signed root — an untrusted chain anchor) ---
openssl ecparam $curve -genkey -noout -out rogue.key
openssl req -x509 -new -key rogue.key -sha384 -subj "/CN=Rogue Root" \
  -days "$DAYS" -addext "basicConstraints=critical,CA:TRUE" -out rogue.crt

rm -f ./*.csr ./*.srl
echo "Generated test PKI in $OUT"
