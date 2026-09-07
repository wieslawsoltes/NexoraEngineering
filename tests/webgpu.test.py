"""Secure-origin WebGPU, device-loss, and persistence smoke test.

This test is intentionally separate from the portable Canvas workflow suite.
It requires normal browser navigation and storage, plus a WebGPU adapter.
It FAILS when WebGPU is unavailable; fallback is not treated as GPU success.

Start a local server before running:
    python3 -m http.server 8765
    NEXORA_URL=http://localhost:8765/ python3 tests/webgpu.test.py

CHROMIUM_PATH chooses a browser executable. HEADLESS=0 shows the browser.
The browser context is fresh and isolated from the user's normal profile.
"""
import asyncio
import json
import os
from pathlib import Path

from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]


async def main():
    url = os.environ.get('NEXORA_URL', 'http://localhost:8765/')
    checks = []
    errors = []
    async with async_playwright() as playwright:
        options = {'headless': os.getenv('HEADLESS', '1') != '0'}
        executable = os.getenv('CHROMIUM_PATH')
        if not executable and Path('/usr/bin/chromium').is_file():
            executable = '/usr/bin/chromium'
        if executable:
            options['executable_path'] = executable
        browser = await playwright.chromium.launch(**options)
        context = await browser.new_context(viewport={'width': 1600, 'height': 1000})
        page = await context.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        try:
            await page.goto(url, wait_until='networkidle')
            await page.wait_for_function('window.nexora?.ready')
            diagnostics = await page.evaluate('''() => ({
                secureContext: isSecureContext,
                renderer: nexora.renderer.mode,
                reason: nexora.renderer.lastError || null,
                adapter: nexora.renderer.adapterInfo ? {
                    vendor: nexora.renderer.adapterInfo.vendor,
                    architecture: nexora.renderer.adapterInfo.architecture,
                    device: nexora.renderer.adapterInfo.device,
                    description: nexora.renderer.adapterInfo.description,
                    isFallbackAdapter: nexora.renderer.adapterInfo.isFallbackAdapter
                } : null
            })''')
            assert diagnostics['secureContext'], 'Test requires a secure browser origin.'
            assert diagnostics['renderer'] == 'webgpu', json.dumps(diagnostics)
            checks.append('Native WebGPU initialization and shader/pipeline creation')

            result = await page.evaluate('''async () => {
                const renderer = nexora.renderer;
                const device = renderer.device;
                device.pushErrorScope('validation');
                nexora.setView('diagram', 'pid-101');
                nexora.select(['p101a']);
                nexora.runAction('rotate');
                nexora.camera.zoomAt({x: 300, y: 250}, 1.2);
                nexora.runAction('fit');
                await new Promise(resolve => requestAnimationFrame(() =>
                    requestAnimationFrame(resolve)));
                await device.queue.onSubmittedWorkDone();
                const error = await device.popErrorScope();
                return {
                    renderer: renderer.mode,
                    drawCalls: renderer.drawCalls,
                    error: error?.message || null,
                    strokeCount: renderer.strokeCount,
                    fillCount: renderer.fillCount
                };
            }''')
            assert result['renderer'] == 'webgpu', result
            assert result['error'] is None, result
            assert 1 <= result['drawCalls'] <= 2, result
            assert result['strokeCount'] > 0 and result['fillCount'] > 0, result
            checks.append('Native GPU submission, fill/stroke batches, and validation scope')
            await page.screenshot(path=str(ROOT / 'docs' / 'webgpu-workbench.png'))

            marker = 'Persisted GPU smoke-test description'
            await page.evaluate('''async marker => {
                nexora.store.transact('Persistence test', () =>
                    nexora.store.update('p101a', 'description', marker));
                await nexora.save();
            }''', marker)
            save_state = await page.locator('#save-state').inner_text()
            assert 'Saved locally' in save_state, save_state
            await page.reload(wait_until='networkidle')
            await page.wait_for_function('window.nexora?.ready')
            assert await page.evaluate('nexora.store.nodes.get("p101a").description') == marker
            checks.append('Browser project persistence survives a page reload')

            assert await page.evaluate('nexora.renderer.mode') == 'webgpu'
            await page.evaluate('nexora.renderer.device.destroy()')
            await page.wait_for_function('nexora.renderer.mode === "canvas"')
            await page.evaluate('nexora.runAction("fit")')
            await page.wait_for_timeout(150)
            assert await page.evaluate('nexora.renderer.drawCalls > 0')
            checks.append('Device destruction switches to a usable Canvas renderer')
            assert not errors, errors
            report = {
                'browser': browser.version,
                'url': url,
                'diagnostics': diagnostics,
                'submission': result,
                'checks': checks,
                'pageErrors': errors,
                'note': 'Adapter metadata is reported; WebGPU API success alone does not prove a physical GPU.'
            }
            (ROOT / 'docs' / 'webgpu-smoke-results.json').write_text(json.dumps(report, indent=2))
            print(json.dumps(report, indent=2))
        finally:
            await context.close()
            await browser.close()


if __name__ == '__main__':
    asyncio.run(main())
