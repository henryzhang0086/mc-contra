/* 构建: index.html + game.js -> 单文件可分发版本
   用法: node build.mjs  */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const ROOT = dirname(fileURLToPath(import.meta.url)), DIST = join(ROOT, 'dist');
const html = readFileSync(join(ROOT,'index.html'),'utf8');
const js = readFileSync(join(ROOT,'game.js'),'utf8');
const tag = '<script src="game.js"></script>';
if(!html.includes(tag)){ console.error('✗ 找不到 '+tag); process.exit(1); }
const banner = '<!-- MC 魂斗罗 单文件版 — 由 build.mjs 自动生成, 请改 game.js/index.html 后重新构建 -->\n';
const inlined = banner + html.replace(tag, `<script>\n${js}\n</script>`);
mkdirSync(DIST,{recursive:true});
writeFileSync(join(DIST,'index.html'), html);
writeFileSync(join(DIST,'game.js'), js);
writeFileSync(join(DIST,'MC魂斗罗-单文件版.html'), inlined);
writeFileSync(join(ROOT,'MC魂斗罗-单文件版.html'), inlined);
const kb = s => (Buffer.byteLength(s,'utf8')/1024).toFixed(1)+' KB';
console.log('✓ 构建完成');
console.log('  dist/index.html              '+kb(html));
console.log('  dist/game.js                 '+kb(js));
console.log('  MC魂斗罗-单文件版.html        '+kb(inlined));
