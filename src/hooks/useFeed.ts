import { useInfiniteQuery } from '@tanstack/react-query';
import { RecipeItem } from '../types'; // Import the type

// Dummy recipe data typed
const dummy: RecipeItem[] = Array.from({ length: 10 }).map((_, i) => ({
  id: String(i),
  title: `Dummy Recipe #${i + 1}`,
  video: 'https://www.w3schools.com/html/mov_bbb.mp4', // sample 10-sec mp4
  pantryMatchPct: Math.floor(Math.random() * 100),
}));

/**
 * Hook to fetch feed data using infinite scrolling.
 * Currently uses dummy data.
 */
export const useFeed = () =>
  useInfiniteQuery<
    RecipeItem[], // Data type returned by queryFn (a single page)
    Error,        // Error type
    RecipeItem[], // Select result type (defaults to TData)
    string[],     // QueryKey type
    number        // PageParam type
  >({
    queryKey: ['feed'],
    queryFn: async ({ pageParam = 0 }) => {
      console.log(`Fetching feed page: ${pageParam}`);
      await new Promise(resolve => setTimeout(resolve, 500));
      // Return type here matches RecipeItem[]
      return dummy.slice(pageParam, pageParam + 5);
    },
    getNextPageParam: (lastPage, allPages) => {
      // Calculate the total number of items fetched across all pages
      const totalFetchedItems = allPages.reduce((acc, page) => acc + page.length, 0);
      // If we haven't fetched all dummy items, return the next starting index
      return totalFetchedItems < dummy.length ? totalFetchedItems : undefined;
    },
    initialPageParam: 0,
  }); 