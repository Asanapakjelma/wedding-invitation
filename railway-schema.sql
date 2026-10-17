-- Jalankan sekali pada database PostgreSQL production sebelum menyalakan API.
-- Skrip ini menyiapkan schema saja; tidak memasukkan RSVP atau data pribadi contoh.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  verified boolean NOT NULL DEFAULT false,
  otp_hash text,
  otp_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wedding_settings (
  id bigint PRIMARY KEY,
  bride_name text NOT NULL DEFAULT 'Wanita',
  groom_name text NOT NULL DEFAULT 'Pria',
  wedding_date timestamptz NOT NULL DEFAULT now(),
  bca_wanita text NOT NULL DEFAULT '',
  bca_pria text NOT NULL DEFAULT '',
  wax_color text NOT NULL DEFAULT '#E3D5CA',
  text_color text NOT NULL DEFAULT '#6F4E37',
  created_at timestamptz NOT NULL DEFAULT now(),
  google_maps_url text,
  background_url text,
  music_url text,
  user_id uuid REFERENCES public.app_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.wedding_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.app_users(id) ON DELETE CASCADE,
  slot_number integer NOT NULL,
  photo_url text NOT NULL,
  caption text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rsvp_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  guest_name text NOT NULL,
  attendance_status text NOT NULL,
  total_guest integer NOT NULL DEFAULT 1,
  wishes text,
  user_id uuid REFERENCES public.app_users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS wedding_settings_user_id_idx
  ON public.wedding_settings(user_id)
  WHERE user_id IS NOT NULL;

ALTER TABLE public.wedding_photos
  DROP CONSTRAINT IF EXISTS wedding_photos_slot_number_key;

CREATE UNIQUE INDEX IF NOT EXISTS wedding_photos_user_slot_idx
  ON public.wedding_photos(user_id, slot_number);

INSERT INTO public.wedding_settings (
  id, bride_name, groom_name, wedding_date, bca_wanita, bca_pria, wax_color, text_color
)
VALUES (1, 'Wanita', 'Pria', '2027-12-31 09:00:00+00', '', '', '#E3D5CA', '#6F4E37')
ON CONFLICT (id) DO NOTHING;
