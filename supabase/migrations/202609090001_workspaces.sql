-- One private workspace snapshot per user; browser uses a publishable key + user JWT.
create table public.biogenesis_workspaces (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  constraint payload_size check (octet_length(payload::text) <= 5242880)
);
alter table public.biogenesis_workspaces enable row level security;
create policy "Read own workspace" on public.biogenesis_workspaces
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "Insert own workspace" on public.biogenesis_workspaces
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "Update own workspace" on public.biogenesis_workspaces
  for update to authenticated using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
revoke all on public.biogenesis_workspaces from anon;
grant select, insert, update on public.biogenesis_workspaces to authenticated;

-- Atomic revision check prevents an older tab/device from overwriting newer work.
create function public.save_biogenesis_workspace(expected_revision bigint, new_payload jsonb)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare new_revision bigint;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if new_payload is null or jsonb_typeof(new_payload) <> 'object'
     or jsonb_typeof(new_payload->'sequences') is distinct from 'array'
     or jsonb_typeof(new_payload->'analysisDocuments') is distinct from 'array'
     or octet_length(new_payload::text) > 5242880 then
    raise exception 'Invalid workspace or workspace exceeds 5 MiB';
  end if;
  if expected_revision = 0 then
    insert into public.biogenesis_workspaces(owner_id,payload) values(auth.uid(),new_payload)
    on conflict(owner_id) do nothing returning revision into new_revision;
  else
    update public.biogenesis_workspaces
      set payload=new_payload, revision=revision+1, updated_at=now()
      where owner_id=auth.uid() and revision=expected_revision
      returning revision into new_revision;
  end if;
  if new_revision is null then raise exception 'WORKSPACE_CONFLICT'; end if;
  return new_revision;
end;
$$;
revoke all on function public.save_biogenesis_workspace(bigint,jsonb) from public, anon;
grant execute on function public.save_biogenesis_workspace(bigint,jsonb) to authenticated;
