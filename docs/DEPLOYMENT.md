# GitHub Pages deployment

Application: https://wieslawsoltes.github.io/NexoraEngineering/

Repository: https://github.com/wieslawsoltes/NexoraEngineering

## Branches and distribution

`main` contains the original modular application, sample engineering project, tests, documentation, screenshots, and the standalone HTML distribution. `gh-pages` contains the publishable standalone `index.html`, `.nojekyll`, and `build-info.json` only. The application has no runtime dependencies, CDN requests, or server-side component.

The GitHub Actions workflow `.github/workflows/ci-pages.yml` runs on pushes to `main`, pull requests targeting `main`, and manual dispatch. It syntax-checks JavaScript, runs the kernel tests, verifies reproducible builds, and exercises the hosted standalone distribution in Chromium. Reports and screenshots are retained as workflow artifacts. Pull requests never run the publication job.

After a successful main-branch build, the publication job reads the actual Pages configuration. In branch publishing mode, it updates `gh-pages` with a normal fast-forward push and explicitly requests a Pages rebuild. In GitHub Actions publishing mode, it deploys the tested Pages artifact. No personal access token is required; permissions are scoped to the publication job.

The final check fetches the public HTTPS site, verifies its source commit in `build-info.json`, and compares the served HTML SHA-256 with the tested artifact. A stale, unavailable, or mismatched deployment fails the job rather than reporting publication success.

## Pages configuration

The supported Settings > Pages configurations are **Deploy from a branch: gh-pages / (root)** and **GitHub Actions**. The workflow does not change repository administration settings. Do not configure the source as `main / docs`; that directory contains engineering documentation, not the generated application.

Do not edit `gh-pages/index.html` by hand: the next successful publication regenerates it. Make application changes in `src`, `styles.css`, and the root modular `index.html` on `main` instead.

## Local development

```sh
npm test
npm run build
python3 -m http.server 8765
```

Open `http://localhost:8765/` for the modular application or `http://localhost:8765/dist/` for the standalone build. For browser checks, install the Python Playwright package and Chromium, then set `NEXORA_URL` when running `tests/browser.test.py`.

CI browser workflows force Canvas fallback. They do not establish hardware WebGPU compatibility or performance. The separate strict GPU test is documented in `TESTING.md`.
