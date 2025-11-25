/**
 * Authentication Manager
 * Centralized authentication and session management
 */

const jwt = require('jsonwebtoken');

class AuthManager {
  constructor(db, jwtSecret) {
    this.db = db;
    this.jwtSecret = jwtSecret;
  }

  /**
   * Check if a session is valid
   * @param {string} sessionId - The session ID to validate
   * @returns {Promise<boolean>} True if session is valid
   */
  async isSessionValid(sessionId) {
    try {
      const [rows] = await this.db.promise().query(
        'SELECT 1 FROM sessions WHERE session_id = ? AND expires > UNIX_TIMESTAMP(NOW())',
        [sessionId]
      );
      return rows.length > 0;
    } catch (error) {
      console.error('Session check error:', error);
      return false;
    }
  }

  /**
   * Get user by forum ID
   * @param {number} forumUserID - The forum user ID
   * @returns {Promise<object|null>} User object or null
   */
  async getUserByForumId(forumUserID) {
    const [rows] = await this.db.promise().query(
      'SELECT id, is_admin FROM users WHERE forum_userID = ?',
      [forumUserID]
    );
    return rows?.[0] || null;
  }

  /**
   * Get user by internal ID
   * @param {number} userId - The internal user ID
   * @returns {Promise<object|null>} User object or null
   */
  async getUserById(userId) {
    const [rows] = await this.db.promise().query(
      'SELECT id, forum_userID, username, email, is_admin FROM users WHERE id = ?',
      [userId]
    );
    return rows?.[0] || null;
  }

  /**
   * Create or update user
   * @param {number} forumUserID - The forum user ID
   * @param {string} username - The username
   * @param {string} email - The email
   * @returns {Promise<object>} User object
   */
  async createOrUpdateUser(forumUserID, username, email) {
    await this.db.promise().query(
      'INSERT INTO users (forum_userID, username, email) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE username=VALUES(username), email=VALUES(email)',
      [forumUserID, username, email]
    );

    return await this.getUserByForumId(forumUserID);
  }

  /**
   * Create JWT token
   * @param {number} userId - The user ID
   * @param {string} sessionId - The session ID
   * @param {string} expiresIn - Token expiration time (default: 24h)
   * @returns {string} JWT token
   */
  createJWT(userId, sessionId, expiresIn = '24h') {
    return jwt.sign(
      { userId, sessionId },
      this.jwtSecret,
      { expiresIn }
    );
  }

  /**
   * Verify JWT token
   * @param {string} token - The JWT token
   * @returns {Promise<object|null>} Decoded token or null if invalid
   */
  async verifyJWT(token) {
    return new Promise((resolve) => {
      jwt.verify(token, this.jwtSecret, (err, decoded) => {
        if (err) {
          resolve(null);
        } else {
          resolve(decoded);
        }
      });
    });
  }

  /**
   * Validate token and session
   * @param {string} token - The JWT token
   * @returns {Promise<object|null>} User data if valid, null otherwise
   */
  async validateTokenAndSession(token) {
    const decoded = await this.verifyJWT(token);
    if (!decoded) return null;

    const isValid = await this.isSessionValid(decoded.sessionId);
    if (!isValid) return null;

    const user = await this.getUserById(decoded.userId);
    return user;
  }
}

module.exports = AuthManager;
