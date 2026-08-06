create table if not exists public.push_devices (
  user_id uuid not null references public.users(id) on delete cascade,
  device_id text not null,
  platform text not null check (platform in ('web', 'android', 'ios')),
  push_token text not null,
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  primary key (user_id, device_id)
);

create unique index if not exists push_devices_push_token_key on public.push_devices (push_token);
create index if not exists push_devices_user_id_last_seen_idx on public.push_devices (user_id, last_seen desc);

create table if not exists public.notification_preferences (
  user_id uuid primary key references public.users(id) on delete cascade,
  dm boolean not null default true,
  groups boolean not null default true,
  calls boolean not null default true,
  mentions boolean not null default true,
  friend_requests boolean not null default true
);

alter table public.push_devices enable row level security;
alter table public.notification_preferences enable row level security;

-- Descall uses custom JWTs and its service-role backend for data access:
-- no browser-facing table policies are granted.
revoke all on public.push_devices, public.notification_preferences from anon, authenticated;
