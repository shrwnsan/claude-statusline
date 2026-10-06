import { spawn } from 'child_process';

/**
 * Execute a git command using child_process.spawn
 * Provides native git execution without external dependencies
 */
export async function executeGitCommand(
  args: string[],
  options: {
    cwd?: string;
    timeout?: number;
  } = {}
): Promise<string> {
  return new Promise((resolve, reject) => {
    const git = spawn('git', args, {
      // `||` is deliberate: '' cwd and 0 timeout must fall back to defaults.
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
      cwd: options.cwd || process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
      timeout: options.timeout || 5000,
    });

    let stdout = '';
    let stderr = '';

    git.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    git.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    git.on('close', code => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`Git command failed with code ${code}: ${stderr || stdout}`));
      }
    });

    git.on('error', error => {
      reject(new Error(`Failed to execute git command: ${error.message}`));
    });
  });
}
