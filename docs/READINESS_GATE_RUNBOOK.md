# Readiness gate runbook — closing the four acknowledged gates

`GET /api/health/ready` reports `checks.config` with a `mode`, a fatal
`problems[]` list, and an `acknowledged[]` list. A pilot deployment currently
reports:

```json
{ "ok": true, "enforced": true, "mode": "evaluation", "problems": [],
  "acknowledged": [
    { "code": "KEY_CUSTODY_NOT_TRANSIT" },
    { "code": "TRANSPORT_NOT_HARDENED" },
    { "code": "INSECURE_ORIGIN" },
    { "code": "NON_TLS_BACKEND" }
  ] }
```

That output is **passing, not degraded**. `evaluation` mode is an explicit
operator statement that the deployment does not custody real PHI, and it
downgrades exactly five infrastructure gates to acknowledged warnings
(`src/lib/api/preflight.ts`, `EVALUATION_ACKNOWLEDGEABLE`). Everything
genuinely dangerous — development crypto keys, placeholder secrets, auth
bypasses, wildcard origins, any mainnet RPC target — stays fatal in every mode.

Two rules govern the rest of this document:

- **Do not set `SHIORA_PREFLIGHT_MODE=production` until all four gates below
  are satisfied.** In `production` mode each one is fatal and the service will
  refuse to start — which is the intended behaviour, not a bug to work around.
- **Do not load real patient data while any gate is acknowledged.** Pilot and
  synthetic data only.

---

## Gate 1 — `TRANSPORT_NOT_HARDENED`

**Condition** (`preflight.ts`): fires when `serverEnv.enableHsts` is false.

**Why it matters:** without HSTS a client that reaches the host over plaintext
once can be kept on plaintext. PHI must only ever traverse TLS.

**Close it:** terminate TLS at a reverse proxy, then set

```
SHIORA_ENABLE_HSTS=true
```

Only enable this once TLS actually works. HSTS instructs browsers to refuse
plaintext for the max-age window; turning it on before certificates are valid
locks users out of the site until the header expires.

## Gate 2 — `INSECURE_ORIGIN`

**Condition** (`config-lint.ts`): any entry in `SHIORA_ALLOWED_ORIGINS` that
starts with `http://` **and** is not localhost. `isLocalhost` accepts exactly
`localhost`, `127.0.0.1`, and `::1`.

**Close it:** every browser-facing origin must be `https://`.

```
SHIORA_ALLOWED_ORIGINS=https://shiora.example.org
```

Localhost origins are exempt by design, so a developer tunnel
(`http://localhost:3001`) never trips this gate.

## Gate 3 — `NON_TLS_BACKEND`

**Condition** (`config-lint.ts`): `SHIORA_VAULT_ADDR` or `SHIORA_L1_RPC_URL`
begins with `http://` pointing at a non-local host.

There are two legitimate ways to close this, and the right one depends on
where the backend runs:

**3a — backend on the same host.** If the Aethelred node runs on the same
machine as the app, address it over loopback. The traffic never touches a
network, and the gate is satisfied honestly rather than bypassed:

```
SHIORA_L1_RPC_URL=http://127.0.0.1:8545
```

**3b — backend on another host.** Put TLS in front of the node and use it:

```
SHIORA_L1_RPC_URL=https://rpc.internal.example.org
```

Do not use `3a` to paper over a genuinely remote backend — if the RPC is on a
different machine, plaintext across that hop is exactly what this gate exists
to catch.

## Gate 4 — `KEY_CUSTODY_NOT_TRANSIT` — the real one

**Condition:** Vault Transit DEK custody is not configured
(`SHIORA_TRANSIT_KEY_NAME` plus `SHIORA_VAULT_ADDR` / `SHIORA_VAULT_TOKEN`).

The other three gates are configuration. This one is a control. Without it the
key-encryption key lives in application memory via the local development
backend, so any process-memory disclosure exposes every data key, and key
rotation and revocation have no authoritative home.

The application already implements the Vault Transit path — it simply is not
configured on the pilot host. Closing it requires a real Vault (or equivalent
KMS/HSM), not a code change:

```
SHIORA_VAULT_ADDR=https://vault.internal.example.org
SHIORA_VAULT_TOKEN=<issued to the app's identity, least privilege>
SHIORA_TRANSIT_KEY_NAME=shiora-phi-kek
```

See `docs/KEY_MANAGEMENT.md` for the custody model and rotation procedure.

**This is the gate that must close before any real PHI reaches the system.**

---

## Verification

After applying the changes, restart the service and re-read the gate. The
acknowledged list should shrink as each item is satisfied:

```bash
curl -fsS https://<host>/api/health/ready | jq '.data.checks.config'
```

Confirm TLS and HSTS independently of the app's own opinion:

```bash
curl -sSI https://<host>/ | grep -i strict-transport-security
curl -sS  http://<host>/  -o /dev/null -w '%{http_code} %{redirect_url}\n'
```

The first must return a `Strict-Transport-Security` header; the second must
redirect to `https://`.

Once `acknowledged` is empty, and only then, promote the deployment:

```
SHIORA_PREFLIGHT_MODE=production
```

If anything is still outstanding the service will refuse to start and name the
offending gate — that refusal is the control working.
