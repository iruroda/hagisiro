import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
        pg=await b.new_page(viewport={'width':900,'height':640})
        errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.route('**/*firebase*/**',lambda r:r.abort())
        await pg.goto('http://localhost:8765/index.html?widget=1'); await pg.wait_for_timeout(1500)
        await pg.screenshot(path='/tmp/s1.png')
        print(errs)
        await b.close()
asyncio.run(main())
