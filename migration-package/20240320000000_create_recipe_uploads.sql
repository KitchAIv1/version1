-- Create recipe_uploads table
create table recipe_uploads (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null,
  title text not null,
  video_url text not null,
  description text,
  ingredients jsonb,
  diet_tags text[],
  preparation_steps jsonb,
  prep_time_minutes integer,
  cook_time_minutes integer,
  servings integer,
  is_public boolean default true,
  created_at timestamp with time zone default now()
);

-- Add RLS policies
alter table recipe_uploads enable row level security;

-- Allow users to view public recipes
create policy "Public recipes are viewable by everyone"
  on recipe_uploads for select
  using (is_public = true);

-- Allow users to view their own recipes (public or private)
create policy "Users can view their own recipes"
  on recipe_uploads for select
  using (auth.uid() = user_id);

-- Allow users to insert their own recipes
create policy "Users can insert their own recipes"
  on recipe_uploads for insert
  with check (auth.uid() = user_id);

-- Allow users to update their own recipes
create policy "Users can update their own recipes"
  on recipe_uploads for update
  using (auth.uid() = user_id);

-- Allow users to delete their own recipes
create policy "Users can delete their own recipes"
  on recipe_uploads for delete
  using (auth.uid() = user_id);

-- Create index for faster queries
create index recipe_uploads_user_id_idx on recipe_uploads(user_id);
create index recipe_uploads_created_at_idx on recipe_uploads(created_at desc); 