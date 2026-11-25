from playwright.sync_api import sync_playwright
import sys
with sync_playwright() as p:
    b=p.chromium.launch()
    for w in (1280,390):
        pg=b.new_page(viewport={'width':w,'height':900})
        pg.goto('http://localhost:8770/index.html'); pg.wait_for_timeout(500)
        pg.evaluate("document.querySelector('#dmatt').scrollIntoView({block:'center'})")
        seen={}
        for i in range(160):
            r=pg.evaluate("""()=>{const q=s=>document.querySelector(s).getBoundingClientRect();return [Math.round(q('#dmatt .chips').height),Math.round(q('#dmatt .dh').top),Math.round(q('#dmatt .dh').height),Math.round(q('#dmtb').top),Math.round(q('#dmtb').height),document.querySelector('#dmch').innerText.slice(0,30)]}""")
            k=tuple(r[:5]); seen.setdefault(k,r[5])
            pg.wait_for_timeout(100)
        print(w); [print(' ',k,v) for k,v in seen.items()]
    b.close()
