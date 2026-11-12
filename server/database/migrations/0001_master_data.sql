-- Master data (SRS §4, seeds from Kim's schema.sql). Plain ANSI INSERTs: portable to Azure SQL / PostgreSQL.
INSERT INTO markets (code, name, sort_order, is_active) VALUES
 ('JP', 'Japan', 1, 1), ('KR', 'Korea', 2, 1), ('EU', 'Europe', 3, 1), ('AM', 'Americas', 4, 1),
 ('VN', 'Vietnam', 5, 1), ('AP', 'Asia Pacific', 6, 1), ('ME', 'Middle East', 7, 1);
--> statement-breakpoint
INSERT INTO countries (market_code, name) VALUES
 ('JP', 'Japan'), ('KR', 'South Korea'), ('EU', 'Europe'), ('EU', 'Central Europe'),
 ('AM', 'United States'), ('VN', 'Vietnam'), ('AP', 'Singapore'), ('ME', 'UAE');
--> statement-breakpoint
INSERT INTO partners (name, is_active) VALUES
 ('OutSystems', 1), ('ServiceNow', 1), ('Salesforce', 1), ('Mendix', 1),
 ('Microsoft Power Apps', 1), ('Nexacro', 1), ('LCP', 1);
--> statement-breakpoint
INSERT INTO lookups (category, value, sort_order, is_active) VALUES
 ('deal_type', 'Project', 1, 1), ('deal_type', 'License', 2, 1), ('deal_type', 'Project+License', 3, 1), ('deal_type', 'AMS', 4, 1),
 ('activity_type', 'Customer Meeting', 1, 1), ('activity_type', 'Email', 2, 1), ('activity_type', 'Proposal Submission', 3, 1),
 ('activity_type', 'Demo', 4, 1), ('activity_type', 'Seminar', 5, 1), ('activity_type', 'Internal', 6, 1),
 ('activity_type', 'Partner Meeting', 7, 1), ('activity_type', 'Other', 8, 1),
 ('priority', 'High', 1, 1), ('priority', 'Medium', 2, 1), ('priority', 'Low', 3, 1);
--> statement-breakpoint
INSERT INTO settings (key, value) VALUES
 ('default_win_rate', '{"O":10,"D":20,"C":40,"B":60,"A":80,"W":100,"L":0}'),
 ('health_days', '{"green_max":14,"amber_max":30}'),
 ('warn_no_update_days', '[14]'),
 ('warn_on_hold_days', '[30]'),
 ('warn_stage_stuck_days', '{"O":30,"D":30,"C":45,"B":30,"A":21}'),
 ('top_mgmt_threshold_usd', '[200000]'),
 ('key_deal', '{"amount_usd":200000,"win_rate":70}'),
 ('highlight_activity_types', '["Customer Meeting","Proposal Submission","Demo","Seminar"]');
--> statement-breakpoint
-- Admin adds JPY, VND, KRW, SGD, AED, EUR plan rates per fiscal year (SRS 5.2).
INSERT INTO fx_rates (fiscal_year, currency, rate_to_usd) VALUES (2026, 'USD', 1);
