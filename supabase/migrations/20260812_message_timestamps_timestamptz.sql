-- Message created_at was `timestamp without time zone` storing UTC wall-clock.
-- JS parsed those as local time (Turkey UTC+3 → shown 3 hours early).
-- Convert to timestamptz interpreting existing values as UTC.

ALTER TABLE public.dm_messages
  ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN delivered_at TYPE timestamptz USING CASE
    WHEN delivered_at IS NULL THEN NULL
    ELSE delivered_at AT TIME ZONE 'UTC'
  END,
  ALTER COLUMN read_at TYPE timestamptz USING CASE
    WHEN read_at IS NULL THEN NULL
    ELSE read_at AT TIME ZONE 'UTC'
  END;

ALTER TABLE public.group_messages
  ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE timestamptz USING CASE
    WHEN updated_at IS NULL THEN NULL
    ELSE updated_at AT TIME ZONE 'UTC'
  END;
