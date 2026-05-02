ALTER TABLE public.parcels
ADD COLUMN location TEXT,
ADD COLUMN box_quantity INTEGER NOT NULL DEFAULT 1 CHECK (box_quantity > 0);