-- Enable Row Level Security on all tables
alter table profiles enable row level security;
alter table property_workspace enable row level security;
alter table workspace_members enable row level security;
alter table ownership_groups enable row level security;
alter table ownership_group_members enable row level security;
alter table equity_policy_versions enable row level security;
alter table financial_transactions enable row level security;
alter table transaction_allocations enable row level security;
alter table capital_ledger_entries enable row level security;
alter table audit_log enable row level security;

-- Helper function: is the current user a member of a workspace?
create or replace function is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
security definer stable
as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = p_workspace_id
      and profile_id = auth.uid()
  );
$$;

-- Helper function: get workspace id for the current user (assumes one workspace)
create or replace function get_user_workspace_id()
returns uuid
language sql
security definer stable
as $$
  select workspace_id from workspace_members
  where profile_id = auth.uid()
  limit 1;
$$;

-- profiles policies
drop policy if exists "Users can view their own profile" on profiles;
create policy "Users can view their own profile"
  on profiles for select
  using (id = auth.uid());

drop policy if exists "Users can update their own profile" on profiles;
create policy "Users can update their own profile"
  on profiles for update
  using (id = auth.uid());

-- Workspace members can view each other's profiles
drop policy if exists "Workspace members can view co-member profiles" on profiles;
create policy "Workspace members can view co-member profiles"
  on profiles for select
  using (
    id in (
      select wm.profile_id from workspace_members wm
      where wm.workspace_id = get_user_workspace_id()
    )
  );

-- property_workspace policies
drop policy if exists "Workspace members can view workspace" on property_workspace;
create policy "Workspace members can view workspace"
  on property_workspace for select
  using (is_workspace_member(id));

drop policy if exists "Any authenticated user can create workspace" on property_workspace;
create policy "Any authenticated user can create workspace"
  on property_workspace for insert
  with check (auth.uid() is not null);

drop policy if exists "Workspace members can update workspace" on property_workspace;
create policy "Workspace members can update workspace"
  on property_workspace for update
  using (is_workspace_member(id));

-- workspace_members policies
drop policy if exists "Members can view workspace members" on workspace_members;
create policy "Members can view workspace members"
  on workspace_members for select
  using (is_workspace_member(workspace_id));

drop policy if exists "Workspace members can add members" on workspace_members;
create policy "Workspace members can add members"
  on workspace_members for insert
  with check (is_workspace_member(workspace_id) or workspace_id not in (
    select workspace_id from workspace_members where profile_id = auth.uid()
  ));

drop policy if exists "Members can delete workspace members" on workspace_members;
create policy "Members can delete workspace members"
  on workspace_members for delete
  using (is_workspace_member(workspace_id));

-- Allow first workspace creation (user not yet a member)
drop policy if exists "Creator can add themselves as first member" on workspace_members;
create policy "Creator can add themselves as first member"
  on workspace_members for insert
  with check (
    profile_id = auth.uid() and
    not exists (select 1 from workspace_members where profile_id = auth.uid())
  );

-- ownership_groups policies
drop policy if exists "Workspace members can view ownership groups" on ownership_groups;
create policy "Workspace members can view ownership groups"
  on ownership_groups for select
  using (is_workspace_member(workspace_id));

drop policy if exists "Workspace members can create ownership groups" on ownership_groups;
create policy "Workspace members can create ownership groups"
  on ownership_groups for insert
  with check (is_workspace_member(workspace_id));

drop policy if exists "Workspace members can update ownership groups" on ownership_groups;
create policy "Workspace members can update ownership groups"
  on ownership_groups for update
  using (is_workspace_member(workspace_id));

-- ownership_group_members policies
drop policy if exists "Workspace members can view group members" on ownership_group_members;
create policy "Workspace members can view group members"
  on ownership_group_members for select
  using (
    ownership_group_id in (
      select id from ownership_groups where is_workspace_member(workspace_id)
    )
  );

drop policy if exists "Workspace members can manage group membership" on ownership_group_members;
create policy "Workspace members can manage group membership"
  on ownership_group_members for all
  using (
    ownership_group_id in (
      select id from ownership_groups where is_workspace_member(workspace_id)
    )
  );

-- equity_policy_versions policies
drop policy if exists "Workspace members can view policies" on equity_policy_versions;
create policy "Workspace members can view policies"
  on equity_policy_versions for select
  using (is_workspace_member(workspace_id));

drop policy if exists "Workspace members can create policies" on equity_policy_versions;
create policy "Workspace members can create policies"
  on equity_policy_versions for insert
  with check (is_workspace_member(workspace_id));

-- financial_transactions policies
drop policy if exists "Workspace members can view transactions" on financial_transactions;
create policy "Workspace members can view transactions"
  on financial_transactions for select
  using (is_workspace_member(workspace_id));

-- Transactions are only inserted via the post_transaction RPC (security definer)
-- Direct client inserts are blocked; RPC bypasses RLS
drop policy if exists "No direct client inserts on transactions" on financial_transactions;
create policy "No direct client inserts on transactions"
  on financial_transactions for insert
  with check (false);

-- capital_ledger_entries policies
drop policy if exists "Workspace members can view ledger entries" on capital_ledger_entries;
create policy "Workspace members can view ledger entries"
  on capital_ledger_entries for select
  using (
    transaction_id in (
      select id from financial_transactions where is_workspace_member(workspace_id)
    )
  );

-- Ledger entries are only inserted via RPC
drop policy if exists "No direct client inserts on ledger" on capital_ledger_entries;
create policy "No direct client inserts on ledger"
  on capital_ledger_entries for insert
  with check (false);

-- transaction_allocations policies
drop policy if exists "Workspace members can view allocations" on transaction_allocations;
create policy "Workspace members can view allocations"
  on transaction_allocations for select
  using (
    transaction_id in (
      select id from financial_transactions where is_workspace_member(workspace_id)
    )
  );

drop policy if exists "No direct client inserts on allocations" on transaction_allocations;
create policy "No direct client inserts on allocations"
  on transaction_allocations for insert
  with check (false);

-- audit_log policies
drop policy if exists "Workspace members can view audit log" on audit_log;
create policy "Workspace members can view audit log"
  on audit_log for select
  using (is_workspace_member(workspace_id));

drop policy if exists "No direct client inserts on audit log" on audit_log;
create policy "No direct client inserts on audit log"
  on audit_log for insert
  with check (false);
