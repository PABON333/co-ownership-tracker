-- Enable UUID extension
create extension if not exists "pgcrypto";

-- Profiles (mirrors auth.users)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  created_at timestamptz default now() not null
);

-- Property workspace (one per family)
create table if not exists property_workspace (
  id uuid primary key default gen_random_uuid(),
  property_name text not null,
  address text,
  purchase_date date,
  purchase_price_cents bigint check (purchase_price_cents > 0),
  lender_name text,
  original_loan_amount_cents bigint check (original_loan_amount_cents > 0),
  primary_borrower_label text,
  loan_notes text,
  created_at timestamptz default now() not null
);

-- Workspace members
create table if not exists workspace_members (
  workspace_id uuid references property_workspace(id) on delete cascade not null,
  profile_id uuid references profiles(id) on delete cascade not null,
  joined_at timestamptz default now() not null,
  invited_by uuid references profiles(id),
  primary key (workspace_id, profile_id)
);

-- Ownership groups
create table if not exists ownership_groups (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references property_workspace(id) on delete cascade not null,
  name text not null,
  active boolean default true not null,
  display_order integer default 0 not null,
  created_at timestamptz default now() not null,
  constraint ownership_groups_name_unique unique (workspace_id, name)
);

-- Ownership group members
create table if not exists ownership_group_members (
  ownership_group_id uuid references ownership_groups(id) on delete cascade not null,
  profile_id uuid references profiles(id) on delete cascade not null,
  created_at timestamptz default now() not null,
  primary key (ownership_group_id, profile_id)
);

-- Equity policy versions
create table if not exists equity_policy_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references property_workspace(id) on delete cascade not null,
  policy_data jsonb not null,
  created_by uuid references profiles(id),
  created_at timestamptz default now() not null,
  effective_at timestamptz default now() not null
);

-- Financial transactions
create table if not exists financial_transactions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references property_workspace(id) on delete cascade not null,
  type text not null check (type in (
    'initial_contribution', 'additional_contribution', 'owner_paid_expense',
    'property_cash_expense', 'capital_improvement', 'mortgage_payment',
    'rental_income', 'cash_distribution', 'reimbursement', 'equity_transfer',
    'manual_adjustment', 'reversal'
  )),
  status text not null default 'posted' check (status in ('posted', 'reversed', 'voided')),
  effective_date date not null,
  amount_cents bigint not null check (amount_cents > 0),
  description text not null,
  notes text,
  counterparty_reference text,
  expense_category text check (expense_category in (
    'property_taxes', 'home_insurance', 'mortgage_interest', 'mortgage_principal',
    'mortgage_escrow', 'maintenance', 'repair', 'utility', 'capital_improvement', 'other'
  )),
  property_cash_effect_cents bigint not null default 0,
  policy_snapshot jsonb,
  created_by uuid references profiles(id),
  created_at timestamptz default now() not null,
  posted_at timestamptz,
  reversed_transaction_id uuid references financial_transactions(id)
);

-- Transaction allocations
create table if not exists transaction_allocations (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid references financial_transactions(id) on delete cascade not null,
  ownership_group_id uuid references ownership_groups(id) not null,
  amount_cents bigint not null check (amount_cents >= 0),
  allocation_role text not null check (allocation_role in (
    'contributor', 'payer', 'recipient', 'source', 'destination'
  )),
  created_at timestamptz default now() not null
);

-- Capital ledger entries
create table if not exists capital_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid references financial_transactions(id) on delete cascade not null,
  ownership_group_id uuid references ownership_groups(id) not null,
  signed_amount_cents bigint not null,
  entry_type text not null,
  policy_rationale text,
  pre_transaction_percentage numeric(12, 8),
  post_transaction_percentage numeric(12, 8),
  created_at timestamptz default now() not null
);

-- Audit log
create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references property_workspace(id) on delete cascade not null,
  actor_profile_id uuid references profiles(id),
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz default now() not null
);

-- Indexes
create index if not exists idx_workspace_members_profile on workspace_members(profile_id);
create index if not exists idx_ownership_groups_workspace on ownership_groups(workspace_id);
create index if not exists idx_ownership_group_members_profile on ownership_group_members(profile_id);
create index if not exists idx_financial_transactions_workspace on financial_transactions(workspace_id);
create index if not exists idx_financial_transactions_type on financial_transactions(type);
create index if not exists idx_financial_transactions_date on financial_transactions(effective_date);
create index if not exists idx_financial_transactions_status on financial_transactions(status);
create index if not exists idx_capital_ledger_workspace on capital_ledger_entries(transaction_id);
create index if not exists idx_capital_ledger_group on capital_ledger_entries(ownership_group_id);
create index if not exists idx_transaction_allocations_tx on transaction_allocations(transaction_id);
create index if not exists idx_audit_log_workspace on audit_log(workspace_id);
create index if not exists idx_audit_log_actor on audit_log(actor_profile_id);

-- Auto-create profile on user signup
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name'
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(excluded.full_name, profiles.full_name);
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
