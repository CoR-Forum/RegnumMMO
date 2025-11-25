/**
 * Error Handler
 * Centralized error handling and logging for sockets and HTTP
 */

class ErrorHandler {
  /**
   * Handle socket error
   * @param {object} socket - Socket.io socket object
   * @param {string} context - Context/operation where error occurred
   * @returns {function} Error handler function
   */
  static handleSocketError(socket, context) {
    return (error) => {
      console.error(`[${context}]`, error);
      socket.emit('error', `Operation failed: ${error.message}`);
    };
  }

  /**
   * Handle HTTP error
   * @param {object} res - Express response object
   * @param {string} context - Context/operation where error occurred
   * @param {number} statusCode - HTTP status code (default: 500)
   * @returns {function} Error handler function
   */
  static handleHTTPError(res, context, statusCode = 500) {
    return (error) => {
      console.error(`[${context}]`, error);
      res.status(statusCode).json({ error: error.message });
    };
  }

  /**
   * Send error response via socket
   * @param {object} socket - Socket.io socket object
   * @param {string} message - Error message
   * @param {string} context - Optional context for logging
   */
  static sendSocketError(socket, message, context = null) {
    if (context) {
      console.error(`[${context}]`, message);
    }
    socket.emit('error', message);
  }

  /**
   * Send error response via HTTP
   * @param {object} res - Express response object
   * @param {string} message - Error message
   * @param {number} statusCode - HTTP status code (default: 500)
   * @param {string} context - Optional context for logging
   */
  static sendHTTPError(res, message, statusCode = 500, context = null) {
    if (context) {
      console.error(`[${context}]`, message);
    }
    res.status(statusCode).json({ error: message });
  }

  /**
   * Log error without sending response
   * @param {string} context - Context/operation where error occurred
   * @param {Error|string} error - Error object or message
   */
  static logError(context, error) {
    console.error(`[${context}]`, error);
  }

  /**
   * Wrap async socket handler with error handling
   * @param {function} handler - Async handler function
   * @param {string} context - Context for error logging
   * @returns {function} Wrapped handler
   */
  static wrapSocketHandler(handler, context) {
    return async (...args) => {
      try {
        await handler(...args);
      } catch (error) {
        console.error(`[${context}]`, error);
        // Get socket from args (usually first or second parameter)
        const socket = args.find(arg => arg && typeof arg.emit === 'function');
        if (socket) {
          socket.emit('error', `Operation failed: ${error.message}`);
        }
      }
    };
  }

  /**
   * Wrap async HTTP handler with error handling
   * @param {function} handler - Async handler function
   * @param {string} context - Context for error logging
   * @returns {function} Wrapped handler
   */
  static wrapHTTPHandler(handler, context) {
    return async (req, res, next) => {
      try {
        await handler(req, res, next);
      } catch (error) {
        console.error(`[${context}]`, error);
        res.status(500).json({ error: error.message });
      }
    };
  }
}

module.exports = ErrorHandler;
