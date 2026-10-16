alter table clients
  add column if not exists iam_click_count text not null default 'first'
  check (iam_click_count in ('first', 'both'));
