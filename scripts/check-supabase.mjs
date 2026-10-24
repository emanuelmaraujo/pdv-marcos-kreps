import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const config = readFileSync(path.join(root, 'supabase/config.toml'), 'utf8');
const declarations = new Map();
const errors = [];
const lock = JSON.parse(readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const cliVersion = lock.packages?.['node_modules/supabase']?.version;
const deploy = readFileSync(path.join(root, '.github/workflows/deploy-functions.yml'), 'utf8');
if (!cliVersion || !deploy.split(/\r?\n/).some((line) => line.trim() === `version: ${cliVersion}`)) {
  errors.push('Alinhe a versão da CLI no deploy-functions.yml com o package-lock.json.');
}
let currentFunction = null;
for (const raw of config.split(/\r?\n/)) {
  const line = raw.replace(/#.*$/, '').trim();
  const section = line.match(/^\[functions\.([a-z0-9-]+)\]$/);
  if (section) {
    currentFunction = section[1];
    if (declarations.has(currentFunction)) errors.push(`Função declarada duas vezes: ${currentFunction}`);
    declarations.set(currentFunction, undefined);
  } else if (line.startsWith('[')) {
    currentFunction = null;
  } else if (currentFunction && /^verify_jwt\s*=/.test(line)) {
    const match = line.match(/^verify_jwt\s*=\s*(true|false)$/);
    if (!match) errors.push(`verify_jwt inválido: ${currentFunction}`);
    else declarations.set(currentFunction, match[1] === 'true');
  }
}

const functions = readdirSync(path.join(root, 'supabase/functions'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
  .map((entry) => entry.name);
for (const name of functions) {
  if (!existsSync(path.join(root, 'supabase/functions', name, 'index.ts'))) errors.push(`Entrypoint ausente: ${name}`);
  if (typeof declarations.get(name) !== 'boolean') errors.push(`Defina verify_jwt explicitamente: ${name}`);
}
for (const name of declarations.keys()) {
  if (!functions.includes(name)) errors.push(`Função configurada sem diretório: ${name}`);
}

const versions = new Set();
for (const file of readdirSync(path.join(root, 'supabase/migrations')).filter((name) => name.endsWith('.sql'))) {
  const match = file.match(/^(\d{14})_[a-z0-9_]+\.sql$/);
  if (!match) { errors.push(`Nome de migration inválido: ${file}`); continue; }
  if (versions.has(match[1])) errors.push(`Versão de migration duplicada: ${match[1]}`);
  versions.add(match[1]);
}
const manual = readdirSync(path.join(root, 'supabase/manual-data')).filter((name) => name.endsWith('.sql'));
for (const file of manual) {
  const match = file.match(/^(\d{14})_[a-z0-9_]+\.sql$/);
  if (!match) errors.push(`Nome de operação manual inválido: ${file}`);
  else if (versions.has(match[1])) errors.push(`Operação manual também aparece no deploy automático: ${file}`);
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Supabase: ${functions.length} funções; ${versions.size} migrations com versões únicas; ${manual.length} operações manuais separadas.`);
}
