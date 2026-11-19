-- Keep workspace writes behind the revision-checked RPC. RLS still protects reads.
revoke insert, update on public.biogenesis_workspaces from authenticated;

-- The function owner performs the write, so explicitly bind it to the caller.
-- Fully qualified names and an empty search_path prevent object substitution.
alter function public.save_biogenesis_workspace(bigint, jsonb) security definer;
alter function public.save_biogenesis_workspace(bigint, jsonb) set search_path = '';
revoke all on function public.save_biogenesis_workspace(bigint, jsonb) from public, anon;
grant execute on function public.save_biogenesis_workspace(bigint, jsonb) to authenticated;
