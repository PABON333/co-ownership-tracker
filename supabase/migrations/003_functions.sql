-- Atomic transaction posting function
-- Runs as SECURITY DEFINER so it can bypass RLS on insert-blocked tables
-- Called from Next.js server actions only

create or replace function post_transaction(
  p_workspace_id uuid,
  p_actor_id uuid,
  p_type text,
  p_effective_date date,
  p_amount_cents bigint,
  p_description text,
  p_notes text,
  p_counterparty_reference text,
  p_expense_category text,
  p_property_cash_effect_cents bigint,
  p_policy_snapshot jsonb,
  p_allocations jsonb,
  p_capital_effects jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_transaction_id uuid;
  v_alloc jsonb;
  v_effect jsonb;
begin
  -- Verify actor is a workspace member
  if not exists (
    select 1 from workspace_members
    where workspace_id = p_workspace_id
      and profile_id = p_actor_id
  ) then
    raise exception 'Unauthorized: actor is not a workspace member';
  end if;

  -- Validate amount
  if p_amount_cents <= 0 then
    raise exception 'Amount must be positive';
  end if;

  -- Insert the transaction
  insert into financial_transactions (
    workspace_id, type, status, effective_date, amount_cents,
    description, notes, counterparty_reference, expense_category,
    property_cash_effect_cents, policy_snapshot, created_by, posted_at
  ) values (
    p_workspace_id, p_type, 'posted', p_effective_date, p_amount_cents,
    p_description, p_notes, p_counterparty_reference, p_expense_category,
    p_property_cash_effect_cents, p_policy_snapshot, p_actor_id, now()
  ) returning id into v_transaction_id;

  -- Insert allocations
  for v_alloc in select * from jsonb_array_elements(p_allocations)
  loop
    insert into transaction_allocations (
      transaction_id, ownership_group_id, amount_cents, allocation_role
    ) values (
      v_transaction_id,
      (v_alloc->>'ownership_group_id')::uuid,
      (v_alloc->>'amount_cents')::bigint,
      v_alloc->>'allocation_role'
    );
  end loop;

  -- Insert capital ledger entries
  for v_effect in select * from jsonb_array_elements(p_capital_effects)
  loop
    insert into capital_ledger_entries (
      transaction_id, ownership_group_id, signed_amount_cents,
      entry_type, policy_rationale,
      pre_transaction_percentage, post_transaction_percentage
    ) values (
      v_transaction_id,
      (v_effect->>'ownership_group_id')::uuid,
      (v_effect->>'signed_amount_cents')::bigint,
      v_effect->>'entry_type',
      v_effect->>'policy_rationale',
      nullif(v_effect->>'pre_transaction_percentage', '')::numeric,
      nullif(v_effect->>'post_transaction_percentage', '')::numeric
    );
  end loop;

  -- Write audit log
  insert into audit_log (workspace_id, actor_profile_id, action, entity_type, entity_id, metadata)
  values (
    p_workspace_id, p_actor_id, 'post_transaction', 'financial_transaction', v_transaction_id,
    jsonb_build_object(
      'type', p_type,
      'amount_cents', p_amount_cents,
      'description', p_description
    )
  );

  return jsonb_build_object('transaction_id', v_transaction_id, 'success', true);

exception when others then
  raise exception 'Transaction posting failed: %', sqlerrm;
end;
$$;

-- Reversal posting function
create or replace function post_reversal(
  p_workspace_id uuid,
  p_actor_id uuid,
  p_original_transaction_id uuid,
  p_effective_date date,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_original financial_transactions%rowtype;
  v_reversal_id uuid;
  v_alloc transaction_allocations%rowtype;
  v_entry capital_ledger_entries%rowtype;
begin
  -- Verify actor
  if not exists (
    select 1 from workspace_members
    where workspace_id = p_workspace_id and profile_id = p_actor_id
  ) then
    raise exception 'Unauthorized';
  end if;

  -- Get and validate original transaction
  select * into v_original
  from financial_transactions
  where id = p_original_transaction_id
    and workspace_id = p_workspace_id
    and status = 'posted';

  if not found then
    raise exception 'Original transaction not found or already reversed';
  end if;

  -- Create reversal transaction
  insert into financial_transactions (
    workspace_id, type, status, effective_date, amount_cents,
    description, notes, property_cash_effect_cents,
    policy_snapshot, created_by, posted_at, reversed_transaction_id
  ) values (
    p_workspace_id, 'reversal', 'posted', p_effective_date, v_original.amount_cents,
    'Reversal: ' || v_original.description,
    p_reason, -v_original.property_cash_effect_cents,
    v_original.policy_snapshot, p_actor_id, now(), p_original_transaction_id
  ) returning id into v_reversal_id;

  -- Mirror allocations with same roles
  for v_alloc in
    select * from transaction_allocations
    where transaction_id = p_original_transaction_id
  loop
    insert into transaction_allocations (
      transaction_id, ownership_group_id, amount_cents, allocation_role
    ) values (
      v_reversal_id, v_alloc.ownership_group_id, v_alloc.amount_cents, v_alloc.allocation_role
    );
  end loop;

  -- Mirror capital ledger entries with opposite signs
  for v_entry in
    select * from capital_ledger_entries
    where transaction_id = p_original_transaction_id
  loop
    insert into capital_ledger_entries (
      transaction_id, ownership_group_id, signed_amount_cents,
      entry_type, policy_rationale
    ) values (
      v_reversal_id, v_entry.ownership_group_id, -v_entry.signed_amount_cents,
      'reversal_' || v_entry.entry_type,
      'Reversal of: ' || coalesce(v_entry.policy_rationale, '')
    );
  end loop;

  -- Mark original as reversed
  update financial_transactions
  set status = 'reversed'
  where id = p_original_transaction_id;

  -- Audit log
  insert into audit_log (workspace_id, actor_profile_id, action, entity_type, entity_id, metadata)
  values (
    p_workspace_id, p_actor_id, 'post_reversal', 'financial_transaction', v_reversal_id,
    jsonb_build_object(
      'original_transaction_id', p_original_transaction_id,
      'reason', p_reason
    )
  );

  return jsonb_build_object('reversal_id', v_reversal_id, 'success', true);
end;
$$;

-- Compute capital balances view function
create or replace function get_capital_balances(p_workspace_id uuid)
returns table(
  ownership_group_id uuid,
  ownership_group_name text,
  balance_cents bigint
)
language sql
security definer
stable
set search_path = public
as $$
  select
    og.id as ownership_group_id,
    og.name as ownership_group_name,
    coalesce(sum(cle.signed_amount_cents), 0)::bigint as balance_cents
  from ownership_groups og
  left join financial_transactions ft
    on ft.workspace_id = og.workspace_id
    and ft.status = 'posted'
  left join capital_ledger_entries cle
    on cle.transaction_id = ft.id
    and cle.ownership_group_id = og.id
  where og.workspace_id = p_workspace_id
    and og.active = true
  group by og.id, og.name, og.display_order
  order by og.display_order, og.name;
$$;

-- Property cash balance
create or replace function get_property_cash_balance(p_workspace_id uuid)
returns bigint
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(sum(property_cash_effect_cents), 0)::bigint
  from financial_transactions
  where workspace_id = p_workspace_id
    and status = 'posted';
$$;
