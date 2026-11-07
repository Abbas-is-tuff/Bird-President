import asyncio, sys, os, base64
from playwright.async_api import async_playwright
URL = sys.argv[1]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
        pg = await b.new_page(viewport={'width': 1280, 'height': 800})
        logs, blocked = [], []
        pg.on('console', lambda m: logs.append(f'{m.type}: {m.text}'))
        pg.on('pageerror', lambda e: logs.append(f'PAGEERROR: {e}'))
        async def route(r):
            u = r.request.url
            if u.startswith('http://localhost') or u.startswith('file:') or u.startswith('data:') or u.startswith('blob:'): await r.continue_()
            else: blocked.append(u); await r.abort()
        await pg.route('**/*', route)
        await pg.goto(URL)
        await pg.wait_for_timeout(9000)
        await pg.evaluate("document.querySelector('[data-m=new]').click()")
        await pg.wait_for_timeout(800)
        if 'icon' in sys.argv:
            src = await pg.evaluate("document.querySelector('[data-bird=abbas] img').src")
            open('/tmp/abbas.png','wb').write(base64.b64decode(src.split(',')[1]))
        await pg.evaluate("document.querySelector('[data-m=start]').click()")
        await pg.wait_for_timeout(1500)
        await pg.evaluate("document.querySelector('.opt').click()")
        await pg.wait_for_timeout(2500)
        await pg.screenshot(path='/tmp/offline.png')
        print('blocked external requests:', blocked)
        print('\n'.join(logs[:20]))
        await b.close()
asyncio.run(main())
