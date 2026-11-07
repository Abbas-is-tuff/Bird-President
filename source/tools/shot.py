import asyncio, sys, os
from playwright.async_api import async_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
        w, h = (390, 844) if 'mobile' in sys.argv else (1400, 860)
        pg = await b.new_page(viewport={'width': w, 'height': h})
        logs = []
        pg.on('console', lambda m: logs.append(f'{m.type}: {m.text}'))
        pg.on('pageerror', lambda e: logs.append(f'PAGEERROR: {e}'))
        async def route(r):
            u = r.request.url
            if 'cdn.jsdelivr.net/npm/three@0.160.0/' in u:
                rel = u.split('three@0.160.0/')[1]
                await r.fulfill(path=os.path.join(ROOT, 'node_modules/three', rel), content_type='application/javascript')
            elif 'fonts.g' in u: await r.fulfill(body='', content_type='text/css')
            else: await r.continue_()
        await pg.route('**/*', route)
        await pg.goto('http://localhost:8765/index.html')
        await pg.wait_for_timeout(int(os.environ.get('WAIT', '9000')))
        script = os.environ.get('SCRIPT')
        if script:
            for step in script.split(';;'):
                step = step.strip()
                if step.startswith('wait '): await pg.wait_for_timeout(int(step[5:]))
                elif step.startswith('shot '): await pg.screenshot(path=step[5:])
                elif step: 
                    try: await pg.evaluate(step)
                    except Exception as e: logs.append('EVAL ERR '+str(e)[:300])
        await pg.screenshot(path=os.environ.get('OUT', '/tmp/shot.png'))
        print('\n'.join(logs[:60]))
        await b.close()
asyncio.run(main())
