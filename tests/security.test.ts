/**
 * Security tests for Claude Statusline
 * Tests input validation and security features
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { validateInput, validatePath, sanitizeString } from '../src/core/security.js';
import { loadConfig } from '../src/core/config.js';

describe('Security Tests', () => {
  let config: any;

  beforeEach(() => {
    config = loadConfig();
  });

  describe('Input Validation', () => {
    it('should accept valid JSON input', () => {
      const validInput = '{"workspace":{"current_dir":"/home/user/project"},"model":{"display_name":"Test"}}';
      assert.strictEqual(validateInput(validInput, config), true);
    });

    it('should reject empty input', () => {
      assert.strictEqual(validateInput('', config), false);
      assert.strictEqual(validateInput(null as any, config), false);
      assert.strictEqual(validateInput(undefined as any, config), false);
    });

    it('should reject input that exceeds maximum length', () => {
      const longInput = '{"workspace":{"current_dir":"' + 'a'.repeat(config.maxLength + 1) + '"}}';
      assert.strictEqual(validateInput(longInput, config), false);
    });

    it('should reject input without proper JSON structure', () => {
      const invalidJson = '{"workspace":{"current_dir":/home/user/project}}';
      assert.strictEqual(validateInput(invalidJson, config), false);
    });

    it('should reject input with unbalanced quotes', () => {
      const unbalancedQuotes = '{"workspace":{"current_dir":"/home/user/project"}';
      assert.strictEqual(validateInput(unbalancedQuotes, config), false);
    });

    it('should accept input with valid JSON but no quotes in values', () => {
      const validInput = '{"workspace":{"current_dir":"/home/user/project"},"model":{"display_name":"Test"}}';
      assert.strictEqual(validateInput(validInput, config), true);
    });

    it('should reject input with zero quotes', () => {
      const noQuotes = '{workspace:{current_dir:/home/user/project}}';
      assert.strictEqual(validateInput(noQuotes, config), false);
    });
  });

  describe('Path Validation', () => {
    it('should accept valid absolute paths', () => {
      assert.strictEqual(validatePath('/home/user/project'), true);
      assert.strictEqual(validatePath('/tmp/test'), true);
      assert.strictEqual(validatePath('/var/log/app.log'), true);
    });

    it('should reject directory traversal attempts', () => {
      assert.strictEqual(validatePath('../../../etc/passwd'), false);
      assert.strictEqual(validatePath('/home/user/../../../etc/passwd'), false);
      assert.strictEqual(validatePath('..\\..\\windows\\system32'), false);
    });

    it('should reject paths with dangerous characters', () => {
      assert.strictEqual(validatePath('/path/with[bracket'), false);
      assert.strictEqual(validatePath('/path/with;semicolon'), false);
      assert.strictEqual(validatePath('/path/with&ampersand'), false);
      assert.strictEqual(validatePath('/path/with<lessthan'), false);
      assert.strictEqual(validatePath('/path/with>greaterthan'), false);
      assert.strictEqual(validatePath('/path/with`backtick'), false);
    });

    it('should reject extremely long paths', () => {
      const longPath = '/home/user/' + 'a'.repeat(5000);
      assert.strictEqual(validatePath(longPath), false);
    });

    it('should reject empty or null paths', () => {
      assert.strictEqual(validatePath(''), false);
      assert.strictEqual(validatePath(null as any), false);
      assert.strictEqual(validatePath(undefined as any), false);
    });

    it('should reject command injection attempts', () => {
      assert.strictEqual(validatePath('/path/$(rm -rf /)'), false);
      assert.strictEqual(validatePath('/path/${HOME}'), false);
      assert.strictEqual(validatePath('/path/`whoami`'), false);
    });

    it('should accept reasonable Windows paths', () => {
      assert.strictEqual(validatePath('C:\\Users\\User\\Project'), true);
      assert.strictEqual(validatePath('D:\\Development\\app'), true);
    });

    it('should reject suspicious Windows paths', () => {
      assert.strictEqual(validatePath('Z:\\Suspicious\\Path'), false);
    });
  });

  describe('String Sanitization', () => {
    it('should sanitize control characters', () => {
      const malicious = 'text\x00\x01\x02\x08\x0B\x0C\x0E\x1F\x7Fwith\x07control\x0Bchars';
      const expected = 'textwithcontrolchars';
      assert.strictEqual(sanitizeString(malicious), expected);
    });

    it('should limit string length', () => {
      const longString = 'a'.repeat(300);
      const result = sanitizeString(longString, 100);
      assert.strictEqual(result.length, 100);
      assert.strictEqual(result, 'a'.repeat(100));
    });

    it('should handle empty or null input', () => {
      assert.strictEqual(sanitizeString(''), '');
      assert.strictEqual(sanitizeString(null as any), '');
      assert.strictEqual(sanitizeString(undefined as any), '');
    });

    it('should preserve valid characters', () => {
      const valid = 'Hello, World! 123 @#$%^&*()';
      assert.strictEqual(sanitizeString(valid), valid);
    });

    it('should remove only dangerous control characters', () => {
      const mixed = 'Hello\x00World\x07Test\x1F123';
      assert.strictEqual(sanitizeString(mixed), 'HelloWorldTest123');
    });
  });

  describe('Integration Tests', () => {
    it('should handle real Claude Code input format', () => {
      const realInput = JSON.stringify({
        workspace: {
          current_dir: '/Users/user/development/my-project'
        },
        model: {
          display_name: 'Claude Sonnet 4.5'
        }
      });

      assert.strictEqual(validateInput(realInput, config), true);
    });

    it('should reject malformed Claude Code input', () => {
      const malformedInput = JSON.stringify({
        workspace: {
          current_dir: '../../../etc/passwd'
        },
        model: {
          display_name: 'Claude Sonnet 4.5'
        }
      });

      // Input format is valid JSON, but path validation would catch this
      assert.strictEqual(validateInput(malformedInput, config), true); // JSON is valid
      assert.strictEqual(validatePath('../../../etc/passwd'), false); // Path is invalid
    });

    it('should handle configuration-based limits', () => {
      const customConfig = { ...config, maxLength: 50 };
      const longInput = '{"workspace":{"current_dir":"' + 'a'.repeat(100) + '"}}';

      assert.strictEqual(validateInput(longInput, customConfig), false);
    });
  });
});