import { Config } from './config.js';

/**
 * Security-focused input validation
 * Ported from bash script with enhanced TypeScript safety
 */

/**
 * Maximum allowed input length (matches bash CONFIG_MAX_LENGTH)
 */
const MAX_INPUT_LENGTH = 1000;

/**
 * Maximum allowed path length (prevents buffer overflow attacks)
 */
const MAX_PATH_LENGTH = 4096;

/**
 * Dangerous characters and patterns to check in paths
 */
const DANGEROUS_PATH_PATTERNS = [
  /\.\./, // Directory traversal
  /\.\.\\/, // Windows traversal
  /\[/, // Potential command injection
  /;/, // Command separator
  /&/, // Background execution
  /</, // Input redirection
  />/, // Output redirection
  /`/, // Command substitution
];

/**
 * Validates JSON input from Claude Code
 * Implements the same security checks as the bash version
 */
export function validateInput(input: string, config: Config): boolean {
  // Basic input sanity checks
  if (!input || typeof input !== 'string') {
    return false;
  }

  // Strip trailing whitespace
  const cleanedInput = input.trimEnd();

  // Length validation
  if (cleanedInput.length === 0 || cleanedInput.length > config.maxLength) {
    return false;
  }

  // Basic JSON structure validation
  if (!cleanedInput.includes('{') || !cleanedInput.includes('}')) {
    return false;
  }

  // Quote validation - must have balanced quotes
  const quoteCount = (cleanedInput.match(/"/g) || []).length;
  if (quoteCount === 0 || quoteCount % 2 !== 0) {
    return false;
  }

  // Try to parse JSON to ensure it's valid
  try {
    JSON.parse(cleanedInput);
  } catch {
    return false;
  }

  return true;
}

/**
 * Validates file system paths to prevent directory traversal and command injection
 */
export function validatePath(path: string): boolean {
  // Basic input validation
  if (!path || typeof path !== 'string') {
    return false;
  }

  // Length validation
  if (path.length > MAX_PATH_LENGTH) {
    return false;
  }

  // Check for dangerous patterns
  for (const pattern of DANGEROUS_PATH_PATTERNS) {
    if (pattern.test(path)) {
      return false;
    }
  }

  // Additional safety checks for common attack vectors
  if (path.includes('${') || path.includes('`') || path.includes('$(')) {
    return false;
  }

  // Normalize path and check for resolved traversal attempts
  try {
    // This would require importing path module, but for now we'll do basic checks
    const normalized = path.replace(/\/+/g, '/').replace(/\\+/g, '\\');

    // Still contains traversal after normalization?
    if (normalized.includes('../') || normalized.includes('..\\')) {
      return false;
    }

    // Check for absolute paths that might be suspicious
    if (normalized.startsWith('/') && !normalized.startsWith('/home/') && !normalized.startsWith('/Users/') && !normalized.startsWith('/tmp/')) {
      // Allow common safe absolute paths but be cautious
      const safeRoots = ['/home', '/Users', '/tmp', '/var', '/opt'];
      const isSafeRoot = safeRoots.some(root => normalized.startsWith(root));
      if (!isSafeRoot) {
        return false;
      }
    }

    // Windows path checks
    if (normalized.includes(':') && /^[A-Za-z]:/.test(normalized)) {
      // Windows drive letter - check if it's a reasonable path
      const driveLetter = normalized.charAt(0).toUpperCase();
      if (driveLetter < 'C' || driveLetter > 'Z') {
        return false;
      }
    }

  } catch {
    return false;
  }

  return true;
}

/**
 * Sanitizes string input for safe display
 * Removes or escapes potentially dangerous characters
 */
export function sanitizeString(input: string, maxLength: number = 200): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Remove control characters except common safe ones
  let sanitized = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
}

/**
 * Validates that a directory exists and is accessible
 */
export async function validateDirectory(path: string): Promise<boolean> {
  if (!validatePath(path)) {
    return false;
  }

  try {
    // Use dynamic import for fs/promises to avoid issues in some environments
    const { access } = await import('fs/promises');
    const { constants } = await import('fs');

    await access(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Security configuration object
 */
export const SECURITY_CONFIG = {
  MAX_INPUT_LENGTH,
  MAX_PATH_LENGTH,
  DANGEROUS_PATH_PATTERNS,
} as const;