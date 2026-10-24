import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const ignored = new Set(['node_modules', '.git', '.next', '.agents', '.claude', '.vercel', 'graphify-out', 'dist', 'coverage']);

function markdownFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isSymbolicLink() || ignored.has(entry.name)) return [];
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? markdownFiles(full) : entry.name.endsWith('.md') ? [full] : [];
  });
}

const files = markdownFiles(root);
const failures = [];
for (const file of files) {
  // Não interpreta exemplos de Markdown dentro de blocos de código.
  const content = readFileSync(file, 'utf8').replace(/^(?:```|~~~)[\s\S]*?^(?:```|~~~).*$/gm, (block) => block.replace(/[^\n]/g, ' '));
  for (const match of content.matchAll(/!?\[[^\]\n]*\]\((<[^>]+>|[^\s)]+)(?:\s+"[^"]*")?\)/g)) {
    const href = match[1].replace(/^<|>$/g, '');
    if (/^(?:[a-z][a-z\d+.-]*:|#|\/\/)/i.test(href)) continue;
    const target = href.split(/[?#]/)[0];
    if (!target) continue;
    let decoded;
    try { decoded = decodeURIComponent(target); } catch { decoded = target; }
    const resolved = path.resolve(href.startsWith('/') ? root : path.dirname(file), decoded.replace(/^\//, ''));
    if (!existsSync(resolved) || (!statSync(resolved).isFile() && !statSync(resolved).isDirectory())) {
      const line = content.slice(0, match.index).split('\n').length;
      failures.push(`${path.relative(root, file)}:${line}: ${href}`);
    }
  }
}
if (failures.length) {
  console.error(`Links locais quebrados (${failures.length}):\n${failures.join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`Documentação verificada: ${files.length} arquivos Markdown, sem links locais quebrados.`);
}
