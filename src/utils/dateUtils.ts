import { format, formatDistanceToNow, isToday, isYesterday, parseISO } from 'date-fns';

/**
 * Formats a timestamp for display in the pantry list
 * Shows relative time for recent items, absolute time for older items
 */
export const formatStockTimestamp = (timestamp: string | undefined): string => {
  if (!timestamp) return '';
  
  try {
    const date = parseISO(timestamp);
    const now = new Date();
    
    // If today, show relative time (e.g., "2 hours ago")
    if (isToday(date)) {
      return formatDistanceToNow(date, { addSuffix: true });
    }
    
    // If yesterday, show "Yesterday at 3:30 PM"
    if (isYesterday(date)) {
      return `Yesterday at ${format(date, 'h:mm a')}`;
    }
    
    // If this year, show "Mar 15 at 3:30 PM"
    if (date.getFullYear() === now.getFullYear()) {
      return format(date, 'MMM d \'at\' h:mm a');
    }
    
    // If older, show full date "Mar 15, 2023"
    return format(date, 'MMM d, yyyy');
  } catch (error) {
    console.error('Error formatting timestamp:', error);
    return '';
  }
};

/**
 * Formats a timestamp for detailed view (e.g., in modals)
 */
export const formatDetailedTimestamp = (timestamp: string | undefined): string => {
  if (!timestamp) return '';
  
  try {
    const date = parseISO(timestamp);
    return format(date, 'MMM d, yyyy \'at\' h:mm a');
  } catch (error) {
    console.error('Error formatting detailed timestamp:', error);
    return '';
  }
};

/**
 * Gets a short relative time string (e.g., "2h", "3d", "1w")
 */
export const getShortRelativeTime = (timestamp: string | undefined): string => {
  if (!timestamp) return '';
  
  try {
    const date = parseISO(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 60) {
      return diffInMinutes < 1 ? 'now' : `${diffInMinutes}m`;
    }
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return `${diffInHours}h`;
    }
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) {
      return `${diffInDays}d`;
    }
    
    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks < 4) {
      return `${diffInWeeks}w`;
    }
    
    const diffInMonths = Math.floor(diffInDays / 30);
    return `${diffInMonths}mo`;
  } catch (error) {
    console.error('Error getting short relative time:', error);
    return '';
  }
}; 