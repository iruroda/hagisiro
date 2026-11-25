from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch()
    for w,h,n in [(1280,900,'d'),(390,800,'m'),(320,700,'s')]:
        pg=b.new_page(viewport={'width':w,'height':h})
        pg.goto('http://localhost:8770/index.html'); pg.wait_for_timeout(800)
        d=pg.query_selector('.desk'); d.scroll_into_view_if_needed(); pg.wait_for_timeout(500)
        d.screenshot(path=f'/tmp/sb/shots/hero_{n}.png')
    b.close()
