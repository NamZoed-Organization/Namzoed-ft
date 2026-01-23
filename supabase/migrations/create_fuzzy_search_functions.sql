-- Create fuzzy search function for profiles
CREATE OR REPLACE FUNCTION search_profiles_fuzzy(
  search_query TEXT,
  excluded_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  phone TEXT,
  avatar_url TEXT,
  dzongkhag TEXT,
  follower_count INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.phone,
    p.avatar_url,
    p.dzongkhag,
    p.follower_count
  FROM profiles p
  WHERE
    (excluded_user_id IS NULL OR p.id != excluded_user_id)
    AND (
      similarity(p.name, search_query) > 0.3
      OR similarity(COALESCE(p.phone, ''), search_query) > 0.3
      OR similarity(COALESCE(p.dzongkhag, ''), search_query) > 0.3
    )
  ORDER BY
    GREATEST(
      similarity(p.name, search_query),
      similarity(COALESCE(p.phone, ''), search_query),
      similarity(COALESCE(p.dzongkhag, ''), search_query)
    ) DESC,
    p.follower_count DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- Create fuzzy search function for services
CREATE OR REPLACE FUNCTION search_services_fuzzy(search_query TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  images TEXT[],
  category_id UUID,
  category_name TEXT,
  category_slug TEXT,
  provider_id UUID,
  provider_name TEXT,
  provider_profile_url TEXT,
  user_avatar_url TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ps.id,
    ps.name,
    ps.description,
    ps.images,
    sc.id as category_id,
    sc.name as category_name,
    sc.slug as category_slug,
    sp.id as provider_id,
    sp.name as provider_name,
    sp.profile_url as provider_profile_url,
    p.avatar_url as user_avatar_url
  FROM provider_services ps
  LEFT JOIN service_categories sc ON ps.category_id = sc.id
  LEFT JOIN service_providers sp ON ps.provider_id = sp.id
  LEFT JOIN profiles p ON sp.user_id = p.id
  WHERE
    ps.status = true
    AND (
      similarity(ps.name, search_query) > 0.3
      OR similarity(COALESCE(ps.description, ''), search_query) > 0.3
    )
  ORDER BY
    GREATEST(
      similarity(ps.name, search_query),
      similarity(COALESCE(ps.description, ''), search_query)
    ) DESC,
    ps.created_at DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- Create fuzzy search function for products
CREATE OR REPLACE FUNCTION search_products_fuzzy(search_query TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  price NUMERIC,
  category TEXT,
  tags TEXT[],
  images TEXT[],
  current_price NUMERIC,
  is_currently_active BOOLEAN,
  discount_percent NUMERIC,
  user_id UUID,
  user_name TEXT,
  user_avatar_url TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pwd.id,
    pwd.name,
    pwd.description,
    pwd.price,
    pwd.category,
    pwd.tags,
    pwd.images,
    pwd.current_price,
    pwd.is_currently_active,
    pwd.discount_percent,
    p.id as user_id,
    p.name as user_name,
    p.avatar_url as user_avatar_url
  FROM products_with_discounts pwd
  LEFT JOIN profiles p ON pwd.user_id = p.id
  WHERE
    similarity(pwd.name, search_query) > 0.3
    OR similarity(COALESCE(pwd.description, ''), search_query) > 0.3
  ORDER BY
    GREATEST(
      similarity(pwd.name, search_query),
      similarity(COALESCE(pwd.description, ''), search_query)
    ) DESC,
    pwd.created_at DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- Create fuzzy search function for marketplace
CREATE OR REPLACE FUNCTION search_marketplace_fuzzy(search_query TEXT)
RETURNS TABLE (
  id UUID,
  type TEXT,
  title TEXT,
  description JSONB,
  price NUMERIC,
  images TEXT[],
  dzongkhag TEXT,
  tags TEXT[],
  user_id UUID,
  user_name TEXT,
  user_avatar_url TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.type,
    m.title,
    m.description,
    m.price,
    m.images,
    m.dzongkhag,
    m.tags,
    p.id as user_id,
    p.name as user_name,
    p.avatar_url as user_avatar_url
  FROM marketplace m
  LEFT JOIN profiles p ON m.user_id = p.id
  WHERE
    similarity(m.title, search_query) > 0.3
    OR similarity(COALESCE(m.type, ''), search_query) > 0.3
    OR similarity(COALESCE(m.dzongkhag, ''), search_query) > 0.3
  ORDER BY
    GREATEST(
      similarity(m.title, search_query),
      similarity(COALESCE(m.type, ''), search_query),
      similarity(COALESCE(m.dzongkhag, ''), search_query)
    ) DESC,
    m.created_at DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- Create fuzzy search function for posts
CREATE OR REPLACE FUNCTION search_posts_fuzzy(search_query TEXT)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  content TEXT,
  images TEXT[],
  created_at TIMESTAMPTZ,
  likes INT,
  comments INT,
  shares INT,
  user_name TEXT,
  user_avatar_url TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    po.id,
    po.user_id,
    po.content,
    po.images,
    po.created_at,
    po.likes,
    po.comments,
    po.shares,
    p.name as user_name,
    p.avatar_url as user_avatar_url
  FROM posts po
  LEFT JOIN profiles p ON po.user_id = p.id
  WHERE
    similarity(po.content, search_query) > 0.3
    OR similarity(COALESCE(p.name, ''), search_query) > 0.3
  ORDER BY
    GREATEST(
      similarity(po.content, search_query),
      similarity(COALESCE(p.name, ''), search_query)
    ) DESC,
    po.created_at DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql;
