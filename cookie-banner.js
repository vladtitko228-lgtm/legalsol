/* Legal Solutions — Cookie Banner (RODO/GDPR)
   Animated banner with Karta Pobytu illustration.
   Used on: homepage, /blog, /blog/<slug>, /privacy, /terms.
*/
(function(){
  // Не показывать если уже принято
  var STORAGE_KEY = 'ls_cookie_v1';
  if (localStorage.getItem(STORAGE_KEY)) return;

  // Inject CSS
  var style = document.createElement('style');
  style.id = 'ls-cookie-banner-styles';
  style.textContent = '#ls-cb { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); z-index: 99998; width: min(1100px, calc(100vw - 32px)); border-radius: 28px; display: grid; grid-template-columns: 240px 1fr auto; gap: 28px; align-items: center; padding: 22px 28px 22px 22px; box-shadow: 0 24px 60px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3); background: linear-gradient(135deg, rgba(45,40,105,0.97) 0%, rgba(30,27,75,0.99) 100%); color: #fff; border: 1px solid rgba(139,130,232,0.2); -webkit-backdrop-filter: blur(20px); backdrop-filter: blur(20px); font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", "Segoe UI", sans-serif; opacity: 0; transition: opacity 0.4s ease, transform 0.4s ease; pointer-events: none; }'
  + '#ls-cb.ls-cb-show { opacity: 1; pointer-events: auto; transform: translateX(-50%) translateY(0); }'
  + '#ls-cb.ls-cb-hide { opacity: 0; transform: translateX(-50%) translateY(20px); pointer-events: none; }'
  + '#ls-cb * { box-sizing: border-box; }'
  + '.ls-cb-content { display: flex; flex-direction: column; gap: 10px; }'
  + '.ls-cb-pill { display: inline-flex; align-items: center; gap: 10px; padding: 10px 18px; border-radius: 999px; background: rgba(139,130,232,0.12); border: 1px solid rgba(139,130,232,0.3); font-weight: 600; font-size: 16px; width: fit-content; color: #fff; }'
  + '.ls-cb-pill-ic { width: 28px; height: 28px; border-radius: 999px; background: #7C5CFC; display: inline-flex; align-items: center; justify-content: center; color: #fff; flex-shrink: 0; }'
  + '.ls-cb-pill-ic svg { width: 16px; height: 16px; }'
  + '.ls-cb-text { font-size: 14px; line-height: 1.6; color: rgba(255,255,255,0.78); max-width: 640px; margin: 0; }'
  + '.ls-cb-link { font-size: 14px; font-weight: 500; text-decoration: underline; text-underline-offset: 4px; display: inline-flex; align-items: center; gap: 6px; width: fit-content; color: #B8B0FF; cursor: pointer; background: none; border: none; padding: 0; font-family: inherit; }'
  + '.ls-cb-link svg { width: 16px; height: 16px; }'
  + '.ls-cb-btn { padding: 16px 38px; border: none; border-radius: 16px; font-size: 16px; font-weight: 600; cursor: pointer; transition: transform 0.15s ease, box-shadow 0.15s ease; flex-shrink: 0; background: linear-gradient(135deg, #5B52CC 0%, #7C5CFC 100%); color: #fff; box-shadow: 0 8px 20px rgba(91,82,204,0.45); font-family: inherit; }'
  + '.ls-cb-btn:hover { transform: translateY(-2px); box-shadow: 0 12px 30px rgba(91,82,204,0.6); }'
  + '.ls-cb-btn:active { transform: translateY(0); }'
  + '.ls-cb-stage { width: 240px; height: 170px; border-radius: 20px; background: radial-gradient(circle at 30% 30%, rgba(124,92,252,0.2), transparent 60%), linear-gradient(135deg, rgba(20,16,55,0.8) 0%, rgba(45,40,105,0.4) 100%); border: 1px solid rgba(139,130,232,0.18); position: relative; overflow: hidden; flex-shrink: 0; }'
  + '.ls-cb-karta { position: absolute; width: 130px; height: 84px; border-radius: 9px; left: 28px; top: 32px; background: linear-gradient(135deg, #3D3585 0%, #5B52CC 60%, #7C5CFC 100%); box-shadow: 0 12px 24px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -1px 0 rgba(0,0,0,0.3); border: 1px solid rgba(139,130,232,0.4); padding: 8px 9px; transform: rotate(-6deg); animation: lsCbKarta 4s ease-in-out infinite; z-index: 2; }'
  + '@keyframes lsCbKarta { 0%, 100% { transform: rotate(-6deg) translateY(0); } 50% { transform: rotate(-4deg) translateY(-4px); } }'
  + '.ls-cb-karta-h { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }'
  + '.ls-cb-flag { width: 16px; height: 11px; border-radius: 2px; background: linear-gradient(to bottom, #fff 50%, #DC143C 50%); box-shadow: 0 1px 2px rgba(0,0,0,0.3); }'
  + '.ls-cb-eu { font-size: 6px; font-weight: 700; color: rgba(255,255,255,0.7); letter-spacing: 0.5px; }'
  + '.ls-cb-portrait { width: 26px; height: 32px; border-radius: 4px; background: linear-gradient(135deg, rgba(255,255,255,0.18), rgba(255,255,255,0.05)); border: 1px solid rgba(255,255,255,0.2); display: flex; flex-direction: column; align-items: center; justify-content: flex-end; padding: 2px; position: absolute; top: 24px; left: 9px; }'
  + '.ls-cb-portrait::before { content: ""; width: 11px; height: 11px; border-radius: 999px; background: rgba(255,255,255,0.4); margin-bottom: 1px; }'
  + '.ls-cb-portrait::after { content: ""; width: 18px; height: 9px; border-radius: 9px 9px 0 0; background: rgba(255,255,255,0.4); }'
  + '.ls-cb-lines { position: absolute; left: 42px; top: 26px; display: flex; flex-direction: column; gap: 3px; width: 80px; }'
  + '.ls-cb-line { height: 3px; border-radius: 2px; background: rgba(255,255,255,0.5); }'
  + '.ls-cb-line-shimmer { background: linear-gradient(90deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.7) 50%, rgba(255,255,255,0.3) 100%); background-size: 200% 100%; animation: lsCbShimmer 2s ease-in-out infinite; }'
  + '@keyframes lsCbShimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }'
  + '.ls-cb-line:nth-child(1) { width: 100%; } .ls-cb-line:nth-child(2) { width: 75%; } .ls-cb-line:nth-child(3) { width: 60%; }'
  + '.ls-cb-chip { position: absolute; bottom: 10px; left: 12px; width: 14px; height: 11px; border-radius: 2px; background: linear-gradient(135deg, #FFD700 0%, #DAA520 100%); box-shadow: inset 0 1px 0 rgba(255,255,255,0.3); }'
  + '.ls-cb-chip::before { content: ""; position: absolute; inset: 2px; background-image: linear-gradient(0deg, transparent 45%, rgba(0,0,0,0.2) 45%, rgba(0,0,0,0.2) 55%, transparent 55%), linear-gradient(90deg, transparent 45%, rgba(0,0,0,0.2) 45%, rgba(0,0,0,0.2) 55%, transparent 55%); }'
  + '.ls-cb-doc { position: absolute; width: 70px; height: 88px; border-radius: 7px; background: linear-gradient(145deg, rgba(61,53,133,0.7), rgba(30,27,75,0.6)); border: 1px solid rgba(139,130,232,0.3); padding: 7px 6px; display: flex; flex-direction: column; gap: 3px; box-shadow: 0 6px 18px rgba(0,0,0,0.4); }'
  + '.ls-cb-doc::after { content: ""; position: absolute; top: 0; right: 0; width: 11px; height: 11px; background: linear-gradient(225deg, rgba(139,130,232,0.4) 50%, transparent 50%); border-radius: 0 7px 0 0; }'
  + '.ls-cb-dl { height: 2px; border-radius: 2px; background: rgba(139,130,232,0.4); }'
  + '.ls-cb-dl:nth-child(1) { width: 100%; } .ls-cb-dl:nth-child(2) { width: 70%; } .ls-cb-dl:nth-child(3) { width: 85%; } .ls-cb-dl:nth-child(4) { width: 55%; } .ls-cb-dl:nth-child(5) { width: 75%; background: rgba(91,82,204,0.5); } .ls-cb-dl:nth-child(6) { width: 40%; }'
  + '.ls-cb-doc-1 { right: 24px; top: 18px; transform: rotate(8deg); animation: lsCbD1 5s ease-in-out infinite; z-index: 1; }'
  + '.ls-cb-doc-2 { right: 36px; top: 38px; transform: rotate(-3deg); opacity: 0.55; animation: lsCbD2 6s ease-in-out infinite; z-index: 0; }'
  + '@keyframes lsCbD1 { 0%, 100% { transform: rotate(8deg) translateY(0); } 50% { transform: rotate(10deg) translateY(-3px); } }'
  + '@keyframes lsCbD2 { 0%, 100% { transform: rotate(-3deg) translateY(0); } 50% { transform: rotate(-5deg) translateY(3px); } }'
  + '.ls-cb-stamp { position: absolute; right: 14px; top: 70px; width: 56px; height: 56px; border-radius: 999px; border: 3px solid #FF6B35; color: #FF6B35; display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: 800; font-size: 8px; line-height: 1.1; text-transform: uppercase; letter-spacing: 0.5px; transform: rotate(-12deg) scale(0); opacity: 0; animation: lsCbStamp 4s ease-in-out infinite; z-index: 3; background: rgba(15,13,34,0.4); -webkit-backdrop-filter: blur(2px); backdrop-filter: blur(2px); box-shadow: 0 0 0 2px rgba(255,107,53,0.15), 0 4px 12px rgba(255,107,53,0.4); }'
  + '.ls-cb-stamp::before { content: "\\2713"; font-size: 22px; line-height: 1; margin-bottom: 1px; }'
  + '.ls-cb-stamp::after { content: "APPROVED"; }'
  + '@keyframes lsCbStamp { 0% { transform: rotate(-12deg) scale(2); opacity: 0; } 20% { transform: rotate(-12deg) scale(1.1); opacity: 1; } 25% { transform: rotate(-12deg) scale(1); opacity: 1; } 75% { transform: rotate(-12deg) scale(1); opacity: 1; } 90% { transform: rotate(-12deg) scale(1); opacity: 0.8; } 100% { transform: rotate(-12deg) scale(2); opacity: 0; } }'
  + '.ls-cb-particle { position: absolute; width: 4px; height: 4px; border-radius: 999px; background: rgba(139,130,232,0.5); box-shadow: 0 0 8px rgba(139,130,232,0.6); animation: lsCbFloat 6s linear infinite; }'
  + '@keyframes lsCbFloat { 0% { transform: translateY(180px); opacity: 0; } 20% { opacity: 1; } 80% { opacity: 1; } 100% { transform: translateY(-20px); opacity: 0; } }'
  + '.ls-cb-p1 { left: 15%; animation-delay: 0s; }'
  + '.ls-cb-p2 { left: 45%; animation-delay: 1.5s; }'
  + '.ls-cb-p3 { left: 75%; animation-delay: 3s; background: rgba(255,107,53,0.5); box-shadow: 0 0 8px rgba(255,107,53,0.6); }'
  + '.ls-cb-p4 { left: 90%; animation-delay: 4.5s; }'
  + '@media (max-width: 800px) { #ls-cb { grid-template-columns: 1fr; padding: 18px; gap: 18px; bottom: 12px; width: calc(100vw - 24px); } .ls-cb-stage { width: 100%; height: 130px; } .ls-cb-btn { width: 100%; padding: 14px; } .ls-cb-text { font-size: 13px; } }'
  + 'body.ls-cb-active #cc-main .cm, body.ls-cb-active #cm, body.ls-cb-active .cc--anim { display: none !important; }';
  document.head.appendChild(style);

  // Translations
  var L = {
    ru: { title: 'Политика использования файлов cookie', desc: 'Мы используем cookie, чтобы сайт работал стабильно, запоминал ваши предпочтения и помогал нам улучшать пользовательский опыт без лишнего шума.', policy: 'Открыть политику cookie', accept: 'Принять' },
    en: { title: 'Cookie usage policy', desc: 'We use cookies to keep the site stable, remember your preferences, and help us improve the user experience without unnecessary noise.', policy: 'Open cookie policy', accept: 'Accept' },
    pl: { title: 'Polityka plików cookie', desc: 'Używamy plików cookie, aby strona działała stabilnie, zapamiętywała Twoje preferencje i pomagała nam ulepszać doświadczenie użytkownika.', policy: 'Otwórz politykę cookie', accept: 'Akceptuj' },
    uk: { title: 'Політика файлів cookie', desc: 'Ми використовуємо cookie, щоб сайт працював стабільно, запам\'ятовував ваші уподобання й допомагав нам покращувати користувацький досвід.', policy: 'Відкрити політику cookie', accept: 'Прийняти' },
    es: { title: 'Política de cookies', desc: 'Usamos cookies para que el sitio funcione de forma estable, recuerde sus preferencias y nos ayude a mejorar la experiencia del usuario.', policy: 'Abrir política de cookies', accept: 'Aceptar' },
    tr: { title: 'Çerez kullanım politikası', desc: 'Sitenin stabil çalışması, tercihlerinizi hatırlaması ve kullanıcı deneyimini iyileştirmemiz için çerezler kullanıyoruz.', policy: 'Çerez politikasını aç', accept: 'Kabul et' },
    az: { title: 'Çərəz istifadə siyasəti', desc: 'Saytın sabit işləməsi, tərcihlərinizi yadda saxlaması və istifadəçi təcrübəsini yaxşılaşdırmaq üçün çərəzlərdən istifadə edirik.', policy: 'Çərəz siyasətini aç', accept: 'Qəbul et' },
    hi: { title: 'कुकी उपयोग नीति', desc: 'हम कुकीज़ का उपयोग करते हैं ताकि साइट स्थिर रूप से काम करे, आपकी प्राथमिकताएँ याद रखे और उपयोगकर्ता अनुभव को बेहतर बनाने में मदद करे।', policy: 'कुकी नीति खोलें', accept: 'स्वीकार करें' }
  };
  var lang = (document.documentElement.lang || 'ru').toLowerCase().slice(0,2);
  if (lang === 'ua') lang = 'uk';
  var t = L[lang] || L.en;

  // Inject HTML
  var html = '<div id="ls-cb" role="dialog" aria-labelledby="ls-cb-title" aria-describedby="ls-cb-desc">'
    + '<div class="ls-cb-stage" aria-hidden="true">'
    + '<div class="ls-cb-particle ls-cb-p1"></div>'
    + '<div class="ls-cb-particle ls-cb-p2"></div>'
    + '<div class="ls-cb-particle ls-cb-p3"></div>'
    + '<div class="ls-cb-particle ls-cb-p4"></div>'
    + '<div class="ls-cb-doc ls-cb-doc-2"><div class="ls-cb-dl"></div><div class="ls-cb-dl"></div><div class="ls-cb-dl"></div><div class="ls-cb-dl"></div><div class="ls-cb-dl"></div><div class="ls-cb-dl"></div></div>'
    + '<div class="ls-cb-doc ls-cb-doc-1"><div class="ls-cb-dl"></div><div class="ls-cb-dl"></div><div class="ls-cb-dl"></div><div class="ls-cb-dl"></div><div class="ls-cb-dl"></div><div class="ls-cb-dl"></div></div>'
    + '<div class="ls-cb-karta">'
    + '<div class="ls-cb-karta-h"><div class="ls-cb-flag"></div><div class="ls-cb-eu">EU</div></div>'
    + '<div class="ls-cb-portrait"></div>'
    + '<div class="ls-cb-lines"><div class="ls-cb-line"></div><div class="ls-cb-line ls-cb-line-shimmer"></div><div class="ls-cb-line"></div></div>'
    + '<div class="ls-cb-chip"></div>'
    + '</div>'
    + '<div class="ls-cb-stamp"></div>'
    + '</div>'
    + '<div class="ls-cb-content">'
    + '<div class="ls-cb-pill">'
    + '<span class="ls-cb-pill-ic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.6 11.4c-.4 0-.8-.1-1.1-.3-1.1-.6-1.5-2-.9-3.1.2-.3.4-.6.6-.8-1.6-1.2-3.5-1.9-5.5-2-.4 1.1-1.5 1.9-2.7 1.9-1.5 0-2.7-1.1-2.9-2.6-1 .3-2 .8-2.9 1.4-1 .7-1.7 1.6-2.3 2.6.4.2.7.5 1 .8.7 1 .5 2.4-.5 3.1-.6.4-1.4.5-2.1.2 0 .2 0 .5 0 .7 0 5.5 4.5 10 10 10s10-4.5 10-10c0-.8-.1-1.4-.3-2.1l-.4.2zM7 14c-.6 0-1-.4-1-1s.4-1 1-1 1 .4 1 1-.4 1-1 1zm3 4c-.6 0-1-.4-1-1s.4-1 1-1 1 .4 1 1-.4 1-1 1zm5-3c-.6 0-1-.4-1-1s.4-1 1-1 1 .4 1 1-.4 1-1 1zm.5-5.5c-.8 0-1.5-.7-1.5-1.5s.7-1.5 1.5-1.5 1.5.7 1.5 1.5-.7 1.5-1.5 1.5z"/></svg></span>'
    + '<span id="ls-cb-title">' + t.title + '</span>'
    + '</div>'
    + '<p class="ls-cb-text" id="ls-cb-desc">' + t.desc + '</p>'
    + '<button class="ls-cb-link" id="ls-cb-policy"><span>' + t.policy + '</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg></button>'
    + '</div>'
    + '<button class="ls-cb-btn" id="ls-cb-accept">' + t.accept + '</button>'
    + '</div>';

  function mount(){
    if (document.getElementById('ls-cb')) return; // уже смонтирован
    var div = document.createElement('div');
    div.innerHTML = html;
    document.body.appendChild(div.firstChild);
    document.body.classList.add('ls-cb-active');
    var el = document.getElementById('ls-cb');
    setTimeout(function(){ el.classList.add('ls-cb-show'); }, 400);

    document.getElementById('ls-cb-accept').addEventListener('click', function(){
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ accepted: true, ts: Date.now(), v: 1 })); } catch(e){}
      el.classList.add('ls-cb-hide');
      document.body.classList.remove('ls-cb-active');
      // Загрузить Microsoft Clarity после accept
      try { if (typeof loadClarity === 'function') loadClarity(); } catch(e){}
      setTimeout(function(){ el.remove(); }, 400);
    });
    document.getElementById('ls-cb-policy').addEventListener('click', function(){
      window.location.href = '/privacy#cookies';
    });
  }

  if (document.body) {
    mount();
  } else {
    document.addEventListener('DOMContentLoaded', mount);
  }
})();

/* Microsoft Clarity loader (вызывается после accept) */
function loadClarity(){
  if(window._clarityLoaded)return;
  window._clarityLoaded=true;
  (function(c,l,a,r,i,t,y){
    c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
    t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
    y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
  })(window,document,"clarity","script","wispohj28j");
}

/* Глобально доступная функция — открыть настройки/политику */
function openCookieSettings(){ window.location.href = '/privacy#cookies'; }

/* Если пользователь уже принял — сразу загрузить Clarity */
try {
  var _saved = localStorage.getItem('ls_cookie_v1');
  if (_saved) loadClarity();
} catch(e){}
