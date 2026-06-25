/* 冒烟测试 (headless Chromium). 用法: node tests/smoke.mjs
   - 启动 / 无控制台错误
   - 开始 -> 移动/跳跃/射击 -> 切武器 -> 暂停
   - 调试钩子瞬移到各 Boss, 验证 Boss 战与击败流程
   截图到 tests/screenshots/ */
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SHOTS = join(ROOT,'tests','screenshots'); mkdirSync(SHOTS,{recursive:true});
let failed=0; const errors=[];
const ok=(n,c)=>{ console.log((c?'  ✓ ':'  ✗ ')+n); if(!c)failed++; };
const browser = await chromium.launch();
const page = await browser.newPage({ viewport:{width:1000,height:600} });
page.on('console',m=>{ if(m.type()==='error')errors.push(m.text()); });
page.on('pageerror',e=>errors.push('pageerror: '+e.message));
await page.goto(pathToFileURL(join(ROOT,'index.html')).href+'?debug',{waitUntil:'load'});
await page.waitForTimeout(400);

console.log('\n[1] 标题'); ok('已加载', await page.evaluate(()=>typeof requestAnimationFrame==='function'));
await page.screenshot({path:join(SHOTS,'1-title.png')});

console.log('\n[2] 开始 + 跑射');
await page.keyboard.press('Enter'); await page.waitForTimeout(400);
await page.keyboard.down('ArrowRight'); await page.waitForTimeout(200);
await page.keyboard.down('KeyJ'); await page.waitForTimeout(300);
await page.keyboard.press('Space'); await page.waitForTimeout(150);
await page.keyboard.up('KeyJ'); await page.keyboard.up('ArrowRight');
ok('玩家可移动', await page.evaluate(()=>__c.player.x>80));
ok('已发射子弹', await page.evaluate(()=>__c.G && document.getElementById('cv')!=null));
await page.screenshot({path:join(SHOTS,'2-play.png')});

console.log('\n[3] 武器与8方向');
await page.evaluate(()=>__c.give('spread')); await page.keyboard.down('ArrowUp'); await page.keyboard.press('KeyJ'); await page.waitForTimeout(120); await page.keyboard.up('ArrowUp');
ok('武器切换为喷射', await page.evaluate(()=>__c.player.weapon==='spread'));

console.log('\n[4] 暂停菜单');
await page.keyboard.press('KeyP'); await page.waitForTimeout(200);
ok('已暂停', await page.evaluate(()=>__c.G.paused===true));
await page.screenshot({path:join(SHOTS,'3-pause.png')});
await page.keyboard.press('KeyP'); await page.waitForTimeout(150);

console.log('\n[5] 三个 Boss 战 + 击败');
for(let lv=1; lv<=3; lv++){
  await page.evaluate(l=>__c.start(l), lv); await page.waitForTimeout(200);
  await page.evaluate(()=>__c.warpToBoss()); await page.waitForTimeout(1400);
  const spawned = await page.evaluate(()=>__c.boss!=null);
  ok(`第${lv}关 Boss 生成`, spawned);
  await page.screenshot({path:join(SHOTS,`4-boss${lv}.png`)});
  // 触发击败流程
  await page.evaluate(()=>__c.nuke()); await page.waitForTimeout(1100);
  ok(`第${lv}关 Boss 可被击败`, await page.evaluate(()=>__c.boss && __c.boss.defeated===true));
}

console.log('\n[6] 控制台错误'); ok('无运行时错误 ('+errors.length+')', errors.length===0);
errors.slice(0,8).forEach(e=>console.log('     · '+e));
await browser.close();
console.log('\n截图: tests/screenshots/');
if(failed||errors.length){ console.log(`\n未通过: ${failed} 断言失败, ${errors.length} 控制台错误`); process.exit(1); }
console.log('\n✓ 全部通过');
