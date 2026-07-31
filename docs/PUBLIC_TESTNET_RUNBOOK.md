# Shiora Public-Testnet Fresh-Install Runbook

This is the canonical operator procedure for a fresh Shiora deployment on the
Aethelred public testnet. Pin the exact release commit supplied by the release
owner; do not deploy from an unreviewed branch tip.

## 1. Supported scope and hard stops

The supported deployment has exactly two independently operated parts:

1. One non-upgradeable `ShioraSealAttestation` contract on EVM chain `7332`.
2. One Next.js process serving both the Shiora web application and all `/api/*`
   routes on internal port `3001`.

Only `contracts/seal/ShioraSealAttestation.sol` is supported. The contracts
under `contracts/core/`, `contracts/privacy/`, and `contracts/defi/` are
historical design artifacts: they are untested, unwired, and **out of scope**.
Do not compile or deploy them as part of this ceremony. The Hardhat project
enforces this boundary with `paths.sources = "./seal"`.

L1 audit anchoring is also out of scope for this public-testnet deployment.
There is no dedicated, ABI-compatible audit-anchor receiver yet. Leave
`SHIORA_L1_RPC_URL`, `SHIORA_L1_ANCHOR_FROM`, `SHIORA_L1_ANCHOR_TO`, and
`SHIORA_L1_CHAIN_ID` blank. `ShioraSealAttestation` is an attestation registry,
not an audit-anchor receiver; **never point `SHIORA_L1_ANCHOR_TO` at it**.
Until a dedicated target is implemented and reviewed, audit roots remain in
the local hash-chained/WORM outbox and are reported honestly as `local`.

No contract address is required by the current application runtime. Record the
attestation contract address in the deployment manifest, not in `.env.local`.

## 2. Required operator inputs

Obtain and approve these values before starting:

| Input                 | Requirement                                                                                                                 |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Release commit        | Exact 40-character SHA on `shiora/production-completion`                                                                    |
| EVM RPC               | HTTPS Aethelred public-testnet JSON-RPC endpoint                                                                            |
| Consensus RPC         | `tcp://host:26657` endpoint for read-only parameter checks                                                                  |
| Deployer              | Fresh funded testnet EVM account; private key held only for the contract ceremony                                           |
| CEAP policy           | Approved confidentiality backend(s), residency code(s), platform restrictions, verification floor, and vendor-root decision |
| Application origin    | Exact HTTPS browser origin; no wildcard                                                                                     |
| Administrative wallet | At least one `0x` address for `SHIORA_ADMIN_ADDRESSES`                                                                      |
| Postgres              | Reachable Postgres 14+ instance; remote connections require certificate-protected TLS                                       |

Do not use real patient data in the evaluation deployment. Vault Transit,
production TLS controls, and the external security gate remain prerequisites
for a live-data production launch.

## 3. Fresh checkout and release verification

```bash
git clone --branch shiora/production-completion --single-branch \
  https://github.com/aethelred-foundation/shiora.git
cd shiora

git fetch origin shiora/production-completion
git checkout --detach <approved-release-sha>
test "$(git rev-parse HEAD)" = "<approved-release-sha>"
test -z "$(git status --porcelain)"

node --version
npm --version
```

Use Node.js 20.x. Keep the checkout detached at the approved SHA on the
deployment host.

## 4. Read-only chain prerequisites

Set the two public endpoints in the operator shell:

```bash
export AETHELRED_TESTNET_RPC_URL=https://<public-testnet-evm-rpc>
export AETHELRED_CONSENSUS_RPC=tcp://<public-testnet-consensus-host>:26657
```

Verify the EVM chain ID is `7332` (`0x1ca4`):

```bash
curl -fsS -X POST "$AETHELRED_TESTNET_RPC_URL" \
  -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' \
  | jq -e '.result == "0x1ca4"'
```

Verify the ISeal precompile (`0x0900`) is active:

```bash
aethelredd query evm params \
  --node "$AETHELRED_CONSENSUS_RPC" \
  --output json \
  | jq -e '
      .params.active_static_precompiles
      | index("0x0000000000000000000000000000000000000900") != null
    '
```

Stop if either command fails. Contract deployment without active ISeal would
produce an unusable attestation registry.

## 5. Contract install, validation, and deployment

The contract ceremony uses a deployment-only environment. It must never share
the application runtime file.

```bash
cd contracts
npm ci
npm run compile
npm test

cp .env.public-testnet.example .env.public-testnet
chmod 600 .env.public-testnet
```

Edit `.env.public-testnet` and replace every placeholder:

```dotenv
AETHELRED_TESTNET_RPC_URL=https://<public-testnet-evm-rpc>
SHIORA_DEPLOYER_PRIVATE_KEY=0x<funded-testnet-private-key>
SHIORA_CEAP_ALLOWED_BACKENDS=<approved-confidentiality-backend>
SHIORA_CEAP_DATA_RESIDENCY=<approved-residency-code>
SHIORA_CEAP_MIN_VERIFICATION=
SHIORA_CEAP_ALLOWED_PLATFORMS=
SHIORA_CEAP_REQUIRE_VENDOR_ROOT=false
```

`SHIORA_CEAP_ALLOWED_BACKENDS` and `SHIORA_CEAP_DATA_RESIDENCY` are required
comma-separated lists. Do not guess them: they must match what the public
testnet can seal and what the compliance owner approved.

Review the diff and source the values only for the ceremony:

```bash
if grep -n '[<>]' .env.public-testnet; then
  echo "STOP: replace every template placeholder before deployment" >&2
  exit 1
fi

set -a
. ./.env.public-testnet
set +a

set -o pipefail
npm run deploy:public-testnet | tee "shiora-seal-deployment-$(date -u +%Y%m%dT%H%M%SZ).json.log"
```

This command deliberately sends two transactions: contract creation followed
by `setCompliancePolicy`. It refuses to proceed unless the RPC reports chain
`7332`, the deployer is funded, all required policy inputs are non-placeholder
values, the deployed address contains bytecode, and the owner read-back matches
the deployer.

Retain the printed manifest with the release record. It contains:

- contract address and owner;
- deployment and policy transaction hashes and block numbers;
- chain ID;
- the policy read back from the deployed contract.

The deployer is the initial `Ownable2Step` owner. Any later governance transfer
is a separate reviewed two-party ceremony: the current owner calls
`transferOwnership`, then the intended owner calls `acceptOwnership`. Do not
discard the deployment key until policy verification and any approved transfer
have completed. Remove the deployment env from the host afterward:

```bash
unset SHIORA_DEPLOYER_PRIVATE_KEY
rm -- .env.public-testnet
cd ..
```

Retain the deployment manifest, not the private key. If the deployment key is
kept for an approved ownership-transfer ceremony, keep it only in the approved
secret-management system.

No `core`, `privacy`, or `defi` deployment command belongs in this runbook.

## 6. Postgres for a single-host evaluation

Skip this subsection when a managed Postgres URL has already been supplied.
For a fresh single-host evaluation, bind Postgres only to loopback:

```bash
export SHIORA_POSTGRES_PASSWORD="$(openssl rand -hex 32)"
docker volume create shiora-postgres-data
docker run -d \
  --name shiora-postgres \
  --restart unless-stopped \
  -p 127.0.0.1:5432:5432 \
  -v shiora-postgres-data:/var/lib/postgresql/data \
  -e POSTGRES_USER=shiora \
  -e POSTGRES_PASSWORD="$SHIORA_POSTGRES_PASSWORD" \
  -e POSTGRES_DB=shiora \
  postgres:16-alpine

docker exec shiora-postgres pg_isready -U shiora -d shiora
```

Persist the generated password in the approved secrets store before closing
the shell. It is hexadecimal and can be used directly in the local Postgres
URL.

## 7. Combined application/API environment

Install the root application dependencies and create the runtime file:

```bash
npm ci
cp .env.public-testnet.example .env.local
chmod 600 .env.local

openssl rand -hex 48
openssl rand -hex 32
```

Put the first generated value in `SHIORA_SESSION_SECRET` and the second in
`SHIORA_DATA_ENCRYPTION_KEY`. Replace every remaining placeholder in
`.env.local`. For the single-host Postgres example:

```dotenv
NODE_ENV=production
PORT=3001
SHIORA_PREFLIGHT_MODE=evaluation
SHIORA_PROFILE=pilot

SHIORA_SESSION_SECRET=<fresh-96-hex-character-value>
SHIORA_ALLOWED_ORIGINS=https://<public-testnet-app-host>
SHIORA_SESSION_TTL_HOURS=24
SHIORA_ENABLE_HSTS=true
SHIORA_ALLOW_INSECURE_WALLET_HEADER=false
SHIORA_TRUSTED_PROXY_COUNT=1

DATABASE_URL=postgresql://shiora:<postgres-password>@127.0.0.1:5432/shiora
SHIORA_AUTO_MIGRATE=true
SHIORA_DATA_ENCRYPTION_KEY=<fresh-64-hex-character-value>
SHIORA_DATA_ENCRYPTION_KEY_VERSION=1
SHIORA_ADMIN_ADDRESSES=<administrative-wallet-address>

SHIORA_L1_RPC_URL=
SHIORA_L1_ANCHOR_FROM=
SHIORA_L1_ANCHOR_TO=
SHIORA_L1_CHAIN_ID=
```

The block above is the preferred TLS-terminated layout. If the evaluation is
temporarily exposed directly on its IP address without a reverse proxy, use
the exact browser origin instead:

```dotenv
SHIORA_ALLOWED_ORIGINS=http://<public-testnet-ip>:3001
SHIORA_ENABLE_HSTS=false
SHIORA_TRUSTED_PROXY_COUNT=0
```

That direct-IP profile is allowed only with
`SHIORA_PREFLIGHT_MODE=evaluation`, synthetic data, and no live PHI. The
configuration linter reports the plaintext origin as an explicitly
acknowledged evaluation finding; it remains a blocking error in production
mode. Never put both an invented HTTPS origin and the actual HTTP origin in
the file merely to make the linter pass: browser mutations are accepted only
when the incoming `Origin` matches `SHIORA_ALLOWED_ORIGINS` exactly.

Before loading the file, confirm no template marker remains:

```bash
if grep -n '[<>]' .env.local; then
  echo "STOP: replace every template placeholder before application setup" >&2
  exit 1
fi
```

The local key path above is evaluation-only and must not custody real patient
data. A live-data production environment replaces it with scoped Vault Transit
values documented in [KEY_MANAGEMENT.md](KEY_MANAGEMENT.md).

There is no separate backend service, backend port, or API base URL. The same
Next.js process serves the browser application and `/api/*` routes on `3001`;
the browser uses same-origin relative API paths.

## 8. Configuration gate, build, and service start

Load the runtime file into the shell for the standalone linter:

```bash
set -a
. ./.env.local
set +a

npm run config:lint
npm run type-check
npm run build
```

Before starting the service, verify that the origin the US team will open is
present verbatim in the loaded allowlist:

```bash
export SHIORA_PUBLIC_ORIGIN=http://<public-testnet-ip>:3001
node -e 'const allowed=(process.env.SHIORA_ALLOWED_ORIGINS||"").split(",").map(v=>v.trim()); if(!allowed.includes(process.env.SHIORA_PUBLIC_ORIGIN)){console.error("STOP: browser origin is not in SHIORA_ALLOWED_ORIGINS"); process.exit(1)}; console.log("origin allowlist: OK")'
```

The build creates and prepares `.next/standalone`. The supported start command
is `npm run start:standalone`, not `next start`.

For a foreground smoke test:

```bash
PORT=3001 npm run start:standalone
```

For systemd, first edit `User`, `WorkingDirectory`, and `ExecStart` in
`deploy/systemd/shiora.service`, then install it:

```bash
sudo cp deploy/systemd/shiora.service /etc/systemd/system/shiora.service
sudo systemctl daemon-reload
sudo systemctl enable --now shiora
sudo systemctl status shiora --no-pager
journalctl -u shiora -n 200 --no-pager
```

Terminate public TLS at the reverse proxy and forward to
`http://127.0.0.1:3001`. Do not run a second API process or select an ad-hoc
application port.

## 9. Acceptance checks

Run these from the application host:

```bash
curl -fsS http://127.0.0.1:3001/api/health/live | jq
curl -fsS http://127.0.0.1:3001/api/health/ready | jq
curl -fsS http://127.0.0.1:3001/api/system/release | jq
curl -fsS http://127.0.0.1:3001/api/system/status | jq
```

Verify:

- liveness is healthy;
- readiness reports `mode: "evaluation"` and lists any acknowledged
  infrastructure gaps explicitly;
- the reported release SHA equals the approved commit;
- the active profile is `pilot`;
- schema migrations completed and a restart preserves data;
- the browser origin connects through HTTPS;
- for a direct-IP evaluation, the exact `http://<ip>:3001` browser origin is
  allowlisted and readiness reports `TRANSPORT_NOT_HARDENED` as acknowledged;
- the wallet reports chain `7332`;
- contract manifest owner and CEAP policy match the approved values;
- all L1 audit-anchor variables remain blank and anchor receipts remain
  `local`.

## 10. Report back

Return these items to the release owner:

1. checked-out commit SHA and clean-worktree confirmation;
2. Node/npm versions;
3. app build result and health/readiness output;
4. contract address, owner, policy read-back, transaction hashes, and block
   numbers from the manifest;
5. `eth_chainId` and active-precompile check output;
6. public HTTPS origin and internal service port (`3001`);
7. confirmation that `core`, `privacy`, and `defi` contracts were not deployed;
8. confirmation that L1 audit anchoring is disabled and the attestation registry
   was not used as `SHIORA_L1_ANCHOR_TO`.

Stop and escalate if any required RPC, funding, policy, governance, origin,
database, or administrative-wallet input is missing. Do not substitute a
guessed value.
