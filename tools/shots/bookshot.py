from playwright.sync_api import sync_playwright
import json
F='/home/claude/hagisiro-repo/tools/fakefb/'
seed={"consults/c0":{"owner":"u1","title":"1학기 진학 상담","slots":["20260518_1530","20260518_1550","20260518_1610","20260518_1630"],"closeAt":0}}
for sid in ["20260518_1530","20260518_1610"]: seed[f"consults/c0/taken/{sid}"]={"t":1}
W=228; DSF=1170/W
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(service_workers='block',viewport={'width':W,'height':round(2280/DSF)},device_scale_factor=DSF); pg=ctx.new_page()
    for n,f in (('firebase-app.js',F+'app.js'),('firebase-auth.js',F+'auth.js'),('firebase-firestore.js',F+'fs.js')):
        pg.route('**/firebasejs/**/'+n,lambda r,_q=None,f=f:r.fulfill(path=f,content_type='text/javascript'))
    pg.add_init_script("localStorage.setItem('fake:fs',%s)"%json.dumps(json.dumps(seed)))
    pg.clock.set_fixed_time('2026-05-13T10:00:00+09:00')
    pg.goto('http://localhost:8770/app/book.html?c=c0'); pg.wait_for_timeout(1500)
    pg.fill('input >> nth=0','20302'); pg.fill('input >> nth=1','이세모'); pg.fill('input >> nth=2','1234'); pg.wait_for_timeout(300)
    print(pg.evaluate("[...document.querySelectorAll('button')].map(b=>b.textContent)"))
    pg.click('text=상담 시간 선택'); pg.wait_for_timeout(1200)
    print(pg.evaluate("document.body.innerText")[:300])
    css='''
    .chips{display:grid!important;grid-template-columns:1fr 1fr;gap:8px!important}.chips .chip{width:100%!important}
    body{padding-top:@PT@px!important}
    .sbar{position:absolute;left:0;right:0;top:0;height:@SH@px;display:flex;align-items:center;justify-content:space-between;padding:0 @SP@px;font:600 @SF@px SUITE,system-ui,sans-serif;color:#111;background:#fff}
    .hole{position:absolute;left:50%;top:@HT@px;width:@HD@px;height:@HD@px;margin-left:-@HR@px;border-radius:50%;background:#111}
    .url{position:absolute;left:@UL@px;right:@UL@px;top:@UT@px;height:@UH@px;border-radius:99px;background:#f1f2f4;display:flex;align-items:center;gap:@UG@px;padding:0 @UP@px;font:500 @UF@px system-ui,sans-serif;color:#222}
    '''
    for k,v in {'PT':W*0.255,'SH':W*0.075,'SP':W*0.06,'SF':W*0.036,'HT':W*0.018,'HD':W*0.03,'HR':W*0.015,'UL':W*0.03,'UT':W*0.1,'UH':W*0.1,'UG':W*0.015,'UP':W*0.03,'UF':W*0.032}.items(): css=css.replace('@'+k+'@',f'{v:.2f}')
    pg.add_style_tag(content=css)
    pg.evaluate('''()=>{const b=document.body;b.insertAdjacentHTML("afterbegin",'<div class="sbar"><span>15:30</span><span style="display:flex;gap:4px;align-items:center"><svg width="11" height="8" viewBox="0 0 12 8"><rect x="0" y="5" width="2" height="3" rx=".5"/><rect x="3" y="3.5" width="2" height="4.5" rx=".5"/><rect x="6" y="2" width="2" height="6" rx=".5"/><rect x="9" y="0" width="2" height="8" rx=".5"/></svg><svg width="10" height="8" viewBox="0 0 12 9"><path d="M0 3a9 9 0 0 1 12 0L6 9z"/></svg><svg width="14" height="8" viewBox="0 0 18 9"><rect x=".5" y=".5" width="15" height="8" rx="2.2" fill="none" stroke="#111"/><rect x="2" y="2" width="12" height="5" rx="1" fill="#111"/></svg></span></div><div class="hole"></div><div class="url"><svg width="8" height="9" viewBox="0 0 10 12"><rect x="1" y="5" width="8" height="6.5" rx="1.5"/><path d="M3 5V3.5a2 2 0 0 1 4 0V5" fill="none" stroke="#222"/></svg>iruroda.github.io/hagisiro</div>')}''')
    pg.wait_for_timeout(300)
    pg.screenshot(path='/tmp/sb/book_try.png')
    b.close()
