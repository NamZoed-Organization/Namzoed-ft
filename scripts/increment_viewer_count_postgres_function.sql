CREATE FUNCTION increment_viewer_count(p_id uuid, p_delta integer)
RETURNS void AS $$
BEGIN
  UPDATE live_streams
  SET viewer_count = GREATEST(0, COALESCE(viewer_count,0) + p_delta),
      updated_at = NOW()
  WHERE id = p_id;
END;
$$ LANGUAGE plpgsql;