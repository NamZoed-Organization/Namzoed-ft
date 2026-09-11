-- ─── The business gets a type of its own ────────────────────────────────
-- `category_id` has always lived on provider_services — so a *service* has a
-- type and the *business* has none. When the profile asks "what kind of
-- business is this" it has as many answers as the business has services, and
-- no way to choose between them. That is why every business page looked the
-- same regardless of trade, and why a taxi driver was shown a Products tab.
--
-- The fix is a type on the business, not a limit on how many services it may
-- offer. Restricting to one service per account would give the page an
-- answer as a side effect, at the cost of splitting a multi-service
-- business's ratings, followers and chat history across several accounts —
-- and plenty of real businesses are genuinely multi-service (a salon, a
-- garage, a photographer).
--
-- Additive: the column is nullable, and a business without one falls back to
-- the default section set, so nothing that exists today changes behaviour.

ALTER TABLE public.service_providers
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.service_categories(id);

CREATE INDEX IF NOT EXISTS idx_service_providers_category
  ON public.service_providers (category_id);

-- Backfill from the category the business already uses most. A business with
-- one service gets that one; a salon with three beauty services still lands
-- on beauty-health. Ties break on category_id so the result is deterministic
-- rather than whatever the planner happened to return.
WITH counted AS (
  SELECT provider_id, category_id, count(*) AS n
    FROM public.provider_services
   WHERE category_id IS NOT NULL
   GROUP BY provider_id, category_id
),
primary_category AS (
  SELECT DISTINCT ON (provider_id) provider_id, category_id
    FROM counted
   ORDER BY provider_id, n DESC, category_id
)
UPDATE public.service_providers sp
   SET category_id = pc.category_id
  FROM primary_category pc
 WHERE pc.provider_id = sp.id
   AND sp.category_id IS NULL;

-- A business's first service sets its type when it hasn't got one yet, so a
-- seller never has to answer a question the app could answer for them. It
-- only ever fills a blank — a business that has chosen a type keeps it, even
-- if it later adds a service from another category.
CREATE OR REPLACE FUNCTION public.set_business_type_from_first_service()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.category_id IS NOT NULL THEN
    UPDATE public.service_providers
       SET category_id = NEW.category_id
     WHERE id = NEW.provider_id
       AND category_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_set_business_type ON public.provider_services;
CREATE TRIGGER trg_set_business_type
  AFTER INSERT ON public.provider_services
  FOR EACH ROW EXECUTE FUNCTION public.set_business_type_from_first_service();
