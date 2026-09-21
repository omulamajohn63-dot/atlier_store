-- ============================================================================
-- MODEZA boutique — database cleanup / reset
-- ============================================================================
-- Drops EVERYTHING created by supabase/setup.sql so you can re-run setup.sql
-- cleanly. Run BEFORE setup.sql in the SQL Editor when you want a full reset.
--
--   Dashboard -> SQL Editor -> paste cleanup.sql -> Run
--   then -> paste supabase/setup.sql -> Run
--
-- Order matters: child tables are dropped first, then parents, then the enum
-- types. Policies/indexes disappear with their tables automatically.
-- auth.users and Supabase auth schema are left untouched.
-- ============================================================================

-- Cart/order child records first (FK dependencies)
drop table if exists public.cart_items;
drop table if exists public.order_items;
drop table if exists public.stock_reservations;
drop table if exists public.wishlist_items;
drop table if exists public.payment_events;

-- Payment intents reference orders
drop table if exists public.payment_intents;

-- Parent commerce tables
drop table if exists public.orders;
drop table if exists public.carts;
drop table if exists public.audit_logs;

-- Catalogue
drop table if exists public.product_variants;
drop table if exists public.products;
drop table if exists public.categories;

-- Member profile
drop table if exists public.profiles;

-- Enum types (no longer referenced once tables are gone)
drop type if exists public.reservation_status;
drop type if exists public.order_status;
drop type if exists public.payment_status;
drop type if exists public.payment_method;
drop type if exists public.product_status;

-- Extension created by setup.sql. Left disabled on purpose — pgcrypto is a
-- Supabase default and other schemas may rely on it. Uncomment to fully remove:
-- drop extension if exists pgcrypto;

-- Optional: also wipe sign-ups/identities/sessions (they will orphan profile
-- data otherwise). Uncomment only if you truly want accounts deleted:
-- truncate table auth.users cascade;