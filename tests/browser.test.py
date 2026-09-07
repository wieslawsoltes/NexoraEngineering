"""Playwright integration tests. Optional NEXORA_URL tests a hosted build; otherwise
inject the standalone HTML into about:blank (for restricted browser environments).
The injected mode intentionally has no secure origin and cannot exercise WebGPU/IDB.
"""
import asyncio, json, os
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[1]

async def main():
    results=[]
    async with async_playwright() as p:
        launch_options = {'headless': os.getenv('HEADLESS', '1') != '0'}
        executable = os.getenv('CHROMIUM_PATH')
        if not executable and Path('/usr/bin/chromium').is_file(): executable = '/usr/bin/chromium'
        if executable: launch_options['executable_path'] = executable
        browser=await p.chromium.launch(**launch_options)
        page=await browser.new_page(viewport={'width':1680,'height':1050},device_scale_factor=1,accept_downloads=True)
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        async def settle(): await page.wait_for_timeout(100)
        async def check(name,condition):
            assert condition,name
            results.append({'name':name,'status':'passed'})
            print('PASS',name)
        async def xy(x,y):
            return await page.evaluate('([x,y])=>{const p=nexora.camera.screen({x,y}),r=document.getElementById("overlay").getBoundingClientRect();return {x:p.x+r.left,y:p.y+r.top}}',[x,y])
        async def click_world(x,y):
            point=await xy(x,y);await page.mouse.click(point['x'],point['y']);await settle()
        url=os.getenv('NEXORA_URL')
        if url: await page.goto(url,wait_until='networkidle')
        else: await page.set_content((ROOT/'Nexora-Engineering.html').read_text(),wait_until='load')
        await page.wait_for_function('window.nexora?.ready')
        await settle()
        await check('Application boots with three documents and an intact graph',await page.evaluate('nexora.store.documents.length===3&&nexora.store.nodes.size===48&&nexora.store.edges.size===39'))
        await check('Renderer initializes honestly',await page.evaluate('["webgpu","canvas"].includes(nexora.renderer.mode)'))
        # Property editing uses actual inspector fields.
        await page.locator('[data-property="description"]').fill('Duty pump — browser test')
        await page.locator('[data-property="description"]').press('Tab')
        await settle()
        await check('Inspector edits update the shared object',await page.evaluate('nexora.store.nodes.get("p101a").description==="Duty pump — browser test"'))
        await page.evaluate('nexora.runAction("undo")');await settle()
        await check('Undo restores the prior engineering attribute',await page.evaluate('nexora.store.nodes.get("p101a").description.includes("duty")'))
        # Canvas pointer drag.
        point=await xy(700,355);await page.mouse.move(point['x'],point['y']);await page.mouse.down();await page.mouse.move(point['x']+45,point['y']+25,steps=8);await page.mouse.up();await settle()
        await check('Canvas drag moves equipment and commits a transaction',await page.evaluate('nexora.store.nodes.get("p101a").x!==700&&nexora.store.undoStack.at(-1).label==="Move objects"'))
        await check('Live line route follows the moved pump',await page.evaluate('Math.abs(nexora.scene.entries.get("l6").points.at(-1).x-(nexora.store.nodes.get("p101a").x-29))<0.001'))
        await page.evaluate('nexora.runAction("undo")');await settle()
        # Symbol library placement.
        await page.locator('[data-library="Valves"]').click();await page.locator('.symbol-card[data-symbol="valve"]').click();await click_world(600,720)
        await check('Symbol library creates a real engineering object',await page.evaluate('nexora.store.nodes.size===49&&nexora.store.nodes.get([...nexora.state.selected][0]).type==="valve"'))
        await page.evaluate('nexora.runAction("undo")');await settle()
        # Routing from an equipment port through a bend to an instrument port.
        await page.evaluate('nexora.runAction("tool-signal")');await click_world(700,326);await click_world(710,220);await click_world(790,276)
        await check('Port-to-port routing stores semantic endpoint references',await page.evaluate('nexora.store.edges.size===40&&nexora.store.edges.get([...nexora.state.selected][0]).from.node==="p101a"&&nexora.store.edges.get([...nexora.state.selected][0]).to.node==="pt101"'))
        await page.evaluate('nexora.runAction("undo");nexora.runAction("tool-select");nexora.select(["p101a"])');await settle()
        await page.locator('#overlay').focus();await page.keyboard.press('r');await settle()
        await check('Keyboard rotation changes the model',await page.evaluate('nexora.store.nodes.get("p101a").rotation===90'))
        await page.evaluate('nexora.runAction("undo")');await settle()
        # Double-click register cells is intentionally tested, not just API editing.
        await page.locator('[data-table="equipment"]').click()
        cell=page.locator('#data-table [data-cell="e101"][data-key="description"]')
        await cell.dblclick();await settle()
        await check('Register double-click enters inline editing',await cell.locator('input').count()==1)
        await cell.locator('input').fill('Heat exchanger edited in register');await cell.locator('input').press('Enter');await settle()
        await check('Inline register edit updates the engineering graph',await page.evaluate('nexora.store.nodes.get("e101").description==="Heat exchanger edited in register"'))
        await page.evaluate('nexora.runAction("undo")');await settle()
        # Search, selection and navigation.
        await page.locator('[data-action="search"]').first.click();await page.locator('#command-query').fill('PT-101');await page.locator('.command-result').first.click();await settle()
        await check('Command palette resolves and selects a tagged object',await page.evaluate('nexora.state.selected.has("pt101")'))
        await page.evaluate('nexora.fit()');await settle()
        await page.locator('.doc-tab[data-doc="pid-201"]').click();await settle()
        await check('Document tab switches the active engineering scene',await page.evaluate('nexora.state.docId==="pid-201"&&nexora.scene.entries.has("air-v")&&!nexora.scene.entries.has("tk101")'))
        await page.locator('.doc-tab[data-doc="eld-101"]').click();await settle()
        await check('Electrical document uses actual cable graph',await page.evaluate('nexora.state.docId==="eld-101"&&nexora.scene.entries.has("mot-0")'))
        await page.screenshot(path=str(ROOT/'docs/electrical.png'))
        # Registers and document manager.
        await page.evaluate('nexora.runAction("register")');await settle()
        await check('Full object register is available',await page.locator('#register-view .register-table tbody tr').count()>10)
        await page.screenshot(path=str(ROOT/'docs/register.png'))
        await page.evaluate('nexora.runAction("documents")');await settle()
        await check('Document manager lists all drawings',await page.locator('.doc-card').count()==3)
        await page.evaluate('nexora.setView("diagram","pid-101")');await settle()
        # Layer visibility.
        await page.evaluate('nexora.runAction("layers")');await page.locator('[data-layer="instruments"]').uncheck();await settle();await page.locator('#modal [data-action="close-modal"]').click();await settle()
        await check('Layer filtering changes scene, not graph',await page.evaluate('!nexora.scene.entries.has("pt101")&&nexora.store.nodes.has("pt101")'))
        await page.evaluate('nexora.runAction("layers")');await page.locator('[data-layer="instruments"]').check();await page.locator('#modal [data-action="close-modal"]').click();await settle()
        # Validation navigates to the actual offending object.
        await page.evaluate('nexora.runAction("validate")');await settle()
        await check('Validation displays the known incomplete range',await page.locator('.issue-card').count()==1)
        await page.locator('.issue-card button').click();await settle()
        await check('Validation issue locates its object',await page.evaluate('nexora.state.selected.has("tt101")'))
        # Revision, compare and restore APIs.
        await page.evaluate('nexora.runAction("capture-revision")');await page.locator('#revision-label').fill('Browser test baseline');await page.locator('#capture-revision-apply').click();await settle()
        await check('Revision dialog captures a persistent graph snapshot',await page.evaluate('nexora.store.revisions.at(-1).label==="Browser test baseline"'))
        # Create and undo a document.
        await page.evaluate('nexora.runAction("new-document")');await page.locator('#new-doc-name').fill('Integration test');await page.locator('#new-doc-code').fill('PID-999');await page.locator('#create-doc').click();await settle()
        await check('New drawing dialog creates a real document',await page.evaluate('nexora.store.documents.length===4&&nexora.store.documents.some(d=>d.code==="PID-999")'))
        await page.evaluate('nexora.runAction("undo")');await settle()
        await check('Document creation is undoable',await page.evaluate('nexora.store.documents.length===3'))
        # Clipboard graph identity remapping.
        await page.evaluate('nexora.setView("diagram","pid-101");nexora.select(["p101a","nrv101"]);nexora.runAction("copy");nexora.runAction("paste")');await settle()
        await check('Clipboard clones nodes and their internal connection',await page.evaluate('nexora.store.nodes.size===50&&nexora.store.edges.size===40&&nexora.state.selected.size===3'))
        await page.evaluate('nexora.runAction("undo")');await settle()
        # Export helpers generate actual browser downloads.
        export_results=[]
        for action,extension in [('export-json','.json'),('export-svg','.svg'),('export-csv','.csv'),('export-dxf','.dxf'),('export-png','.png')]:
            try:
                async with page.expect_download(timeout=12000) as info: await page.evaluate('(a)=>nexora.runAction(a)',action)
                download=await info.value
                export_results.append((action,download.suggested_filename.endswith(extension)))
                # Policy may prevent writing, but creation and filenames can still be tested.
            except Exception as error:
                export_results.append((action,str(error)[:100]))
        for action,result in export_results: await check(action+' produces a download',result is True)
        # Resize breakpoints and all core menus remain usable.
        for size in [{'width':1280,'height':800},{'width':1920,'height':1080}]:
            await page.set_viewport_size(size);await settle()
            await check(f'Responsive layout {size["width"]}×{size["height"]}',await page.evaluate('document.querySelector("#overlay").getBoundingClientRect().width>500'))
        await page.set_viewport_size({'width':1680,'height':1050})
        await page.evaluate('nexora.select(["p101a"]);nexora.fit()');await settle()
        # Remove test-generated toasts for a clean real-rendered screenshot.
        await page.evaluate('document.getElementById("toast-region").textContent=""')
        await page.screenshot(path=str(ROOT/'docs/workbench.png'))
        await check('No uncaught browser exceptions',not errors)
        diagnostics=await page.evaluate('({renderer:nexora.renderer.mode,rendererReason:nexora.renderer.lastError,secureContext:isSecureContext,drawCalls:nexora.renderer.drawCalls,frameCount:nexora.state.frameCount,objects:nexora.store.nodes.size+nexora.store.edges.size})')
        report={'environment':'Chromium '+browser.version,'mode':'hosted' if url else 'injected standalone / opaque origin','diagnostics':diagnostics,'results':results,'pageErrors':errors}
        (ROOT/'docs/browser-test-results.json').write_text(json.dumps(report,indent=2))
        print(json.dumps(report,indent=2))
        await browser.close()

asyncio.run(main())
