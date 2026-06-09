-- ============================================================
-- The Flourishing Atlas — database schema (Supabase / Postgres)
-- Run this in the Supabase SQL editor once, on a new project.
-- ============================================================

-- Each authenticated user has one balance row.
-- The user id comes from Supabase Auth (auth.users).
create table if not exists public.balances (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  credits    integer not null default 0 check (credits >= 0),
  email      text,
  updated_at timestamptz not null default now()
);

-- An append-only ledger: every grant (purchase) and every spend (survey run).
-- This is the audit trail — you can always reconstruct a balance from it,
-- and it lets you investigate disputes without guessing.
create table if not exists public.credit_ledger (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users(id) on delete cascade,
  delta         integer not null,              -- +N for a purchase, -1 for a run
  reason        text not null,                 -- 'purchase' | 'survey' | 'adjustment'
  stripe_event  text,                          -- Stripe event id, for purchases (dedupe)
  created_at    timestamptz not null default now()
);

-- Prevent processing the same Stripe webhook event twice (idempotency).
create unique index if not exists credit_ledger_stripe_event_uniq
  on public.credit_ledger (stripe_event)
  where stripe_event is not null;

create index if not exists credit_ledger_user_idx
  on public.credit_ledger (user_id, created_at desc);

-- ============================================================
-- Row-Level Security
-- ============================================================
alter table public.balances enable row level security;
alter table public.credit_ledger enable row level security;

-- Users may READ their own balance and ledger. They may never write to either
-- from the client — all writes happen server-side via the service-role key,
-- which bypasses RLS. This is what stops a user from editing their own credits.
drop policy if exists "read own balance" on public.balances;
create policy "read own balance" on public.balances
  for select using (auth.uid() = user_id);

drop policy if exists "read own ledger" on public.credit_ledger;
create policy "read own ledger" on public.credit_ledger
  for select using (auth.uid() = user_id);

-- ============================================================
-- Atomic spend: decrement one credit only if the user has one.
-- Returns the new balance, or -1 if insufficient. Called server-side.
-- Doing this as a single SQL function avoids a read-then-write race
-- where two simultaneous requests could both pass a balance check.
-- ============================================================
create or replace function public.spend_one_credit(p_user_id uuid)
returns integer
language plpgsql
security definer
as $$
declare
  new_balance integer;
begin
  update public.balances
    set credits = credits - 1, updated_at = now()
    where user_id = p_user_id and credits > 0
    returning credits into new_balance;

  if new_balance is null then
    return -1;  -- no row, or no credits left
  end if;

  insert into public.credit_ledger (user_id, delta, reason)
    values (p_user_id, -1, 'survey');

  return new_balance;
end;
$$;

-- ============================================================
-- Atomic grant: add credits from a verified Stripe purchase.
-- Idempotent on stripe_event — replaying the same event is a no-op.
-- ============================================================
create or replace function public.grant_credits(
  p_user_id uuid,
  p_email text,
  p_amount integer,
  p_stripe_event text
)
returns void
language plpgsql
security definer
as $$
begin
  -- If we've already recorded this event, do nothing.
  if exists (select 1 from public.credit_ledger where stripe_event = p_stripe_event) then
    return;
  end if;

  insert into public.balances (user_id, credits, email)
    values (p_user_id, p_amount, p_email)
    on conflict (user_id)
    do update set credits = public.balances.credits + p_amount,
                  email = excluded.email,
                  updated_at = now();

  insert into public.credit_ledger (user_id, delta, reason, stripe_event)
    values (p_user_id, p_amount, 'purchase', p_stripe_event);
end;
$$;
