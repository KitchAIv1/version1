// Feed refresh utility to avoid circular dependencies
let feedRefreshCallback: (() => void) | null = null;

export const registerFeedRefresh = (refreshFn: () => void) => {
  feedRefreshCallback = refreshFn;
};

export const triggerFeedRefresh = () => {
  if (feedRefreshCallback) {
    feedRefreshCallback();
  }
}; 