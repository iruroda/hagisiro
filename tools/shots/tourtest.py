import json
src=open('/tmp/sb/mkshot.py').read().split('def run')[0]
exec(src)
seed['users/u1/classes/c1']={'name':'1반','ord':1,'students':[{'id':'s1','no':1,'name':'김네모'},{'id':'s2','no':2,'name':'박동글'}],'periods':[0,7,7,7,7,7,0]}
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(service_workers='block',viewport={'width':1000,'height':700}); pg=ctx.new_page()
    for n,f in (('firebase-app.js',F+'app.js'),('firebase-auth.js',F+'auth.js'),('firebase-firestore.js',F+'fs.js')):
        pg.route('**/firebasejs/**/'+n,lambda r,_q=None,f=f:r.fulfill(path=f,content_type='text/javascript'))
    pg.route('https://www.googleapis.com/**',lambda r:r.fulfill(status=200,content_type='application/json',body='{"items":[]}'))
    pg.add_init_script("localStorage.setItem('fake:fs',%s); localStorage.setItem('hagisiro:tourTodo','1')"%json.dumps(json.dumps(seed)))
    pg.clock.set_fixed_time('2026-05-13T10:00:00+09:00')
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8770/app/?widget=1'); pg.wait_for_timeout(3000)
    pg.locator('button.tab',has_text='출결').click(); pg.wait_for_timeout(1500)
    print('tour',pg.locator('.tour').count(), 'q',pg.locator('#q').count(), pg.evaluate('document.body.innerText.slice(0,150)').replace(chr(10),'|'), errs)
    q=pg.locator('#q'); bb=q.bounding_box()
    pg.mouse.click(bb['x']+50,bb['y']+bb['height']/2); pg.keyboard.type('abc',delay=30); pg.wait_for_timeout(300)
    print('typed:',q.input_value(),'| tour still',pg.locator('.tour').count())
    pg.screenshot(path='/tmp/sb/shots/tour_att.png')
    pg.mouse.click(900,650); pg.wait_for_timeout(300); print('outside click -> tour',pg.locator('.tour').count())
    pg.mouse.click(bb['x']+50,bb['y']+bb['height']/2); pg.keyboard.press('Enter'); pg.wait_for_timeout(600)
    print('after Enter tour',pg.locator('.tour').count(),'val',repr(q.input_value()))
    print(errs); b.close()
