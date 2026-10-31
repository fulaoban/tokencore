// 静态检查：语法校验 + 模块导入解析
import { readdir, readFile } from 'node:fs/promises';
import { join, dirname, resolve, relative } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const ROOT = resolve(new URL('..', import.meta.url).pathname);

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(p));
    else if (entry.name.endsWith('.js') || entry.name.endsWith('.mjs')) out.push(p);
  }
  return out;
}

const files = await walk(ROOT);
let errors = 0;

// 1. 语法检查
for (const f of files) {
  try {
    await exec(process.execPath, ['--check', f]);
  } catch (err) {
    errors++;
    console.error(`✗ 语法错误 ${relative(ROOT, f)}\n${err.stderr}`);
  }
}

// 2. 相对导入路径检查
for (const f of files) {
  const src = await readFile(f, 'utf8');
  const re = /from\s+['"](\.[^'"]+)['"]/g;
  let m;
  while ((m = re.exec(src))) {
    const target = resolve(dirname(f), m[1]);
    const found = files.some((x) => x === target);
    if (!found) {
      errors++;
      console.error(`✗ 导入不存在 ${relative(ROOT, f)} -> ${m[1]}`);
    }
  }
}

// 3. HTML 引用的本地资源检查
const html = await readFile(join(ROOT, 'index.html'), 'utf8');
for (const m of html.matchAll(/(?:src|href)="(\.\/[^"]+)"/g)) {
  const target = resolve(ROOT, m[1].slice(2));
  try {
    await readFile(target);
  } catch {
    errors++;
    console.error(`✗ index.html 引用缺失: ${m[1]}`);
  }
}

console.log(errors === 0
  ? `✓ 检查通过（${files.length} 个模块）`
  : `✗ 发现 ${errors} 个问题`);
process.exit(errors === 0 ? 0 : 1);
