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
      cwd: options.cwd || process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: options.timeout || 5000,
    });

    let stdout = '';
    let stderr = '';

    git.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    git.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    git.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`Git command failed with code ${code}: ${stderr || stdout}`));
      }
    });

    git.on('error', (error) => {
      reject(new Error(`Failed to execute git command: ${error.message}`));
    });
  });
}

/**
 * Check if directory is a git repository
 */
export async function checkIsRepo(cwd?: string): Promise<boolean> {
  try {
    const options = cwd ? { cwd } : {};
    await executeGitCommand(['rev-parse', '--git-dir'], options);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get current branch name using multiple fallback methods
 */
export async function getCurrentBranch(cwd?: string): Promise<string | null> {
  const options = cwd ? { cwd } : {};

  // Method 1: git branch --show-current (most reliable)
  try {
    const result = await executeGitCommand(['branch', '--show-current'], options);
    const branch = result.trim();
    if (branch) {
      return branch;
    }
  } catch {
    // Continue to next method
  }

  // Method 2: git rev-parse --abbrev-ref HEAD
  try {
    const result = await executeGitCommand(['rev-parse', '--abbrev-ref', 'HEAD'], options);
    const branch = result.trim();
    // Filter out HEAD if not on a branch
    if (branch && branch !== 'HEAD') {
      return branch;
    }
  } catch {
    // Continue to next method
  }

  // Method 3: Parse git branch output for current branch
  try {
    const result = await executeGitCommand(['branch', '--no-color'], options);
    const lines = result.split('\n');
    for (const line of lines) {
      if (line.startsWith('* ')) {
        return line.substring(2).trim();
      }
    }
  } catch {
    // All methods failed
  }

  return null;
}

/**
 * Get git status in porcelain format
 */
export async function getPorcelainStatus(cwd?: string): Promise<string> {
  const options = cwd ? { cwd } : {};
  return executeGitCommand(['status', '--porcelain'], options);
}

/**
 * Get stash list
 */
export async function getStashList(cwd?: string): Promise<string> {
  try {
    const options = cwd ? { cwd } : {};
    return executeGitCommand(['stash', 'list'], options);
  } catch {
    return '';
  }
}

/**
 * Get upstream branch reference
 */
export async function getUpstreamRef(cwd?: string): Promise<string> {
  try {
    const options = cwd ? { cwd } : {};
    const result = await executeGitCommand(['rev-parse', '--abbrev-ref', '@{u}'], options);
    return result.trim();
  } catch {
    return '';
  }
}

/**
 * Get ahead/behind counts
 */
export async function getAheadBehind(cwd?: string): Promise<{ ahead: number; behind: number }> {
  try {
    const options = cwd ? { cwd } : {};
    const result = await executeGitCommand(['rev-list', '--count', '--left-right', '@{u}...HEAD'], options);
    const counts = result.trim().split('\t');

    if (counts.length === 2) {
      const behind = parseInt(counts[0] || '0', 10);
      const ahead = parseInt(counts[1] || '0', 10);
      return { ahead, behind };
    }
  } catch {
    // No upstream or other error
  }

  return { ahead: 0, behind: 0 };
}