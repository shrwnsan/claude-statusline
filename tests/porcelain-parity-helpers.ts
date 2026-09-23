import { execFileSync } from 'child_process';
import { mkdtempSync, writeFileSync, appendFileSync } from 'fs';
import { tmpdir } from 'os';

/**
 * Throwaway repo exercising every indicator: upstream (ahead 1), 1 stash,
 * staged rename + adds (incl. spaced path), staged delete, unstaged
 * modification, untracked file.
 */
export function makeSandbox(suffix: string): string {
  const dir = mkdtempSync(`${tmpdir()}/cs-${suffix}-`);
  const g = (...args: string[]) => execFileSync('git', args, { cwd: dir, stdio: 'ignore' });
  const gbare = (...args: string[]) => execFileSync('git', args, { stdio: 'ignore' });
  g('init', '-q');
  g('config', 'user.email', 't@t');
  g('config', 'user.name', 't');
  g('config', 'commit.gpgsign', 'false');
  writeFileSync(`${dir}/a.txt`, 'one\n');
  writeFileSync(`${dir}/b.txt`, 'two\n');
  writeFileSync(`${dir}/f.txt`, 'five\n');
  g('add', '.');
  g('commit', '-qm', 'init');
  gbare('clone', '--bare', dir, `${dir}-remote.git`);
  g('remote', 'add', 'origin', `${dir}-remote.git`);
  g('push', '-q', '-u', 'origin', 'HEAD');
  appendFileSync(`${dir}/a.txt`, 'second\n');
  g('commit', '-qam', 'second');                              // ahead 1
  writeFileSync(`${dir}/b.txt`, 'stashme\n');
  g('stash', 'push', '-q', '--', 'b.txt');                    // stash 1 (path-limited)
  g('mv', 'b.txt', 'z.txt');                                  // staged R
  writeFileSync(`${dir}/a.txt`, 'dirty\n');                   // modified unstaged
  writeFileSync(`${dir}/c.txt`, 'three\n');
  g('add', 'c.txt');                                          // staged A
  writeFileSync(`${dir}/my file.txt`, 'spaced\n');
  g('add', './my file.txt');                                  // staged A, space in path
  g('rm', '-q', 'f.txt');                                     // staged D
  writeFileSync(`${dir}/e.txt`, 'untracked\n');               // untracked
  return dir;
}
