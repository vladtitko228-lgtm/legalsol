#!/usr/bin/env python3
"""Выносит inline-JS главной в /assets/app-<hash>.js (defer).

Зачем: HTML wire ~500KB душил мобильный FCP; вынос ~800KB inline-JS
режет его вдвое и даёт кеш между визитами.

Остаются inline (критичны до/независимо от app.js):
  - ранний условный lng-init (гейт не-EN языков)
  - GTM-деферер (__gtmGo) и consent/dataLayer-стаб в head
  - клик-шим: ранние тапы (showTab и др.) в очередь до app.js
  - function _lsGtag (канал section_view в GA4)
  - IO-гидратор data-src/data-bg (rootMargin 900px)
  - шим ранних кликов (ставит вызовы в очередь до загрузки app.js)

Запуск: python3 scripts/extract_js.py   (из корня репо)
Идемпотентен: повторный запуск пересоберёт app-<hash>.js заново.
"""
import re, hashlib, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = os.path.join(ROOT, '_index.html')
h = open(P, encoding='utf-8').read()

# убрать старое подключение app-*.js (переизвлечение)
h = re.sub(r'<script defer src="/assets/app-[0-9a-f]{8}\.js"></script>', '', h)

KEEP_MARKS = [
    ("lng-init", "location.search"),   # ранний гейт
    ("__gtmGo",),                      # GTM-деферер
    ("function _lsGtag",),
    ('rootMargin:"900px"',),
    ("__earlyClickQ",),                # наш шим
]

def keep(body, start):
    if start < 12_000 and 'dataLayer' in body and '__gtmGo' not in body:
        return True                     # consent/стаб в самом верху head
    if 'lng-init' in body and 'location.search' in body and start < 5_000:
        return True                     # ранний гейт (ТОЛЬКО верхний; главный блок тоже матчит эти строки)
    return any(all(m in body for m in ms) for ms in KEEP_MARKS if ms != ("lng-init", "location.search"))

out, extracted, kept = [], [], 0
pos = 0
for m in re.finditer(r'<script([^>]*)>(.*?)</script>', h, re.S):
    attrs, body = m.group(1), m.group(2)
    if 'src=' in attrs or 'ld+json' in attrs or not body.strip():
        continue
    if keep(body, m.start()):
        kept += 1
        continue
    extracted.append((m.start(), m.end(), body))

for s, e, body in reversed(extracted):
    h = h[:s] + h[e:]

js = '\n'.join(
    'try{' + b.strip().rstrip(';') + ';}catch(e){console.error("[app.js] block ' + str(i) + ':",(e&&e.stack)||e)}'
    for i, (_, _, b) in enumerate(extracted)
) + '\n'
# try/catch имитирует изоляцию ошибок отдельных <script> (одна ошибка не убивает остальные);
# var/function из блоков остаются глобальными (Annex B hoisting), top-level let/const — нет (в бандле их нет)
# init главного блока: при inline он бежал при парсинге и опирался на хойстинг
# внутри СВОЕГО скрипта; в бандле try{}-обёртка меняет тайминг инициализации ниже
# объявленных словарей. Откладываем init-хвост на конец тика — все объявления готовы.
_init_old = 'setLang(_allLangs.indexOf(_sl)!==-1?_sl:"en");document.documentElement.classList.remove("lng-init");'
_init_new = 'setTimeout(function(){setLang(_allLangs.indexOf(_sl)!==-1?_sl:"en");document.documentElement.classList.remove("lng-init");},0);'
assert js.count(_init_old) == 1, f"init anchor x{js.count(_init_old)}"
js = js.replace(_init_old, _init_new)

tag = hashlib.md5(js.encode()).hexdigest()[:8]
os.makedirs(os.path.join(ROOT, 'assets'), exist_ok=True)
for old in os.listdir(os.path.join(ROOT, 'assets')):
    if re.match(r'app-[0-9a-f]{8}\.js$', old):
        os.remove(os.path.join(ROOT, 'assets', old))
open(os.path.join(ROOT, 'assets', f'app-{tag}.js'), 'w', encoding='utf-8').write(js)

SHIM = ('<script>(function(){var q=[];window.__earlyClickQ=q;'
        '["showTab","pickLang","openModal","closeMobNav","toggleFaq","showSvc","hleadSvcSelect",'
        '"cGo","jcGo","csSelect","cabPage","cabToast"].forEach(function(n){'
        'if(!window[n]){var f=function(){q.push([n,arguments])};f.__stub=1;window[n]=f}});'
        'document.addEventListener("DOMContentLoaded",function(){setTimeout(function(){'
        'q.forEach(function(c){try{var f=window[c[0]];if(typeof f==="function"&&!f.__stub)'
        'f.apply(null,c[1])}catch(e){}})},0)})})();</script>')

app = f'<script defer src="/assets/app-{tag}.js"></script>'
i = h.find('</head>')
h = h[:i] + SHIM + app + h[i:]
open(P, 'w', encoding='utf-8').write(h)
print(f'извлечено блоков: {len(extracted)} ({len(js)//1024}KB) -> assets/app-{tag}.js')
print(f'оставлено inline: {kept}; HTML теперь {len(h)//1024}KB')
