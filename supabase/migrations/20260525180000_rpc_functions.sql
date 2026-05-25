-- RPC functions used by the Supabase JS client.
--
-- We keep these in a separate migration from the initial schema so the
-- function definitions don't clutter the table-creation file. Adding new
-- functions later means a new dated migration; we don't modify this one.

-- ── insert_moment_with_drafts ─────────────────────────────────────────────
-- Multi-row atomic insert: a moment plus its two draft variants. The
-- whole thing runs in a single transaction; if any insert fails, all are
-- rolled back. This replaces the SQLite-era `transaction(() => {...})`
-- helper in src/lib/db.ts.
--
-- Returns the new moment's id, matching the pre-migration JS contract.

CREATE OR REPLACE FUNCTION insert_moment_with_drafts(
  p_summary       text,
  p_source_type   text,
  p_source_refs   jsonb,
  p_generation_id text,
  p_repo          text,
  p_x_thread      text,
  p_ih_long       text
) RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_moment_id bigint;
BEGIN
  INSERT INTO moments (summary, source_type, source_ref, generation_id, repo)
  VALUES (p_summary, p_source_type, p_source_refs, p_generation_id, p_repo)
  RETURNING id INTO v_moment_id;

  INSERT INTO drafts (moment_id, variant, content)
  VALUES
    (v_moment_id, 'x_thread', p_x_thread),
    (v_moment_id, 'ih_long', p_ih_long);

  RETURN v_moment_id;
END;
$$;

-- The service role doesn't need GRANT explicitly (it has full access), but
-- documenting the intent here for any future per-user auth scenario.
COMMENT ON FUNCTION insert_moment_with_drafts IS
  'Atomically insert a moment and its two draft variants. Returns the new moment id.';
