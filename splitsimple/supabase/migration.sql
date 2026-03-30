-- SplitSimple database schema
-- Run this in Supabase SQL editor to create all tables

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  clerk_id text unique not null,
  name text not null,
  email text not null,
  created_at timestamptz default now()
);

create table if not exists trips (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_by uuid references users(id),
  created_at timestamptz default now()
);

create table if not exists trip_members (
  trip_id uuid references trips(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  primary key (trip_id, user_id)
);

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references trips(id) on delete cascade,
  description text not null,
  amount numeric(12,2) not null,
  currency text not null default 'NZD',
  paid_by uuid references users(id),
  created_at timestamptz default now(),
  notes text
);

create table if not exists expense_splits (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid references expenses(id) on delete cascade,
  user_id uuid references users(id),
  amount numeric(12,2) not null  -- always absolute, in expense currency
);

create table if not exists settlements (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references trips(id) on delete cascade,
  from_user uuid references users(id),
  to_user uuid references users(id),
  amount numeric(12,2) not null,
  currency text not null default 'NZD',
  note text,
  settled_at timestamptz default now()
);
