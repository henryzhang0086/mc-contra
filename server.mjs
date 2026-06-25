/* 极简静态开发服务器(零依赖). 用法: node server.mjs  -> http://localhost:8081 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize, extname } from 'node:path';
const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8081;
const MIME = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon'};
createServer(async (req,res)=>{ try{
  let u = decodeURIComponent((req.url||'/').split('?')[0]); if(u==='/')u='/index.html';
  const fp = normalize(join(ROOT,u)); if(!fp.startsWith(ROOT)){ res.writeHead(403); res.end('Forbidden'); return; }
  const data = await readFile(fp);
  res.writeHead(200,{'Content-Type':MIME[extname(fp).toLowerCase()]||'application/octet-stream'}); res.end(data);
}catch(e){ res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'}); res.end('404 Not Found'); } })
.listen(PORT,()=>{ console.log(`MC 魂斗罗 开发服务器: http://localhost:${PORT}`); console.log('按 Ctrl+C 停止'); });
