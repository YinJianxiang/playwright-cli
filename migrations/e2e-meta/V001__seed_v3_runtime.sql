CREATE TABLE IF NOT EXISTS e2e_seed_schema_version (
  version INT NOT NULL PRIMARY KEY,
  description VARCHAR(255) NOT NULL,
  installed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS e2e_seed_run (
  run_id CHAR(36) NOT NULL PRIMARY KEY,
  environment VARCHAR(32) NOT NULL,
  biz VARCHAR(64) NOT NULL,
  scenario VARCHAR(64) NOT NULL,
  rule_id VARCHAR(64) NOT NULL,
  pair_id VARCHAR(191) NULL,
  mode ENUM('hit','miss') NOT NULL,
  active_key VARCHAR(512) NULL,
  status VARCHAR(32) NOT NULL,
  config_version VARCHAR(128) NULL,
  approval_fingerprint VARCHAR(80) NULL,
  execution_hash VARCHAR(80) NULL,
  plan_path TEXT NULL,
  audit_path TEXT NULL,
  manifest_path TEXT NULL,
  cancel_requested_at DATETIME(3) NULL,
  cancel_reason TEXT NULL,
  lease_owner VARCHAR(191) NULL,
  lease_expires_at DATETIME(3) NULL,
  heartbeat_at DATETIME(3) NULL,
  primary_error MEDIUMTEXT NULL,
  rollback_error MEDIUMTEXT NULL,
  cleanup_error MEDIUMTEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_seed_run_recovery (status, lease_expires_at),
  KEY idx_seed_run_identity (rule_id, mode, pair_id, status),
  UNIQUE KEY uk_seed_run_active (active_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS e2e_seed_approval (
  fingerprint VARCHAR(80) NOT NULL,
  environment VARCHAR(32) NOT NULL,
  biz VARCHAR(64) NOT NULL,
  scenario VARCHAR(64) NOT NULL,
  config_version VARCHAR(128) NOT NULL,
  risk_level ENUM('medium','high') NOT NULL,
  approved_by VARCHAR(191) NOT NULL,
  approved_at DATETIME(3) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  reason TEXT NOT NULL,
  revoked_at DATETIME(3) NULL,
  revoked_by VARCHAR(191) NULL,
  revoke_reason TEXT NULL,
  PRIMARY KEY (fingerprint, environment, biz, scenario, config_version),
  KEY idx_seed_approval_expiry (expires_at, revoked_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO e2e_seed_schema_version(version, description)
VALUES (1, 'Seed V3 runtime and approval tables')
ON DUPLICATE KEY UPDATE description = VALUES(description);
