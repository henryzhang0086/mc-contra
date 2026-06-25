/* 生成游戏公网链接二维码 — PNG / SVG / 终端. 用法: node make-qr.mjs [url] */
import QRCode from 'qrcode';
import { writeFileSync } from 'node:fs';
const url = process.argv[2] || 'https://henryzhang0086.github.io/mc-contra/';
await QRCode.toFile('qr-code.png', url, { width:600, margin:2, color:{dark:'#3a1010',light:'#ffffff'} });
writeFileSync('qr-code.svg', await QRCode.toString(url,{type:'svg',margin:2,color:{dark:'#3a1010',light:'#ffffff'}}));
console.log(await QRCode.toString(url,{type:'terminal',small:true}));
console.log('扫码即玩 →  '+url);
console.log('已生成: qr-code.png / qr-code.svg');
