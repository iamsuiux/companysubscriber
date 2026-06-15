-- Add job title keywords setting
-- This setting controls which job titles are included when scraping
INSERT INTO settings (key, value)
VALUES ('job_title_keywords', 'software,engineer,developer')
ON CONFLICT (key) DO NOTHING;
