-- Seed admin user (password: admin123)
INSERT INTO users (username, password_hash)
VALUES ('admin', '$2a$10$IYLgrzIGg45iU2vJPZgwoepHu/ctRBjjHXTtWE1JtfIMpGgl5pIJS')
ON CONFLICT (username) DO NOTHING;

-- Seed default settings
INSERT INTO settings (key, value)
VALUES ('scrape_schedule', '0 12 * * *')
ON CONFLICT (key) DO NOTHING;

INSERT INTO settings (key, value)
VALUES ('auto_scrape_enabled', 'true')
ON CONFLICT (key) DO NOTHING;
