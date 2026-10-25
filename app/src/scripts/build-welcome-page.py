"""
Builds lib/free-video/welcome-page-html.ts from the live last page of the ClickBank funnel
(bluefx.net/ai-coaching-call-cbup/), owner 2026-10-25: "exactly this page", with only these changes:
- the order band becomes the thank-you block (your video ad without the SAMPLE stamp, today);
- "as an AI Media Machine customer" -> "as a BlueFX customer";
- the "One of your 3 fixes is a video you can make in your AI Media Machine" box and the other
  AI Media Machine / login / ClickBank lines go;
- no "No thanks" links; the "no website" answer says my team can help make one;
- the form posts to the engine's Unlimited Video Ads gift (spartan-gift), with the member's website and email filled in.
Run: python3 src/scripts/build-welcome-page.py <saved copy of the live page>
"""
import json, re, sys

src = open(sys.argv[1], encoding='utf-8').read()
s = src

def swap(old, new, count=1):
    global s
    n = s.count(old)
    if n != count:
        raise SystemExit(f'Expected {count} x, found {n}: {old[:90]!r}')
    s = s.replace(old, new)

def cut_between(start, end, keep=''):
    """Remove from start (inclusive) to end (inclusive)."""
    global s
    a = s.find(start)
    if a < 0: raise SystemExit(f'not found: {start[:80]!r}')
    b = s.find(end, a)
    if b < 0: raise SystemExit(f'not found after start: {end[:80]!r}')
    s = s[:a] + keep + s[b + len(end):]

# --- head: title, no ClickBank tracking ---
s = re.sub(r'<title>[^<]*</title>', '<title>Welcome to Unlimited Video Ads | BlueFX</title>', s, count=1)
cut_between('<script>\n    window.clickbank', 'hop.min.js" defer></script>')

# --- links and pictures point at bluefx.net (this copy lives on app.bluefx.net) ---
swap('src="/cb-funnel/', 'src="https://bluefx.net/cb-funnel/', s.count('src="/cb-funnel/'))
for path in ['/privacy-policy/', '/terms/', '/contact-us/']:
    swap(f'href="{path}"', f'href="https://bluefx.net{path}"')
swap('<a href="/">Home</a>', '<a href="https://bluefx.net/">Home</a>')

# --- the order band becomes the thank-you block ---
cut_between('<p class="fv-orderbar-ok">', '<span class="is-now"></span></div>',
  '<p class="fv-orderbar-ok">Thank you{{NAME}}! You\'re in.</p>\n'
  '    <p class="fv-orderbar-step">Today my team sends you your video ad without the SAMPLE stamp. Watch your inbox for an email from support@bluefx.net.</p>')

# --- "a BlueFX customer" ---
swap('as an AI Media Machine customer', 'as a BlueFX customer', s.count('as an AI Media Machine customer'))

# --- no AI Media Machine fix box ---
cut_between('<!-- True with engine patch part 01', '<span>One of your 3 fixes is a video you can make in your AI Media Machine.</span></p>')

# --- the form: filled in, its own engine door ---
swap('placeholder="yourbusiness.com" class="fv-input">', 'placeholder="yourbusiness.com" value="{{SITE}}" class="fv-input">')
swap('placeholder="you@yourbusiness.com" class="fv-input">', 'placeholder="you@yourbusiness.com" value="{{EMAIL}}" class="fv-input">')
swap('<p class="fv-form-fine">Free. Your login is one click after this.</p>', '<p class="fv-form-fine">Free. Takes about 3 minutes.</p>')
swap("var ENDPOINT = 'https://aispartan.com/.netlify/functions/spartan-oto3';", "var ENDPOINT = 'https://aispartan.com/.netlify/functions/spartan-gift';")
swap("honeypot: fHp.value, utm: { utm_source: 'cb-oto3' } })", "honeypot: fHp.value, first_name: {{FIRST_JS}}, utm: { utm_source: 'uva-gift' } })")
swap('No website yet? Tap "No thanks, take me to my login" below.', 'No website yet? Email support@bluefx.net, and my team can help you make one.')

# --- success state: no login step, no login button ---
cut_between('<li><span class="fv-ok-num" aria-hidden="true">1</span><span><b>Now:</b> press the green button', '</span></li>')
swap('<span class="fv-ok-num" aria-hidden="true">2</span>', '<span class="fv-ok-num" aria-hidden="true">1</span>')
swap('<span class="fv-ok-num" aria-hidden="true">3</span>', '<span class="fv-ok-num" aria-hidden="true">2</span>')
cut_between('<button type="button" class="fv-btn cta" onclick="cbGo(13,', '<span>Continue to My Login</span>\n        </button>')

# --- no "No thanks" links (the success script still looks for #hero-skip) ---
cut_between('<p id="hero-skip" class="fv-skip">', '</p>', '<p id="hero-skip" class="fv-skip" hidden></p>')
cut_between('<p class="fv-close-skip">', '</p>')

# --- FAQ and P.S. without the login / AI Media Machine lines ---
swap('You can leave this page right after you press the button: go to your login, and your report arrives by email.',
     'You can leave this page right after you press the button: your report arrives by email.')
swap('Then skip this gift: tap "No thanks, take me to my login" below. Your AI Media Machine login is next. The audit needs a website address, so a Facebook page won\'t work.',
     'The audit needs a website address, so a Facebook page won\'t work. No website yet? My team can help you make one: email <a href="mailto:support@bluefx.net">support@bluefx.net</a>.')
swap(', one of them a video you can make in your AI Media Machine.', '.')
swap(' Type your website at the top of this page. Your login is one click after that.</p>', ' Type your website at the top of this page.</p>')

# --- footer: no ClickBank lines (FastSpring sold this) ---
cut_between('<br>For Order Support, please contact ClickBank', 'HERE</a>.</p>', '</p>')
cut_between('<p>ClickBank is the retailer of products on this site.', '</p>')
cut_between('<script>\n  // ClickBank PitchPlus', '</script>')

s = re.sub(r'<!--[\s\S]*?-->\n?', '', s)  # the ClickBank page's build notes stay out of this copy
left = [w for w in ['AI Media Machine', 'ClickBank', 'clickbank', 'cbGo', 'login', 'Login', 'spartan-oto3', 'cb-oto3'] if w in s]
print('left over words (comments are fine):', {w: s.count(w) for w in left})
for w in left:
    for m in re.finditer(re.escape(w), s):
        ctx = s[max(0, m.start()-90):m.end()+40].replace('\n', ' ')
        print('  ', w, '|', ctx)

out = sys.argv[2]
header = '''/**
 * The Unlimited Video Ads thank-you page (owner 2026-10-25: "exactly" the last page of the ClickBank funnel,
 * bluefx.net/ai-coaching-call-cbup/, with the free AI search audit as the gift), made by src/scripts/build-welcome-page.py
 * from the live page. Slots: {{NAME}} (", Maria" or empty), {{SITE}}, {{EMAIL}}, {{FIRST_JS}} (a JSON string or null).
 * Change the wording only with the owner's yes.
 */
'''
open(out, 'w', encoding='utf-8').write(header + 'export const WELCOME_PAGE_HTML: string = ' + json.dumps(s) + ';\n')
print('wrote', out, len(s))
