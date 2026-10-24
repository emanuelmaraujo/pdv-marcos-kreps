import { afterEach, describe, expect, it } from 'vitest';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const fixtures: string[] = [];
const source = path.resolve('scripts/update-local.mjs');

function git(cwd: string, ...args: string[]) {
  const result = spawnSync('git', ['-c', 'commit.gpgsign=false', ...args], {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'Local updater test', GIT_AUTHOR_EMAIL: 'test@example.invalid',
      GIT_COMMITTER_NAME: 'Local updater test', GIT_COMMITTER_EMAIL: 'test@example.invalid',
    },
  });
  if (result.status !== 0) throw new Error(result.stderr || result.error?.message);
  return result.stdout.trim();
}

function fixture() {
  const dir = mkdtempSync(path.join(tmpdir(), 'pdv-update-test-'));
  fixtures.push(dir);
  const remote = path.join(dir, 'origin.git');
  const seed = path.join(dir, 'seed');
  const local = path.join(dir, 'local');
  git(dir, 'init', '--bare', '--initial-branch=main', remote);
  git(dir, 'clone', remote, seed);
  mkdirSync(path.join(seed, 'scripts'));
  copyFileSync(source, path.join(seed, 'scripts/update-local.mjs'));
  writeFileSync(path.join(seed, 'version.txt'), 'initial');
  git(seed, 'add', '.');
  git(seed, 'commit', '-m', 'initial');
  git(seed, 'push', 'origin', 'main');
  git(dir, 'clone', remote, local);
  const before = git(local, 'rev-parse', 'HEAD');
  function advanceRemote() {
    writeFileSync(path.join(seed, 'version.txt'), 'updated');
    git(seed, 'add', '.');
    git(seed, 'commit', '-m', 'remote update');
    git(seed, 'push', 'origin', 'main');
    return git(seed, 'rev-parse', 'HEAD');
  }
  function run(...args: string[]) {
    return spawnSync(process.execPath, [path.join(local, 'scripts/update-local.mjs'), ...args], {
      cwd: dir, encoding: 'utf8', timeout: 20_000,
    });
  }
  return { dir, local, before, advanceRemote, run };
}

afterEach(() => {
  for (const dir of fixtures.splice(0)) {
    // Remoção limitada aos diretórios temporários criados por estes testes.
    if (path.dirname(dir) !== path.resolve(tmpdir()) || !path.basename(dir).startsWith('pdv-update-test-')) {
      throw new Error('Diretório de fixture fora do local esperado');
    }
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('atualização local sem serviços externos', () => {
  it('atualiza por fast-forward mesmo chamado de outro diretório', () => {
    const f = fixture();
    const expected = f.advanceRemote();
    expect(f.run().status).toBe(0);
    expect(git(f.local, 'rev-parse', 'HEAD')).toBe(expected);
    expect(readFileSync(path.join(f.local, 'version.txt'), 'utf8')).toBe('updated');
  }, 30_000);

  it('consulta sem alterar HEAD ou arquivos da branch', () => {
    const f = fixture();
    f.advanceRemote();
    expect(f.run('--check').status).toBe(0);
    expect(git(f.local, 'rev-parse', 'HEAD')).toBe(f.before);
    expect(readFileSync(path.join(f.local, 'version.txt'), 'utf8')).toBe('initial');
  }, 30_000);

  it.each(['version.txt', 'untracked.txt'])('preserva trabalho pendente em %s', (filename) => {
    const f = fixture();
    f.advanceRemote();
    writeFileSync(path.join(f.local, filename), 'local work');
    const result = f.run();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('alterações locais');
    expect(git(f.local, 'rev-parse', 'HEAD')).toBe(f.before);
    expect(readFileSync(path.join(f.local, filename), 'utf8')).toBe('local work');
  }, 30_000);

  it('recusa histórico divergente e preserva os commits locais', () => {
    const f = fixture();
    f.advanceRemote();
    writeFileSync(path.join(f.local, 'local.txt'), 'local commit');
    git(f.local, 'add', '.');
    git(f.local, 'commit', '-m', 'local change');
    const localHead = git(f.local, 'rev-parse', 'HEAD');
    const result = f.run();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('divergente');
    expect(git(f.local, 'rev-parse', 'HEAD')).toBe(localHead);
  }, 30_000);

  it('recusa detached HEAD', () => {
    const f = fixture();
    git(f.local, 'checkout', '--detach');
    expect(f.run().status).toBe(1);
    expect(git(f.local, 'rev-parse', 'HEAD')).toBe(f.before);
  }, 30_000);

  it('recusa operação Git pendente mesmo com árvore limpa', () => {
    const f = fixture();
    mkdirSync(path.join(f.local, '.git', 'rebase-merge'));
    const result = f.run();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('operação Git pendente');
    expect(git(f.local, 'rev-parse', 'HEAD')).toBe(f.before);
  }, 30_000);
});
