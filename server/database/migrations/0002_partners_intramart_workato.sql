-- Sales team feedback (2026-11-13): new partners. Idempotent: skips a partner that already exists.
INSERT INTO partners (name, is_active)
SELECT 'Intra-mart', 1 WHERE NOT EXISTS (SELECT 1 FROM partners WHERE lower(name) = 'intra-mart');
--> statement-breakpoint
INSERT INTO partners (name, is_active)
SELECT 'Workato', 1 WHERE NOT EXISTS (SELECT 1 FROM partners WHERE lower(name) = 'workato');
