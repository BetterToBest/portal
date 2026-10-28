"""Browser checks for every page in the repository (plan step S4; gates G6 and G7 in docs/phase-3-test-plan.md).

It serves the repository on 127.0.0.1, opens every page listed by `git ls-files '*.html'` in headless
Chromium, in light and in dark, and fails when:
  - the page asks for anything off the local server (fonts, scripts, images, anything; data: URLs are fine);
  - axe-core reports a serious or critical accessibility problem, on the page as loaded or after its
    buttons are clicked (the full axe results are saved as JSON, see below);
  - a control cannot be reached with Tab, shows no visible change when it has keyboard focus, or Tab
    gets stuck in one part of the page and never leaves it;
  - clicking a preset, Run or other button logs a console error or throws;
  - a relative link or src points at a file that is not in the repository, or a #anchor names no id.
Links to other sites are counted but never fetched. Requests off the local server are blocked, not sent.

These are automated checks only. They do not replace testing by people who use a screen reader,
a keyboard alone or a small screen.

Needs Python 3, Playwright for Python with Chromium, and axe-core from npm (nothing is added to the repo):
  pip install playwright==1.63.0 && python -m playwright install chromium
  npm install --no-save --prefix "$TMPDIR/axe" axe-core@4.14.0
Run from the repo root:
  AXE_PATH="$TMPDIR/axe/node_modules/axe-core/axe.min.js" python3 -I tests/pages.test.py [page.html ...]
With no pages named, it checks them all.
AXE_PATH defaults to node_modules/axe-core/axe.min.js. The axe results go to $PAGES_OUT
(default: a cip-pages folder in the system temp folder). CHROMIUM_PATH picks a Chromium binary.
"""
import functools
import html.parser
import http.server
import json
import os
import posixpath
import subprocess
import sys
import tempfile
import threading
import urllib.parse

from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
AXE_PATH = os.environ.get('AXE_PATH', os.path.join(ROOT, 'node_modules', 'axe-core', 'axe.min.js'))
OUT = os.environ.get('PAGES_OUT', os.path.join(tempfile.gettempdir(), 'cip-pages'))

fails = 0


def ok(cond, msg):
    global fails
    if cond:
        print('ok  ', msg)
    else:
        fails += 1
        print('FAIL', msg)
    sys.stdout.flush()


def tracked(pattern=None):
    args = ['git', 'ls-files'] + ([pattern] if pattern else [])
    return subprocess.run(args, cwd=ROOT, capture_output=True, text=True, check=True).stdout.split()


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


class Ids(html.parser.HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = set()

    def handle_starttag(self, tag, attrs):
        for k, v in attrs:
            if v and (k == 'id' or (k == 'name' and tag == 'a')):
                self.ids.add(v)


@functools.lru_cache(maxsize=None)
def ids_in(path):
    p = Ids()
    with open(os.path.join(ROOT, path), encoding='utf-8') as f:
        p.feed(f.read())
    return frozenset(p.ids)


# In the page: list the controls a keyboard user must reach, one entry per radio group.
LIST_CONTROLS = r"""() => {
  const sel = 'a[href],button,input,select,textarea,summary,[tabindex],[contenteditable="true"]';
  const out = [], groups = {};
  let n = 0;
  for (const el of document.querySelectorAll(sel)) {
    if (el.disabled || el.closest('[inert]') || el.tabIndex < 0) continue;
    if (el.matches('input[type=hidden]')) continue;
    if (el.matches('summary') && el.parentElement.tagName !== 'DETAILS') continue;
    if (!el.checkVisibility({checkVisibilityCSS: true}) || !el.getClientRects().length) continue;
    const id = 'c' + (n++);
    el.setAttribute('data-pc', id);
    const what = (el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + ' "' +
      (el.getAttribute('aria-label') || el.textContent || el.value || el.name || '').trim().replace(/\s+/g, ' ').slice(0, 40) + '"');
    if (el.matches('input[type=radio]') && el.name) {
      const key = 'radio:' + el.name;
      if (!groups[key]) { groups[key] = {key, ids: [], what: 'radio group "' + el.name + '"'}; out.push(groups[key]); }
      groups[key].ids.push(id);
    } else out.push({key: id, ids: [id], what});
  }
  return out;
}"""

# In the page: the styles that can show focus, for the element marked data-pc=id.
STYLE_OF = r"""(id) => {
  const el = document.querySelector('[data-pc="' + id + '"]');
  if (!el) return null;
  const s = getComputedStyle(el);
  return {outline: s.outlineStyle === 'none' || parseFloat(s.outlineWidth) === 0 ? 'none' : s.outlineStyle + ' ' + s.outlineWidth + ' ' + s.outlineColor,
          shadow: s.boxShadow, border: s.borderColor + ' ' + s.borderWidth, bg: s.backgroundColor,
          color: s.color, deco: s.textDecorationLine, stroke: s.stroke, strokeWidth: s.strokeWidth};
}"""

ACTIVE = "() => { const a = document.activeElement; return !a || a === document.body || a === document.documentElement ? null : (a.getAttribute('data-pc') || '?' + a.tagName.toLowerCase() + (a.id ? '#' + a.id : '')); }"

# In the page: every relative URL in a link or src attribute, resolved against the page.
LINKS = r"""() => {
  const out = [];
  for (const el of document.querySelectorAll('[href],[src]')) {
    for (const attr of ['href', 'src']) {
      const raw = el.getAttribute(attr);
      if (raw === null || el.tagName === 'use' || /^(data|blob|javascript|mailto|tel|about):/i.test(raw.trim())) continue;
      out.push({raw, url: new URL(raw, document.baseURI).href});
    }
  }
  return out;
}"""

BUTTONS = "() => [...document.querySelectorAll('button,[role=button]')].map((b, i) => { b.setAttribute('data-btn', i); return {i, what: (b.getAttribute('aria-label') || b.textContent).trim().replace(/\\s+/g, ' ').slice(0, 50)}; })"


def focused(page):
    return page.evaluate("() => { const a = document.activeElement; return a.tagName.toLowerCase() + (a.id ? '#' + a.id : ''); }")


def keyboard(page, label):
    """Tab through the page from wherever focus starts. Every control must be reached and look different
    when focused, and focus must leave the page (wrap around) within one round trip."""
    page.evaluate("() => { document.activeElement && document.activeElement.blur && document.activeElement.blur(); document.querySelectorAll('[data-pc]').forEach(e => e.removeAttribute('data-pc')); }")
    controls = page.evaluate(LIST_CONTROLS)
    base = {i: page.evaluate(STYLE_OF, i) for c in controls for i in c['ids']}
    seen, unclear, left, stuck, last = set(), [], False, None, None
    for _ in range(2 * len(base) + 10):
        page.keyboard.press('Tab')
        a = page.evaluate(ACTIVE)
        if a is None:
            left = True
            if seen and all(any(i in seen for i in c['ids']) for c in controls):
                break
            continue
        if a.startswith('?') or a in seen:
            if a == last:
                stuck = focused(page)  # Tab did not move focus at all
                break
            last = a
            continue
        seen.add(a)
        last = a
        now = page.evaluate(STYLE_OF, a)
        before = base.get(a)
        if now == before:
            unclear.append(a)
    whats = {i: c['what'] for c in controls for i in c['ids']}
    missed = [c['what'] for c in controls if not any(i in seen for i in c['ids'])]
    ok(not missed, f'{label}: Tab reaches all {len(controls)} controls' + (': missed ' + '; '.join(missed[:8]) if missed else ''))
    ok(not unclear, f'{label}: every control shows visible focus' + (': none on ' + '; '.join(whats[i] for i in unclear[:8]) if unclear else ''))
    ok((left or not controls) and not stuck, f'{label}: Tab is not trapped (focus leaves the page and wraps around)'
       + (f': stuck on {stuck}' if stuck else ': never left the page' if not left and controls else ''))


def axe(page, axe_src, label, results):
    page.add_script_tag(content=axe_src)
    r = page.evaluate("async () => await axe.run(document)")
    results[label] = r
    bad = [v for v in r['violations'] if v['impact'] in ('serious', 'critical')]
    ok(not bad, f"{label}: no serious or critical axe violations ({len(r['passes'])} rules pass, {len(r['violations']) - len(bad)} minor or moderate)"
       + (': ' + '; '.join(f"{v['id']} ({v['impact']}) on {', '.join(' '.join(n['target']) for n in v['nodes'][:3])}" for v in bad) if bad else ''))


def check_links(page, base, files, label):
    broken, outside = [], set()
    for link in page.evaluate(LINKS):
        u = urllib.parse.urlsplit(link['url'])
        if not link['url'].startswith(base):
            outside.add(u.netloc)
            continue
        path = urllib.parse.unquote(u.path)[1:]
        if path == '' or path.endswith('/'):
            path += 'index.html'
        path = posixpath.normpath(path)
        if path not in files:
            broken.append(f"{link['raw']} (no file {path})")
        elif u.fragment and path.endswith('.html') and urllib.parse.unquote(u.fragment) not in ids_in(path):
            broken.append(f"{link['raw']} (no id \"{u.fragment}\" in {path})")
    ok(not broken, f'{label}: relative links and anchors resolve ({len(outside)} outside sites linked, not fetched)'
       + (': ' + '; '.join(sorted(set(broken))[:8]) if broken else ''))


def check_page(ctx, base, path, label, files, axe_src, results):
    off, errors = [], []

    def route(r):
        if r.request.url.startswith(base):
            r.continue_()
        else:
            off.append(r.request.url)
            r.abort()
    ctx.route('**/*', route)
    page = ctx.new_page()
    page.on('console', lambda m: m.type == 'error' and errors.append('console: ' + m.text))
    page.on('pageerror', lambda e: errors.append('uncaught: ' + str(e)))
    page.on('filechooser', lambda fc: None)
    page.goto(base + path, wait_until='load')
    page.wait_for_timeout(200)
    ok(not errors, f'{label}: loads with no console errors' + (': ' + '; '.join(errors[:5]) if errors else ''))

    axe(page, axe_src, label + ' as loaded', results)
    keyboard(page, label + ' as loaded')
    check_links(page, base, files, label + ' as loaded')

    # Click every button: presets, Run, Count, Check, tabs, and the rest.
    errors.clear()
    clicked = 0
    for b in page.evaluate(BUTTONS):
        loc = page.locator(f'[data-btn="{b["i"]}"]')
        if not loc.count() or not loc.is_visible() or not loc.is_enabled():
            continue
        before = len(errors)
        loc.click(timeout=5000)
        clicked += 1
        page.wait_for_timeout(150)
        errors[before:] = [f'after "{b["what"]}": {e}' for e in errors[before:]]
    page.wait_for_timeout(1000)
    ok(not errors, f'{label}: clicked {clicked} buttons with no console errors' + (': ' + '; '.join(errors[:5]) if errors else ''))

    axe(page, axe_src, label + ' after clicks', results)
    keyboard(page, label + ' after clicks')
    check_links(page, base, files, label + ' after clicks')
    ok(not off, f'{label}: no requests off the local server' + (': ' + '; '.join(sorted(set(off))[:5]) if off else ''))


def main():
    if not os.path.exists(AXE_PATH):
        print(f'FAIL axe-core not found at {AXE_PATH}. Install it with: npm install --no-save --prefix <folder> axe-core, then set AXE_PATH.')
        sys.exit(1)
    with open(AXE_PATH, encoding='utf-8') as f:
        axe_src = f.read()
    files = set(tracked())
    pages = sys.argv[1:] or tracked('*.html')
    if not sys.argv[1:]:
        ok(len(pages) >= 6, f'{len(pages)} pages listed by git ls-files')

    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=ROOT))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f'http://127.0.0.1:{server.server_address[1]}/'
    results = {}

    with sync_playwright() as pw:
        exe = os.environ.get('CHROMIUM_PATH')
        browser = pw.chromium.launch(**({'executable_path': exe} if exe else {}))
        for scheme in ('light', 'dark'):
            for path in pages:
                label = f'{path} [{scheme}]'
                ctx = browser.new_context(color_scheme=scheme, viewport={'width': 1280, 'height': 900})
                try:
                    check_page(ctx, base, path, label, files, axe_src, results)
                except Exception as e:
                    ok(False, f'{label}: the checks could not finish: ' + str(e).splitlines()[0])
                ctx.close()
        browser.close()
    server.shutdown()

    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, 'axe-results.json'), 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=1)
    print(f'Full axe results: {os.path.join(OUT, "axe-results.json")}')
    print(f'{fails} failure(s)' if fails else 'All page checks passed.')
    sys.exit(1 if fails else 0)


if __name__ == '__main__':
    main()
