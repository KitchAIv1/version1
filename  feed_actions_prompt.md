# Sprint-2 part B – Like/Save overlay + real Supabase feed

## 0. Ensure DB RPCs exist
(From Supabase doc you uploaded)
• /rpc/get_feed(cursor TEXT DEFAULT NULL)
• /rpc/like_recipe(recipe_id UUID)
• /rpc/save_recipe(recipe_id UUID)

## 1. Update useFeed hook with Supabase query
**src/hooks/useFeed.ts**
```ts
import { useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '../services/supabase';

export const useFeed = () =>
  useInfiniteQuery({
    queryKey: ['feed'],
    queryFn: async ({ pageParam = null }) => {
      const { data, error } = await supabase
        .rpc('get_feed', { cursor: pageParam });
      if (error) throw error;
      return data;                   // returns array of 5–10 recipes
    },
    getNextPageParam: (lastPage) =>
      lastPage?.length ? lastPage[lastPage.length - 1].cursor : undefined,
  });