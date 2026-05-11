
-- Make receiver optional
ALTER TABLE public.parcels ALTER COLUMN receiver_id DROP NOT NULL;

-- Sequential tracking numbers starting at 1
CREATE SEQUENCE IF NOT EXISTS public.parcels_tracking_seq START 1;
ALTER TABLE public.parcels ALTER COLUMN tracking_number SET DEFAULT ('PKG-' || nextval('public.parcels_tracking_seq'));
