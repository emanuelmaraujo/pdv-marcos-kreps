INSERT INTO settings (key, value)
VALUES ('public_ordering_enabled', 'true')
ON CONFLICT (key) DO UPDATE SET value = COALESCE(settings.value, EXCLUDED.value);
