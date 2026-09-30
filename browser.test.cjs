/* End-to-end tests use a fresh temporary SQLite data directory. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { spawn } = require('node:child_process');
const temp = fs.mkdtempSync(path.join(os.tmpdir(),'portfolio-browser-'));
const artifacts = path.join(__dirname,'artifacts');
fs.mkdirSync(artifacts,{recursive:true});
const server = spawn(process.env.PYTHON || 'python',['run.py','--port','8765','--data-dir',temp],{cwd:__dirname,stdio:['ignore','ignore','inherit']});
const base = 'http://127.0.0.1:8765';
(async () => {
  let ready=false;
  for(let i=0;i<100;i++) { try { ready=(await fetch(base+'/api/health')).ok; if(ready) break; } catch {} await new Promise(resolve=>setTimeout(resolve,100)); }
  if(!ready) throw new Error('Python server did not become ready.');
  const browser = await chromium.launch({headless:true});
  const page = await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{ if(message.type()==='error' && !message.text().includes('422 (Unprocessable Entity)')) errors.push(message.text()); });
  async function shot() { await page.screenshot({path:path.join(artifacts,'screenshot.png'),fullPage:true}); }
  try {
    await page.goto(base);
    await page.waitForLoadState('networkidle');
    assert.equal(await page.locator('#products tr').count(),4);
    await shot();
    await page.locator('#search').fill('notebook');
    assert.equal(await page.locator('#products tr').count(),1);
    await page.locator('#search').fill('');
    const form=page.locator('#add-product');
    await form.locator('[name="name"]').fill('Browser demo pencil');
    await form.locator('[name="sku"]').fill('BROWSER-001');
    await form.locator('[name="category"]').fill('Writing');
    await form.locator('[name="price"]').fill('12.25');
    await form.locator('[name="stock"]').fill('3');
    await form.locator('button').click();
    await page.getByText('Browser demo pencil',{exact:true}).first().waitFor();
    const adjust=page.locator('#adjust-stock');
    await adjust.locator('select').selectOption({label:'Browser demo pencil'});
    await adjust.locator('[name="delta"]').fill('2');
    await adjust.locator('[name="reason"]').fill('Browser verification');
    await adjust.locator('button').click();
    await page.getByText('Browser verification',{exact:false}).waitFor();

    await page.getByRole('link',{name:'Demo guide',exact:false}).click();
    await page.getByRole('heading',{name:'Five-minute walkthrough',exact:true}).waitFor();
    await page.setViewportSize({width:390,height:844});
    for(const route of ['/','/guide.html']) {
      await page.goto(base+route);
      await page.waitForLoadState('networkidle');
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Page overflows on mobile: '+route);
    }
    await page.goto(base);
    await page.waitForLoadState('networkidle');
    await page.screenshot({path:path.join(artifacts,'mobile.png'),fullPage:true});
    assert.deepEqual(errors,[]);
    console.log('PASS: standalone workflow, guide, responsive layouts, and no unexpected browser errors.');
  } finally { await browser.close(); }
})().catch(error=>{ console.error(error); process.exitCode=1; }).finally(()=>{server.kill();fs.rmSync(temp,{recursive:true,force:true});});
