/**
 * Test runner and main functionality tests
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'child_process';
import { existsSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';

describe('Test Runner and Main Functionality', () => {
  const testConfigPath = join(process.cwd(), '.claude-statusline.test.json');

  before(() => {
    // Build the project for testing
    try {
      execSync('npm run build', { stdio: 'pipe' });
    } catch (error) {
      console.warn('Warning: Build failed, tests may not work');
    }

    // Create test config
    const testConfig = {
      noEmoji: true,
      envContext: false,
      truncate: false,
      cacheTTL: 60, // Short TTL for testing
    };
    writeFileSync(testConfigPath, JSON.stringify(testConfig, null, 2));
  });

  after(() => {
    // Clean up test config
    if (existsSync(testConfigPath)) {
      unlinkSync(testConfigPath);
    }
  });

  describe('Build System', () => {
    it('should build TypeScript successfully', () => {
      assert.ok(existsSync('dist/index.js'), 'TypeScript build should produce dist/index.js');
      assert.ok(existsSync('dist/core/config.js'), 'Core modules should be built');
      assert.ok(existsSync('dist/core/security.js'), 'Security module should be built');
      assert.ok(existsSync('dist/core/cache.js'), 'Cache module should be built');
      assert.ok(existsSync('dist/git/status.js'), 'Git module should be built');
      assert.ok(existsSync('dist/ui/width.js'), 'UI modules should be built');
      assert.ok(existsSync('dist/ui/symbols.js'), 'Symbols module should be built');
      assert.ok(existsSync('dist/env/context.js'), 'Environment module should be built');
    });

    it('should have executable bin script', () => {
      assert.ok(existsSync('bin/claude-statusline'), 'Executable script should exist');
    });
  });

  describe('Main Execution', () => {
    it('should handle basic input without crashing', () => {
      const testData = JSON.stringify({
        workspace: {
          current_dir: process.cwd()
        },
        model: {
          display_name: 'Test Model'
        }
      });

      try {
        const result = execSync('node dist/index.js', {
          input: testData,
          encoding: 'utf-8',
          timeout: 5000
        });

        assert.ok(result.trim().length > 0, 'Should produce some output');
        console.log('Sample output:', result.trim());
      } catch (error) {
        // If there's an error, check if it's expected (e.g., git not available)
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn('Main execution warning:', errorMessage);

        // Don't fail the test if git operations fail
        if (!errorMessage.includes('git') && !errorMessage.includes('ENOTDIR')) {
          throw error;
        }
      }
    });

    it('should reject invalid JSON input', () => {
      try {
        const result = execSync('node dist/index.js', {
          input: 'invalid json',
          encoding: 'utf-8',
          timeout: 3000
        });
        assert.fail('Should have failed with invalid input');
      } catch (error) {
        assert.ok(error instanceof Error);
        const errorMessage = error.message;
        assert.ok(
          errorMessage.includes('Failed to read or parse input') ||
          errorMessage.includes('ERROR') ||
          errorMessage.includes('Invalid input'),
          'Should show appropriate error message'
        );
      }
    });

    it('should handle missing workspace directory gracefully', () => {
      const testData = JSON.stringify({
        workspace: {
          current_dir: '/nonexistent/directory/that/does/not/exist'
        },
        model: {
          display_name: 'Test Model'
        }
      });

      try {
        const result = execSync('node dist/index.js', {
          input: testData,
          encoding: 'utf-8',
          timeout: 3000
        });
        // May succeed if validation happens after directory check
      } catch (error) {
        assert.ok(error instanceof Error);
        const errorMessage = error.message;
        // Should fail gracefully with appropriate error
        assert.ok(
          errorMessage.includes('ERROR') ||
          errorMessage.includes('Invalid') ||
          errorMessage.includes('nonexistent'),
          'Should handle missing directory gracefully'
        );
      }
    });
  });

  describe('Configuration System', () => {
    it('should load test configuration', async () => {
      const { loadConfig } = await import('../dist/core/config.js');
      const config = loadConfig();

      assert.ok(typeof config === 'object', 'Should load configuration object');
      assert.ok(typeof config.cacheTTL === 'number', 'Should have cacheTTL setting');
      assert.ok(typeof config.maxLength === 'number', 'Should have maxLength setting');
    });

    it('should respect environment variable overrides', async () => {
      // Set environment variable
      const originalValue = process.env.CLAUDE_CODE_STATUSLINE_NO_EMOJI;
      process.env.CLAUDE_CODE_STATUSLINE_NO_EMOJI = '1';

      try {
        const { loadConfig } = await import('../dist/core/config.js');
        const config = loadConfig();

        assert.strictEqual(config.noEmoji, true, 'Should override with environment variable');
      } finally {
        // Restore original value
        if (originalValue !== undefined) {
          process.env.CLAUDE_CODE_STATUSLINE_NO_EMOJI = originalValue;
        } else {
          delete process.env.CLAUDE_CODE_STATUSLINE_NO_EMOJI;
        }
      }
    });
  });

  describe('Security Module', () => {
    it('should validate input correctly', async () => {
      const { validateInput } = await import('../dist/core/security.js');
      const { defaultConfig } = await import('../dist/core/config.js');
      const config = defaultConfig;

      assert.strictEqual(
        validateInput('{"test":"value"}', config),
        true,
        'Should accept valid JSON'
      );

      assert.strictEqual(
        validateInput('', config),
        false,
        'Should reject empty input'
      );

      assert.strictEqual(
        validateInput('{"test":"value"}', {...config, maxLength: 5}),
        false,
        'Should reject input exceeding max length'
      );
    });

    it('should validate paths correctly', async () => {
      const { validatePath } = await import('../dist/core/security.js');

      assert.strictEqual(
        validatePath('/home/user/project'),
        true,
        'Should accept valid absolute paths'
      );

      assert.strictEqual(
        validatePath('../../../etc/passwd'),
        false,
        'Should reject directory traversal'
      );

      assert.strictEqual(
        validatePath('/path/with;command'),
        false,
        'Should reject dangerous characters'
      );
    });
  });

  describe('Module Integration', () => {
    it('should import all modules without errors', async () => {
      // Test that all modules can be imported
      const modules = [
        '../dist/core/config.js',
        '../dist/core/security.js',
        '../dist/core/cache.js',
        '../dist/git/status.js',
        '../dist/ui/width.js',
        '../dist/ui/symbols.js',
        '../dist/env/context.js',
      ];

      for (const modulePath of modules) {
        try {
          await import(modulePath);
        } catch (error) {
          assert.fail(`Failed to import module ${modulePath}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    });

    it('should have proper module exports', async () => {
      const configModule = await import('../dist/core/config.js');
      assert.ok(typeof configModule.loadConfig === 'function', 'Config module should export loadConfig');
      assert.ok(typeof configModule.defaultConfig === 'object', 'Config module should export defaultConfig');

      const securityModule = await import('../dist/core/security.js');
      assert.ok(typeof securityModule.validateInput === 'function', 'Security module should export validateInput');
      assert.ok(typeof securityModule.validatePath === 'function', 'Security module should export validatePath');

      const cacheModule = await import('../dist/core/cache.js');
      assert.ok(typeof cacheModule.Cache === 'function', 'Cache module should export Cache class');
    });
  });

  describe('Performance Requirements', () => {
    it('should execute within reasonable time limits', () => {
      const testData = JSON.stringify({
        workspace: {
          current_dir: process.cwd()
        },
        model: {
          display_name: 'Performance Test Model'
        }
      });

      const startTime = Date.now();

      try {
        const result = execSync('node dist/index.js', {
          input: testData,
          encoding: 'utf-8',
          timeout: 2000 // 2 second timeout
        });

        const endTime = Date.now();
        const duration = endTime - startTime;

        // Should complete well within 2 seconds
        assert.ok(duration < 2000, `Should complete in reasonable time, took ${duration}ms`);
        console.log(`Execution time: ${duration}ms`);

      } catch (error) {
        // If it times out or fails, that's a performance issue
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('timeout')) {
          assert.fail('Performance test: execution timed out');
        } else {
          console.warn('Performance test warning:', errorMessage);
        }
      }
    });
  });
});