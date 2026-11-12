import { Request, Response, NextFunction } from 'express';

// In-memory rate limiting / brute-force tracker for admin actions
interface FailedAttemptRecord {
  count: number;
  blockedUntil: number;
}

const failedAttempts = new Map<string, FailedAttemptRecord>();

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes lockout

// Clean up old records periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of failedAttempts.entries()) {
    if (record.blockedUntil > 0 && record.blockedUntil < now) {
      failedAttempts.delete(ip);
    }
  }
}, 5 * 60 * 1000);

export const adminAuth = (req: Request, res: Response, next: NextFunction): void => {
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || 'unknown';
  const now = Date.now();

  // Check if IP is currently locked out
  const attemptRecord = failedAttempts.get(clientIp);
  if (attemptRecord && attemptRecord.blockedUntil > now) {
    const remainingSecs = Math.ceil((attemptRecord.blockedUntil - now) / 1000);
    res.status(429).json({
      success: false,
      message: `Too many failed admin attempts. Access locked for ${remainingSecs} seconds.`,
      locked: true,
      remainingSeconds: remainingSecs,
    });
    return;
  }

  const expectedKey = process.env.ADMIN_SECRET_KEY?.trim();
  if (!expectedKey) {
    console.error('🚨 [AdminAuth] Access blocked: ADMIN_SECRET_KEY is not configured in server environment.');
    res.status(500).json({
      success: false,
      message: 'Server configuration error: ADMIN_SECRET_KEY is not configured.',
    });
    return;
  }

  const providedKey = req.headers['x-admin-key'] as string;

  if (!providedKey || providedKey !== expectedKey) {
    // Record failed attempt
    const current = attemptRecord || { count: 0, blockedUntil: 0 };
    current.count += 1;

    if (current.count >= MAX_FAILED_ATTEMPTS) {
      current.blockedUntil = now + LOCKOUT_DURATION_MS;
      failedAttempts.set(clientIp, current);
      res.status(429).json({
        success: false,
        message: 'Maximum admin authentication attempts exceeded. Locked out for 15 minutes.',
        locked: true,
      });
      return;
    }

    failedAttempts.set(clientIp, current);

    res.status(401).json({
      success: false,
      message: 'Unauthorized: Invalid or missing Admin Security Passcode.',
      remainingAttempts: MAX_FAILED_ATTEMPTS - current.count,
    });
    return;
  }

  // Reset failed attempts on successful authentication
  if (failedAttempts.has(clientIp)) {
    failedAttempts.delete(clientIp);
  }

  next();
};

// Input sanitization helper to prevent XSS / script injection
export const sanitizeIPOInput = (req: Request, _res: Response, next: NextFunction): void => {
  const sanitizeString = (str: any): any => {
    if (typeof str !== 'string') return str;
    return str
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove <script> tags
      .replace(/javascript:/gi, '') // Remove javascript: pseudo-protocol
      .replace(/on\w+=/gi, '') // Remove inline handlers like onload=, onerror=
      .trim();
  };

  const sanitizeObject = (obj: any): any => {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(sanitizeObject);
    
    const sanitized: any = {};
    for (const [key, val] of Object.entries(obj)) {
      if (typeof val === 'string') {
        sanitized[key] = sanitizeString(val);
      } else if (typeof val === 'object' && val !== null) {
        sanitized[key] = sanitizeObject(val);
      } else {
        sanitized[key] = val;
      }
    }
    return sanitized;
  };

  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }

  next();
};
