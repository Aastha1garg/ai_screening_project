/**
 * Format timestamp to IST (Asia/Kolkata) timezone
 * @param {string|number|Date} timestamp - The timestamp to format
 * @returns {string} Formatted date string (e.g., "05 May 2026, 10:21 AM")
 */
export const formatToIST = (timestamp) => {
  if (!timestamp) return "N/A";
  try {
    // Handle space-separated timestamps like "2026-05-05 05:06:00"
    let parsedTimestamp = timestamp;
    if (typeof timestamp === 'string' && timestamp.includes(' ') && !timestamp.includes('T')) {
      parsedTimestamp = timestamp.replace(' ', 'T');
    }
    return new Date(parsedTimestamp).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch (error) {
    console.warn('Failed to format timestamp:', error);
    return "N/A";
  }
};

/**
 * Format date based on timezone and format settings
 * @param {string|Date} timestamp - The timestamp to format
 * @param {object} settings - Language & Region settings
 * @param {string} settings.timezone - Timezone (e.g., 'Asia/Kolkata')
 * @param {string} settings.dateFormat - Format type ('DD MMM YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD')
 * @returns {string} Formatted date/time string
 */
export const formatDate = (timestamp, settings = {}) => {
  const timezone = settings.timezone || 'Asia/Kolkata';
  const dateFormat = settings.dateFormat || 'DD MMM YYYY';

  if (!timestamp) return 'N/A';

  try {
    // Handle space-separated timestamps like "2026-05-05 05:06:00"
    let parsedTimestamp = timestamp;
    if (typeof timestamp === 'string' && timestamp.includes(' ') && !timestamp.includes('T')) {
      parsedTimestamp = timestamp.replace(' ', 'T');
    }
    const date = new Date(parsedTimestamp);

    // Get date parts in the specified timezone using formatToParts for date components
    const formatter = new Intl.DateTimeFormat('en-IN', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    const parts = {};
    formatter.formatToParts(date).forEach(({ type, value }) => {
      parts[type] = value;
    });

    const day = parts.day;
    const month = parts.month;
    const year = parts.year;

    // Get full formatted datetime with time using toLocaleString (handles AM/PM correctly)
    const fullDateTime = new Date(parsedTimestamp).toLocaleString('en-IN', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    // Format based on user preference
    let formattedDate;
    switch (dateFormat) {
      case 'MM/DD/YYYY':
        formattedDate = `${month}/${day}/${year}`;
        break;
      case 'YYYY-MM-DD':
        formattedDate = `${year}-${month}-${day}`;
        break;
      case 'DD MMM YYYY':
      default:
        // Convert month number to short month name
        const monthObj = new Date(date.getFullYear(), parseInt(month) - 1);
        const monthName = monthObj.toLocaleString('en-IN', { month: 'short' });
        formattedDate = `${day} ${monthName} ${year}`;
        break;
    }

    return `${formattedDate}, ${fullDateTime}`;
  } catch (error) {
    console.warn('Failed to format date:', error);
    return 'N/A';
  }
};

/**
 * Simple helper to format timestamps for IST (Asia/Kolkata)
 * Useful for quick formatting without needing language settings
 * @param {string|number|Date} ts - The timestamp to format
 * @returns {string} Formatted datetime (e.g., "05 May 2026, 10:21 AM")
 */
export const formatDateTime = (ts) => {
  if (!ts) return '';
  try {
    // Handle space-separated timestamps like "2026-05-05 05:06:00"
    const safeTs = typeof ts === 'string' && ts.includes(' ') && !ts.includes('T')
      ? ts.replace(' ', 'T')
      : ts;

    return new Date(safeTs).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch (error) {
    console.warn('Failed to format datetime:', error);
    return '';
  }
};

