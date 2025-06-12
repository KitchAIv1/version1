import {
  format,
  formatDistanceToNow,
  isToday,
  isYesterday,
  parseISO,
} from 'date-fns';

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
      return format(date, "MMM d 'at' h:mm a");
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
export const formatDetailedTimestamp = (
  timestamp: string | undefined,
): string => {
  if (!timestamp) return '';

  try {
    const date = parseISO(timestamp);
    return format(date, "MMM d, yyyy 'at' h:mm a");
  } catch (error) {
    console.error('Error formatting detailed timestamp:', error);
    return '';
  }
};

/**
 * Gets a short relative time string optimized for pantry/grocery items
 * Best practice: relative time for recent, absolute for older
 */
export const getShortRelativeTime = (timestamp: string | undefined): string => {
  if (!timestamp) return '';

  try {
    const date = parseISO(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60),
    );

    // Less than 1 minute: "now"
    if (diffInMinutes < 1) {
      return 'now';
    }

    // 1-59 minutes: "5m ago"
    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    }

    // 1-23 hours: "3h ago"
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    }

    // 24+ hours: switch to absolute time for clarity
    // If yesterday, show "Yesterday"
    if (isYesterday(date)) {
      return 'Yesterday';
    }

    // If this year, show "Dec 15"
    if (date.getFullYear() === now.getFullYear()) {
      return format(date, 'MMM d');
    }

    // If older, show "Dec 15, 2023"
    return format(date, 'MMM d, yyyy');
  } catch (error) {
    console.error('Error getting short relative time:', error);
    return '';
  }
};

/**
 * Gets the most recent activity timestamp and appropriate label
 * Considers both created_at and updated_at to show the latest activity
 * @param created_at - When the item was originally created
 * @param updated_at - When the item was last updated (e.g., from merge)
 * @returns Object with timestamp, label, and formatted time
 */
export const getMostRecentActivity = (
  created_at: string | undefined,
  updated_at: string | undefined
): {
  timestamp: string;
  label: string;
  formattedTime: string;
} => {
  if (!created_at) {
    return {
      timestamp: '',
      label: '',
      formattedTime: '',
    };
  }

  try {
    const createdDate = parseISO(created_at);
    const updatedDate = updated_at ? parseISO(updated_at) : null;

    // If no updated_at or updated_at is same as created_at, show as "Added"
    if (!updatedDate || Math.abs(updatedDate.getTime() - createdDate.getTime()) < 1000) {
      return {
        timestamp: created_at,
        label: 'Added',
        formattedTime: getShortRelativeTime(created_at),
      };
    }

    // If updated_at is more recent than created_at, show as "Updated"
    if (updatedDate.getTime() > createdDate.getTime()) {
      return {
        timestamp: updated_at!,
        label: 'Updated',
        formattedTime: getShortRelativeTime(updated_at),
      };
    }

    // Fallback to created_at
    return {
      timestamp: created_at,
      label: 'Added',
      formattedTime: getShortRelativeTime(created_at),
    };
  } catch (error) {
    console.error('Error determining most recent activity:', error);
    return {
      timestamp: created_at,
      label: 'Added',
      formattedTime: getShortRelativeTime(created_at),
    };
  }
};
