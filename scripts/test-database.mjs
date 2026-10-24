import { appendFileSync, cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const gitDirResult = spawnSync('git', ['rev-parse', '--absolute-git-dir'], { cwd: root, encoding: 'utf8' });
if (gitDirResult.status !== 0) throw new Error('Execute em um checkout Git.');
const validationRoot = path.join(gitDirResult.stdout.trim(), 'local-validation');
mkdirSync(validationRoot, { recursive: true });
const workdir = mkdtempSync(path.join(validationRoot, 'pdv-db-'));
const projectId = path.basename(workdir).toLowerCase();
const localSupabase = path.join(workdir, 'supabase');
const log = path.join(workdir, 'verification.log');
const packageDir = path.join(root, 'node_modules/supabase');
const manifest = JSON.parse(readFileSync(path.join(packageDir, 'package.json'), 'utf8'));
const cli = path.join(packageDir, typeof manifest.bin === 'string' ? manifest.bin : manifest.bin.supabase);

function run(label, binary, args, timeout = 300_000) {
  console.log(label);
  const result = spawnSync(binary, args, { cwd: root, encoding: 'utf8', timeout, maxBuffer: 32 * 1024 * 1024 });
  appendFileSync(log, `\n${label}\n${result.stdout ?? ''}\n${result.stderr ?? ''}`);
  if (result.error || result.status !== 0) {
    throw new Error(`${label} falhou. Consulte o log local: ${log}`);
  }
  return result.stdout;
}

function supabase(label, ...args) {
  const cliArgs = [...args, '--workdir', workdir];
  return /\.[cm]?js$/.test(cli)
    ? run(label, process.execPath, [cli, ...cliArgs])
    : run(label, cli, cliArgs);
}

let started = false;
try {
  run('Conferindo Docker...', 'docker', ['info', '--format', '{{.ServerVersion}}']);
  mkdirSync(localSupabase);
  for (const dir of ['migrations', 'functions', 'tests']) {
    cpSync(path.join(root, 'supabase', dir), path.join(localSupabase, dir), { recursive: true });
  }
  let config = readFileSync(path.join(root, 'supabase/config.toml'), 'utf8')
    .replace(/^project_id\s*=\s*"[^"]+"/m, `project_id = "${projectId}"`)
    .replace(/(\[db\.migrations\][^[]*?)enabled = true/s, '$1enabled = false')
    .replace(/(\[db\.seed\][^[]*?)enabled = true/s, '$1enabled = false');
  const ports = new Map([[54320, 55430], [54321, 55431], [54322, 55432], [54323, 55433],
    [54324, 55434], [54325, 55435], [54326, 55436], [54327, 55437], [54329, 55439], [8083, 8183]]);
  config = config.replace(/\b(?:5432\d|8083)\b/g, (value) => String(ports.get(Number(value)) ?? value));
  const configFile = path.join(localSupabase, 'config.toml');
  writeFileSync(configFile, config);
  // Também limpa uma inicialização parcial em caso de falha, sempre neste ID.
  started = true;
  supabase('Iniciando instância descartável nas portas 554xx...', 'start');
  const container = `supabase_db_${projectId}`;
  run('Preparando pg_cron, já habilitado no projeto remoto...', 'docker', [
    'exec', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1',
    '-c', 'CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;',
  ]);
  config = config.replace(/(\[db\.migrations\][^[]*?)enabled = false/s, '$1enabled = true');
  writeFileSync(configFile, config);
  supabase('Aplicando histórico regular de migrations...', 'migration', 'up', '--local');

  const runLocalSql = (file, label) => {
    run('Preparando SQL exclusivo do banco descartável...', 'docker', ['cp', file, `${container}:/tmp/replay.sql`]);
    run(label, 'docker', [
      'exec', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-qf', '/tmp/replay.sql',
    ]);
  };
  runLocalSql(path.join(root, 'supabase/fixtures/nb-catalog.sql'), 'Criando catálogo sintético...');
  for (const name of readdirSync(path.join(root, 'supabase/manual-data')).filter((file) => file.endsWith('.sql')).sort()) {
    for (let iteration = 1; iteration <= 2; iteration += 1) {
      runLocalSql(path.join(root, 'supabase/manual-data', name), `Validando ${name}, execução ${iteration}/2...`);
    }
  }
  const output = supabase('Executando testes SQL...', 'test', 'db');
  console.log(output.split(/\r?\n/).filter((line) => /All tests|Files=|Result:/.test(line)).join('\n'));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (started) {
    // Nunca usa --all nem o ID pdv. Só remove volumes criados por esta execução.
    if (!projectId.startsWith('pdv-db-') || path.dirname(workdir) !== validationRoot) {
      throw new Error('Diretório de teste fora do escopo esperado; limpeza interrompida.');
    }
    try { supabase('Removendo somente a instância descartável...', 'stop', '--no-backup'); }
    catch (error) { console.error(error.message); process.exitCode = 1; }
  }
}
