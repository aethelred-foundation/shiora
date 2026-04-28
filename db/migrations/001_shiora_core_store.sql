-- Shiora regulated persistence baseline.
-- Target: PostgreSQL 15+ with encrypted volumes, point-in-time recovery,
-- database audit logging, and a least-privilege application role.

BEGIN;

CREATE TABLE IF NOT EXISTS shiora_schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  checksum_sha256 TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shiora_health_records (
  id TEXT PRIMARY KEY,
  owner_address TEXT NOT NULL,
  record_type TEXT NOT NULL,
  provider TEXT,
  encrypted BOOLEAN NOT NULL DEFAULT TRUE,
  encryption TEXT NOT NULL DEFAULT 'AES-256-GCM',
  cid TEXT,
  tx_hash TEXT,
  attestation TEXT,
  status TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  deleted BOOLEAN NOT NULL DEFAULT FALSE,
  payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT shiora_health_records_owner_not_blank CHECK (length(trim(owner_address)) > 0),
  CONSTRAINT shiora_health_records_status_known CHECK (
    status IN ('Pending', 'Verified', 'Processing', 'Pinning', 'Pinned', 'Failed')
  ),
  CONSTRAINT shiora_health_records_payload_no_plaintext_phi CHECK (
    NOT (payload ?| ARRAY['label', 'description', 'patientName', 'notes'])
  )
);

CREATE INDEX IF NOT EXISTS idx_shiora_health_records_owner_live
  ON shiora_health_records (owner_address, deleted, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_shiora_health_records_cid
  ON shiora_health_records (cid)
  WHERE cid IS NOT NULL;

CREATE TABLE IF NOT EXISTS shiora_access_grants (
  id TEXT PRIMARY KEY,
  owner_address TEXT NOT NULL,
  provider_address TEXT NOT NULL,
  provider_name TEXT,
  specialty TEXT,
  status TEXT NOT NULL,
  scope TEXT NOT NULL,
  granted_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL,
  last_access BIGINT,
  access_count INTEGER NOT NULL DEFAULT 0,
  can_view BOOLEAN NOT NULL DEFAULT TRUE,
  can_download BOOLEAN NOT NULL DEFAULT FALSE,
  can_share BOOLEAN NOT NULL DEFAULT FALSE,
  tx_hash TEXT,
  attestation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT shiora_access_grants_status_known CHECK (
    status IN ('Pending', 'Active', 'Expired', 'Revoked')
  ),
  CONSTRAINT shiora_access_grants_expiry_valid CHECK (expires_at > granted_at),
  CONSTRAINT shiora_access_grants_access_count_nonnegative CHECK (access_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_shiora_access_grants_owner_status
  ON shiora_access_grants (owner_address, status, expires_at DESC);

CREATE INDEX IF NOT EXISTS idx_shiora_access_grants_provider
  ON shiora_access_grants (provider_address, status);

CREATE TABLE IF NOT EXISTS shiora_consent_grants (
  id TEXT PRIMARY KEY,
  patient_address TEXT NOT NULL,
  provider_address TEXT NOT NULL,
  provider_name TEXT,
  scopes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  status TEXT NOT NULL,
  granted_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL,
  revoked_at BIGINT,
  policy_id TEXT NOT NULL,
  auto_renew BOOLEAN NOT NULL DEFAULT FALSE,
  tx_hash TEXT,
  attestation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT shiora_consent_grants_status_known CHECK (
    status IN ('active', 'expired', 'revoked', 'pending')
  ),
  CONSTRAINT shiora_consent_grants_expiry_valid CHECK (expires_at > granted_at)
);

CREATE INDEX IF NOT EXISTS idx_shiora_consent_grants_patient_status
  ON shiora_consent_grants (patient_address, status, expires_at DESC);

CREATE INDEX IF NOT EXISTS idx_shiora_consent_grants_provider
  ON shiora_consent_grants (provider_address, status);

CREATE TABLE IF NOT EXISTS shiora_marketplace_listings (
  id TEXT PRIMARY KEY,
  seller_address TEXT NOT NULL,
  buyer_address TEXT,
  seller_reputation INTEGER NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  data_points INTEGER NOT NULL,
  date_range_start BIGINT NOT NULL,
  date_range_end BIGINT NOT NULL,
  quality_score INTEGER NOT NULL,
  anonymization_level TEXT NOT NULL,
  price NUMERIC(24, 8) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'AETHEL',
  status TEXT NOT NULL,
  tee_verified BOOLEAN NOT NULL DEFAULT FALSE,
  attestation TEXT,
  created_at_epoch BIGINT NOT NULL,
  expires_at_epoch BIGINT NOT NULL,
  purchase_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT shiora_marketplace_seller_reputation_range CHECK (
    seller_reputation BETWEEN 0 AND 100
  ),
  CONSTRAINT shiora_marketplace_quality_score_range CHECK (quality_score BETWEEN 0 AND 100),
  CONSTRAINT shiora_marketplace_data_points_positive CHECK (data_points > 0),
  CONSTRAINT shiora_marketplace_price_nonnegative CHECK (price >= 0),
  CONSTRAINT shiora_marketplace_purchase_count_nonnegative CHECK (purchase_count >= 0),
  CONSTRAINT shiora_marketplace_status_known CHECK (
    status IN ('active', 'sold', 'expired', 'withdrawn')
  ),
  CONSTRAINT shiora_marketplace_epoch_ranges_valid CHECK (
    date_range_end >= date_range_start AND expires_at_epoch > created_at_epoch
  )
);

CREATE INDEX IF NOT EXISTS idx_shiora_marketplace_status_category
  ON shiora_marketplace_listings (status, category, expires_at_epoch DESC);

CREATE INDEX IF NOT EXISTS idx_shiora_marketplace_seller
  ON shiora_marketplace_listings (seller_address, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_shiora_marketplace_buyer
  ON shiora_marketplace_listings (buyer_address, updated_at DESC)
  WHERE buyer_address IS NOT NULL;

CREATE TABLE IF NOT EXISTS shiora_store_audit_log (
  sequence BIGSERIAL PRIMARY KEY,
  schema_version INTEGER NOT NULL DEFAULT 1,
  operation TEXT NOT NULL,
  owner_address TEXT,
  entity_id TEXT NOT NULL,
  changed_fields TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  tx_hash TEXT,
  previous_hash TEXT NOT NULL,
  entry_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT shiora_store_audit_operation_known CHECK (
    operation IN (
      'record.create',
      'record.update',
      'record.delete',
      'accessGrant.create',
      'accessGrant.update',
      'consent.create',
      'consent.update',
      'marketplace.create',
      'marketplace.update'
    )
  ),
  CONSTRAINT shiora_store_audit_hash_lengths CHECK (
    length(previous_hash) = 64 AND length(entry_hash) = 64
  ),
  CONSTRAINT shiora_store_audit_changed_fields_no_plaintext_phi CHECK (
    NOT (changed_fields && ARRAY['description', 'label', 'notes', 'patientName']::TEXT[])
  )
);

CREATE INDEX IF NOT EXISTS idx_shiora_store_audit_entity
  ON shiora_store_audit_log (entity_id, sequence DESC);

CREATE INDEX IF NOT EXISTS idx_shiora_store_audit_owner
  ON shiora_store_audit_log (owner_address, sequence DESC)
  WHERE owner_address IS NOT NULL;

ALTER TABLE shiora_health_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE shiora_access_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE shiora_consent_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE shiora_marketplace_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE shiora_store_audit_log ENABLE ROW LEVEL SECURITY;

ALTER TABLE shiora_health_records FORCE ROW LEVEL SECURITY;
ALTER TABLE shiora_access_grants FORCE ROW LEVEL SECURITY;
ALTER TABLE shiora_consent_grants FORCE ROW LEVEL SECURITY;
ALTER TABLE shiora_marketplace_listings FORCE ROW LEVEL SECURITY;
ALTER TABLE shiora_store_audit_log FORCE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION shiora_current_wallet()
RETURNS TEXT
LANGUAGE SQL
STABLE
AS $$
  SELECT NULLIF(lower(current_setting('app.wallet_address', true)), '');
$$;

CREATE OR REPLACE FUNCTION shiora_is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
  SELECT coalesce(current_setting('app.is_admin', true), 'false') = 'true';
$$;

CREATE OR REPLACE FUNCTION shiora_guard_marketplace_listing_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF lower(OLD.seller_address) = shiora_current_wallet() OR shiora_is_admin() THEN
    RETURN NEW;
  END IF;

  IF shiora_current_wallet() IS NOT NULL
    AND OLD.status = 'active'
    AND NEW.status = 'sold'
    AND NEW.purchase_count = OLD.purchase_count + 1
    AND OLD.buyer_address IS NULL
    AND lower(NEW.buyer_address) = shiora_current_wallet()
    AND NEW.id IS NOT DISTINCT FROM OLD.id
    AND NEW.seller_address IS NOT DISTINCT FROM OLD.seller_address
    AND NEW.seller_reputation IS NOT DISTINCT FROM OLD.seller_reputation
    AND NEW.category IS NOT DISTINCT FROM OLD.category
    AND NEW.title IS NOT DISTINCT FROM OLD.title
    AND NEW.description IS NOT DISTINCT FROM OLD.description
    AND NEW.data_points IS NOT DISTINCT FROM OLD.data_points
    AND NEW.date_range_start IS NOT DISTINCT FROM OLD.date_range_start
    AND NEW.date_range_end IS NOT DISTINCT FROM OLD.date_range_end
    AND NEW.quality_score IS NOT DISTINCT FROM OLD.quality_score
    AND NEW.anonymization_level IS NOT DISTINCT FROM OLD.anonymization_level
    AND NEW.price IS NOT DISTINCT FROM OLD.price
    AND NEW.currency IS NOT DISTINCT FROM OLD.currency
    AND NEW.tee_verified IS NOT DISTINCT FROM OLD.tee_verified
    AND NEW.attestation IS NOT DISTINCT FROM OLD.attestation
    AND NEW.created_at_epoch IS NOT DISTINCT FROM OLD.created_at_epoch
    AND NEW.expires_at_epoch IS NOT DISTINCT FROM OLD.expires_at_epoch
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Marketplace listing update violates seller or purchase transition policy';
END;
$$;

DROP TRIGGER IF EXISTS shiora_marketplace_listing_update_guard ON shiora_marketplace_listings;
CREATE TRIGGER shiora_marketplace_listing_update_guard
  BEFORE UPDATE ON shiora_marketplace_listings
  FOR EACH ROW
  EXECUTE FUNCTION shiora_guard_marketplace_listing_update();

DROP POLICY IF EXISTS shiora_health_records_owner_select ON shiora_health_records;
CREATE POLICY shiora_health_records_owner_select
  ON shiora_health_records
  FOR SELECT
  USING (lower(owner_address) = shiora_current_wallet() OR shiora_is_admin());

DROP POLICY IF EXISTS shiora_health_records_owner_insert ON shiora_health_records;
CREATE POLICY shiora_health_records_owner_insert
  ON shiora_health_records
  FOR INSERT
  WITH CHECK (lower(owner_address) = shiora_current_wallet() OR shiora_is_admin());

DROP POLICY IF EXISTS shiora_health_records_owner_update ON shiora_health_records;
CREATE POLICY shiora_health_records_owner_update
  ON shiora_health_records
  FOR UPDATE
  USING (lower(owner_address) = shiora_current_wallet() OR shiora_is_admin())
  WITH CHECK (lower(owner_address) = shiora_current_wallet() OR shiora_is_admin());

DROP POLICY IF EXISTS shiora_access_grants_participant_select ON shiora_access_grants;
CREATE POLICY shiora_access_grants_participant_select
  ON shiora_access_grants
  FOR SELECT
  USING (
    lower(owner_address) = shiora_current_wallet()
    OR lower(provider_address) = shiora_current_wallet()
    OR shiora_is_admin()
  );

DROP POLICY IF EXISTS shiora_access_grants_owner_insert ON shiora_access_grants;
CREATE POLICY shiora_access_grants_owner_insert
  ON shiora_access_grants
  FOR INSERT
  WITH CHECK (lower(owner_address) = shiora_current_wallet() OR shiora_is_admin());

DROP POLICY IF EXISTS shiora_access_grants_owner_update ON shiora_access_grants;
CREATE POLICY shiora_access_grants_owner_update
  ON shiora_access_grants
  FOR UPDATE
  USING (lower(owner_address) = shiora_current_wallet() OR shiora_is_admin())
  WITH CHECK (lower(owner_address) = shiora_current_wallet() OR shiora_is_admin());

DROP POLICY IF EXISTS shiora_consent_grants_participant_select ON shiora_consent_grants;
CREATE POLICY shiora_consent_grants_participant_select
  ON shiora_consent_grants
  FOR SELECT
  USING (
    lower(patient_address) = shiora_current_wallet()
    OR lower(provider_address) = shiora_current_wallet()
    OR shiora_is_admin()
  );

DROP POLICY IF EXISTS shiora_consent_grants_patient_insert ON shiora_consent_grants;
CREATE POLICY shiora_consent_grants_patient_insert
  ON shiora_consent_grants
  FOR INSERT
  WITH CHECK (lower(patient_address) = shiora_current_wallet() OR shiora_is_admin());

DROP POLICY IF EXISTS shiora_consent_grants_patient_update ON shiora_consent_grants;
CREATE POLICY shiora_consent_grants_patient_update
  ON shiora_consent_grants
  FOR UPDATE
  USING (lower(patient_address) = shiora_current_wallet() OR shiora_is_admin())
  WITH CHECK (lower(patient_address) = shiora_current_wallet() OR shiora_is_admin());

DROP POLICY IF EXISTS shiora_marketplace_public_or_seller_select ON shiora_marketplace_listings;
CREATE POLICY shiora_marketplace_public_or_seller_select
  ON shiora_marketplace_listings
  FOR SELECT
  USING (
    status = 'active'
    OR lower(seller_address) = shiora_current_wallet()
    OR lower(buyer_address) = shiora_current_wallet()
    OR shiora_is_admin()
  );

DROP POLICY IF EXISTS shiora_marketplace_seller_insert ON shiora_marketplace_listings;
CREATE POLICY shiora_marketplace_seller_insert
  ON shiora_marketplace_listings
  FOR INSERT
  WITH CHECK (lower(seller_address) = shiora_current_wallet() OR shiora_is_admin());

DROP POLICY IF EXISTS shiora_marketplace_seller_update ON shiora_marketplace_listings;
DROP POLICY IF EXISTS shiora_marketplace_active_purchase_update ON shiora_marketplace_listings;
CREATE POLICY shiora_marketplace_active_purchase_update
  ON shiora_marketplace_listings
  FOR UPDATE
  USING (
    lower(seller_address) = shiora_current_wallet()
    OR shiora_is_admin()
    OR (status = 'active' AND shiora_current_wallet() IS NOT NULL)
  )
  WITH CHECK (
    lower(seller_address) = shiora_current_wallet()
    OR shiora_is_admin()
    OR (status = 'sold' AND lower(buyer_address) = shiora_current_wallet())
  );

DROP POLICY IF EXISTS shiora_store_audit_owner_or_admin_select ON shiora_store_audit_log;
CREATE POLICY shiora_store_audit_owner_or_admin_select
  ON shiora_store_audit_log
  FOR SELECT
  USING (lower(owner_address) = shiora_current_wallet() OR shiora_is_admin());

DROP POLICY IF EXISTS shiora_store_audit_append_only_insert ON shiora_store_audit_log;
CREATE POLICY shiora_store_audit_append_only_insert
  ON shiora_store_audit_log
  FOR INSERT
  WITH CHECK (
    owner_address IS NULL
    OR lower(owner_address) = shiora_current_wallet()
    OR shiora_is_admin()
  );

INSERT INTO shiora_schema_migrations (version, checksum_sha256)
VALUES (
  '001_shiora_core_store',
  'fa1874f2c1a3e47007b3be96969f7f483a85eed55ee7d42644cd597564034950'
)
ON CONFLICT (version) DO NOTHING;

COMMIT;
