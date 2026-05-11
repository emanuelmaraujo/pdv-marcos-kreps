INSERT INTO settings (key, value)
VALUES
  ('public_ordering_start_time', '"17:00"'),
  ('public_ordering_end_time', '"23:30"')
ON CONFLICT (key) DO NOTHING;
