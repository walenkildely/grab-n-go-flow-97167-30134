create table if not exists push_subscriptions (
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, endpoint)
);

alter table push_subscriptions enable row level security;
