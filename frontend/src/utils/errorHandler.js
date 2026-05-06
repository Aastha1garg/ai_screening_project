/**
 * Safely extract error message from various error object formats
 * @param {any} error - Error object, string, or other value
 * @param {string} fallback - Fallback message if error is invalid
 * @returns {string} Safe error message string
 */
export const getErrorMessage = (error, fallback = "An error occurred") => {
  if (!error) return fallback;

  // If it's already a string, return it
  if (typeof error === "string") return error;

  // If it's an object, try various common error formats
  if (typeof error === "object") {
    // Pydantic validation error format: {type, loc, msg, input}
    if (error.msg) return String(error.msg);
    
    // Common API error formats
    if (error.message) return String(error.message);
    if (error.detail) return String(error.detail);
    if (error.error) return String(error.error);
    if (error.description) return String(error.description);
    
    // If it's an array of errors (common in form validation)
    if (Array.isArray(error)) {
      return error
        .map((e) => getErrorMessage(e, fallback))
        .join("; ");
    }
    
    // Last resort: stringify the object
    try {
      return JSON.stringify(error);
    } catch (e) {
      return fallback;
    }
  }

  return fallback;
};

/**
 * Safely render error message from API responses
 * Used in JSX to avoid "Objects are not valid as a React child" error
 * @param {any} error - Error object from API
 * @param {string} fallback - Fallback message
 * @returns {string} Safe string to render
 */
export const formatErrorForDisplay = (error, fallback = "An error occurred") => {
  return getErrorMessage(error, fallback);
};
