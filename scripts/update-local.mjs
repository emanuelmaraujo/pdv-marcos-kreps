import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
if (args.some((arg) => arg !== '--check') || args.length > 1) {
  console.error('Uso: npm run update:local [-- --check]');
  process.exit(1);
}

function git(...args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (result.error || result.status !== 0) {
    throw new Error(result.error?.message || result.stderr.trim() || `git ${args.join(' ')} falhou`);
  }
  return result.stdout.trim();
}

try {
  const branch = git('symbolic-ref', '--quiet', '--short', 'HEAD');
  if (git('status', '--porcelain', '--untracked-files=all')) {
    throw new Error('Há alterações locais. Faça commit ou salve um stash identificado antes de atualizar.');
  }
  // Conflitos/rebase em andamento também podem existir com a árvore limpa.
  for (const name of ['MERGE_HEAD', 'rebase-merge', 'rebase-apply', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'sequencer']) {
    const operationPath = path.resolve(root, git('rev-parse', '--git-path', name));
    if (existsSync(operationPath)) throw new Error('Conclua a operação Git pendente antes de atualizar.');
  }
  console.log(`Branch: ${branch}. Consultando origin/main...`);
  git('fetch', '--prune', 'origin');
  const [ahead, behind] = git('rev-list', '--left-right', '--count', 'HEAD...origin/main').split(/\s+/).map(Number);
  console.log(`Commits locais exclusivos: ${ahead}; commits novos na main: ${behind}.`);
  if (args.includes('--check')) process.exit(0);
  if (ahead > 0 && behind > 0) {
    throw new Error('Histórico divergente. Revise o diff e escolha merge ou rebase manualmente.');
  }
  git('merge', '--ff-only', 'origin/main');
  console.log(`Código atualizado: ${git('rev-parse', '--short', 'HEAD')}.`);
  console.log('Siga docs/development/updates.md para dependências, validação e atualização do worker.');
} catch (error) {
  console.error(`Atualização interrompida: ${error.message}`);
  process.exitCode = 1;
}
