ALTER TABLE e2e_seed_run
  ADD COLUMN cleanup_policy VARCHAR(32) NOT NULL DEFAULT 'always'
  AFTER cleanup_error;

INSERT INTO e2e_seed_schema_version(version, description)
VALUES (3, 'Persist the user-selected Seed cleanup policy');
