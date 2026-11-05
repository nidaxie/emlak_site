-- Coordinates stay in the schema for later geocoding. New listings may omit them.
ALTER TABLE "properties" ALTER COLUMN "latitude" DROP NOT NULL;
ALTER TABLE "properties" ALTER COLUMN "longitude" DROP NOT NULL;
ALTER TABLE "properties" ALTER COLUMN "location" DROP NOT NULL;

CREATE OR REPLACE FUNCTION properties_sync_location()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.latitude IS NULL OR NEW.longitude IS NULL THEN
    NEW.location := NULL;
  ELSE
    NEW.location := ST_SetSRID(
      ST_MakePoint(NEW.longitude::double precision, NEW.latitude::double precision),
      4326
    )::geography;
  END IF;
  RETURN NEW;
END;
$$;
