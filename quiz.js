/* LegalSol — Legalization path quiz (floating popup, all pages).
   Self-contained: injects FAB + modal, runs a 9-step diagnostic,
   produces a per-case expert analysis, and captures the lead via
   window._sendLead (falls back to a direct Apps Script POST).
   Language follows document.documentElement.lang; EN is the fallback. */
(function(){
  if(window.__lsQuizInit) return; window.__lsQuizInit=true;

  var WA='48735248525';
  var LEAD_URL='https://script.google.com/macros/s/AKfycbyZG4vGv31lRp15e7shZKESBZijliKIv5OKPi5zs9A4wSxouNU0osVFT6FQHt4SXPgrYQ/exec';

  /* ---- icons (inline SVG, feather-style; no icon font on site) ---- */
  var P={
    compass:'<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>',
    x:'<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    check:'<polyline points="20 6 9 17 4 12"/>',
    arrowL:'<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
    arrowR:'<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
    refresh:'<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>',
    alert:'<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    clock:'<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    file:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
    nav:'<polygon points="3 11 22 2 13 21 11 13 3 11"/>',
    lock:'<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    award:'<circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>',
    shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>',
    checkc:'<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
    chat:'<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
    bolt:'<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    users:'<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'
  };
  function ic(n,sz){return '<svg viewBox="0 0 24 24" width="'+(sz||20)+'" height="'+(sz||20)+'" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+P[n]+'</svg>';}
  /* exact site brand mark */
  var LOGO='<svg class="lsq-mark" width="26" height="24" viewBox="0 0 34 32" aria-hidden="true"><rect x="0" y="9" width="7" height="20" rx="2" fill="#8B82E8"/><rect x="9" y="4" width="7" height="25" rx="2" fill="#B8B2F5"/><rect x="18" y="4" width="7" height="25" rx="2" fill="#B8B2F5"/><rect x="27" y="9" width="7" height="20" rx="2" fill="#8B82E8"/><rect x="0" y="5" width="34" height="4" rx="2" fill="#5B52CC"/><rect x="0" y="29" width="34" height="3" rx="1.5" fill="#5B52CC"/></svg>';

  /* ---- question structure (stable values; labels come from TXT) ---- */
  var QSDEF=[
    {id:'goal',opts:['kp','pmzh','citizen','bluecard','work','biz','protection','idk']},
    {id:'cit',grid:true,opts:['Индия','Пакистан','Шри-Ланка','Бангладеш','Филиппины','Нигерия','Азербайджан','Турция','Другая']},
    {id:'now',opts:['legal','expiring','expired','abroad']},
    {id:'basis',opts:['work','study','biz','family','visa','polak','idk']},
    {id:'expiry',hint:true,opts:['fire','soon','ok','na']},
    {id:'profil',hint:true,opts:['yes','no','idk']},
    {id:'dur',opts:['lt1','1_3','3_5','5plus','soon']},
    {id:'family',opts:['solo','partner','kids']},
    {id:'ref',opts:['no','pending','refusal']}
  ];

  var TXT={
   en:{
    fab:'Check your case', dialog:'Legalization path quiz', back:'Back', restart:'Start over', close:'Close',
    stepFmt:function(a,b){return 'Step '+a+' of '+b;}, almost:'almost done', done:'done',
    contactH:'Preparing your analysis', contactS:'Leave your contact — we will send a personal analysis and plan. Or message us on WhatsApp right away; your answers are already collected.',
    name:'Your name', phone:'Phone / WhatsApp', submit:'Show my analysis', or:'or', waPre:'Straight to WhatsApp with all answers',
    resultH:'Analysis of your situation', accepted:'Request received — we reply on WhatsApp within 15 minutes',
    secCritical:'Urgent now', secTiming:'Time-sensitive', secLaw:'Where you stand legally', secPath:'Your path', secSteps:'What we will do', secWhy:'Why LegalSol',
    recommended:'Recommended for you', tFree:'Free', tReply:'15-min reply', tNoSpam:'No spam', bApproval:'approval rate', bClients:'clients', bAppeal:'appeal for clients', bFree:'Free',
    waResultUrgent:'Urgently to a lawyer on WhatsApp', waResult:'Discuss the analysis on WhatsApp', yourCountry:'your country',
    q:{goal:'What do you need?',cit:'Your citizenship?',now:'Are you in Poland now?',basis:'On what basis do you stay?',expiry:'When does your current status expire?',profil:'Do you have a Profil Zaufany?',dur:'How long have you been in Poland?',family:'Are you moving with family?',ref:'Have you applied before?'},
    s:{goal:'Your main goal — we will find the exact path',cit:'Your country determines documents and apostilles',basis:'What backs your status',expiry:'From 27.04.2026 filing is online via MOS only — timing is critical',profil:'A trusted e-signature. Without it you cannot file online — it is the first step',dur:'Time of residence affects the path to PR and citizenship',family:'We file for everyone together — one package, one timeline'},
    hint:{expiry:'Key urgency question',profil:'Blocking step for MOS'},
    opt:{
      goal:{kp:'Residence card (TRC)',pmzh:'Permanent residence / EU resident',citizen:'Polish citizenship',bluecard:'Blue Card (IT / high salary)',work:'Job + legalization',biz:'Business / company (Sp. z o.o.)',protection:'International protection',idk:'Not sure — I need advice'},
      cit:{'Индия':'India','Пакистан':'Pakistan','Шри-Ланка':'Sri Lanka','Бангладеш':'Bangladesh','Филиппины':'Philippines','Нигерия':'Nigeria','Азербайджан':'Azerbaijan','Турция':'Turkey','Другая':'Other country'},
      now:{legal:'Yes, my status is fine',expiring:'Yes, but my visa/card expires soon',expired:'Yes, but my status already expired',abroad:'Not yet — planning to move'},
      basis:{work:'Employment',study:'Studies',biz:'Business / sole trader',family:'Family / marriage',visa:'D / Schengen visa',polak:'Karta Polaka',idk:'Not decided yet'},
      expiry:{fire:'Less than 30 days',soon:'1–3 months',ok:'More than 3 months',na:'Still abroad / not sure'},
      profil:{yes:'Yes, I have it',no:'No',idk:'I do not know what it is'},
      dur:{lt1:'Less than 1 year','1_3':'1–3 years','3_5':'3–5 years','5plus':'5+ years',soon:'Not arrived yet'},
      family:{solo:'Just me',partner:'With spouse',kids:'With family and children'},
      ref:{no:'No, first time',pending:'Filed, awaiting decision',refusal:'Got a refusal — need an appeal'}
    },
    goalB:{
      pmzh_polak:{svc:'PR via Karta Polaka',time:'decision 4–8 mo',diag:'You hold a Karta Polaka — a special case: permanent residence is available with NO required period of stay. Most people wait 5 years; you can apply right away. It is an unlimited status and a direct step to citizenship.',gives:'Confirming the basis, preparing the package and filing for unlimited status.'},
      pmzh_5plus:{svc:'Permanent residence (EU resident)',time:'decision 4–8 mo',diag:'With 5+ years you already meet the core requirement for PR: 5 years of continuous residence. It is an unlimited status, work without permits and a step toward citizenship. It is critical to check the continuity of your stay (long trips abroad can reset it) and to confirm income for the last 3 years and language knowledge.',gives:'Auditing continuity of stay, gathering 5-year proof and filing for unlimited status.'},
      pmzh_3_5:{svc:'TRC now → PR soon',time:'PR at 5 years',diag:'PR requires 5 years of continuous residence — you are almost there. The key now is not to break the count: renew your card on time so that at year five you file for PR without resetting the period. A single overstay can throw you back by years.',gives:'A gap-free renewal strategy and preparation for PR by the right date.'},
      pmzh_other:{svc:'Karta Pobytu → course to PR',time:'card 1–3 years',diag:'PR requires 5 years of continuous residence — it is early for you, but the path starts now. The main thing is to keep your cards without a single gap, otherwise the 5-year count resets. We will build the trajectory so every year works toward your PR.',gives:'A residence card now and a renewal plan leading to PR without losing the count.'},
      citizen_brak:{svc:'Citizenship via marriage',time:'decision 6–24 mo',diag:'Marriage to a Polish citizen is the shortest path: 3 years of marriage and 2 years of residence on a TRC/PR, plus Polish at B1, are enough. That is far faster than the general 10 years. We will check whether you already qualify.',gives:'Checking the marriage basis, the language question and filing for the passport.'},
      citizen_other:{svc:'Path to citizenship',time:'decision 6–24 mo',diag:'Citizenship means 10 years of continuous residence, the last 3 on PR / long-term resident status, plus Polish at B1. If that is far off, no problem: a correct trajectory through a TRC and PR without gaps reliably leads to the passport. The main mistake is losing years to overstays.',gives:'Assessing your basis, the shortest route and support up to the oath.'},
      bluecard:{svc:'Blue Card (EU)',time:'decision 3–6 mo',diag:'The Blue Card is for specialists with a degree (or 5+ years of experience) and a salary from 1.5× the Polish average. The big advantage: the right to PR in just 2 years instead of 5, and EU mobility after 18 months. Your family gets cards together with you immediately.',gives:'Checking eligibility (degree/experience/salary) and filing for the fast track.'},
      biz:{svc:'Company + card on its basis',time:'Sp. z o.o. ~2 weeks',diag:'We open a Sp. z o.o. or a sole proprietorship (JDG) and obtain a residence card on the basis of the business. You get legal status, your own company and the same path to PR. A Sp. z o.o. is registered in about 2 weeks; then accounting and the card application.',gives:'Company registration, bank, accounting and a residence card on the business basis.'},
      work:{svc:'Job + Karta Pobytu',time:'card 3–6 mo',diag:'The best strategy is to arrange the job and the legalization in parallel, so there is not a single day outside the law. We file for the card based on employment; filing before your visa expires gets you a stamp and the right to work for the whole waiting period. The card is issued for 1–3 years.',gives:'Finding or arranging a job with a partner and filing for the card on that basis.'},
      protection:{svc:'International protection',time:'individual',diag:'International protection covers refugee status, a humanitarian visa or protection from expulsion. Everything here is confidential and often urgent: with a risk of deportation, every day counts. We review the grounds privately, one to one with a lawyer.',gives:'A confidential review of the grounds and support through the protection procedure.'},
      idk:{svc:'Free consultation',time:'15 minutes',diag:'Your answers already point to several workable paths — and that is normal, most people do not know their exact category under Polish law. A 15-minute review with a lawyer will pin down the best option for your exact situation, length of stay and deadlines — no guessing.',gives:'Precise diagnosis of your category and a step-by-step plan for your situation.'},
      kp_default:{svc:'Karta Pobytu (TRC)',time:'decision 3–6 mo',diag:'A residence card is your basic legal status: work, public health insurance (NFZ), a bank account, free Schengen travel (90/180). The key point: file the application BEFORE your current status expires — a stamp goes in your passport and you stay legal and allowed to work for the whole 3–6 month wait, even if the old card ends.',gives:'Choosing the basis, gathering documents and filing for the card via MOS.'}
    },
    refusalB:{svc:'Appeal a refusal',time:'appeal deadline is limited',diag:'A refusal is almost never flawless — the office decision often contains procedural or factual errors that become grounds for reversal. But the deadline to appeal is strictly limited (usually 14 days from receiving the decision). Miss it and the refusal becomes final, possibly affecting your further stay.',gives:'A lawyer re-examines the case, finds grounds for reversal and files the appeal on time. For our clients the appeal is free.'},
    pendingB:{time:'case already under review',diag:'You have already filed and are awaiting a decision — if you filed before your previous status expired, your stay during the review is legal. The real risk is elsewhere: the office almost always sends a request to supply more documents (uzupełnienie) with a strict deadline. Missing it means an automatic refusal. Many people lose the case exactly here.',gives:'An audit of your case, monitoring office requests and answering them on time, plus a possible speed-up. We join even an already-filed application.'},
    famAdd:' We file for the whole family in one package and one timeline — no status mismatch.',
    urg:{
      expired:{h:'Your status has expired — act today',t:'Your stay is now illegal. This is a direct risk of a return (exit) decision and a Schengen entry ban for several years. The window to legalize may still be open, but it closes every day — the sooner we start, the more working options remain.'},
      fire:{h:'Less than 30 days — critical deadline',t:'The application must be filed BEFORE your status expires. Make it in time and a stamp goes in your passport — you stay fully legal and allowed to work for the 3–6 months while the decision is processed. Miss it by even a day and that option is gone, and your stay becomes illegal. There is no time to lose.'},
      soon:{h:'1–3 months — time to start',t:'From 27.04.2026 filing is online via MOS only, and gathering documents, translations and a Profil Zaufany takes time. Start now and we file with a margin, calmly, not in the final days.'},
      appeal:{h:'The appeal clock is ticking right now',t:'You usually have only 14 days from receiving the refusal to appeal. Every day of delay reduces the chances. The decision needs to reach a lawyer immediately.'}
    },
    noteProfil:'Without a Profil Zaufany you physically cannot file via MOS, and from 27.04.2026 that is the only way to file. It is the first step — set up in 1–2 days, and we do it together with you.',
    noteCountry:'Documents from %C (police clearance, marriage/birth certificates) are accepted only with an apostille and a sworn translation into Polish. This is the most common cause of weeks-long delays. We know the requirements for %C and assemble the package right the first time.',
    step:{profil:'Set up a Profil Zaufany — filing online is impossible without it (1–2 days)',consult:'Free consultation: a lawyer reviews your case and locks in the strategy',appeal:'We analyze the decision, find grounds and file the appeal on time',pending:'We take over your case and answer the office requests on time',docs:'We gather and check documents (AI + lawyer), translations and apostilles',submitNormal:'We file online via MOS and see it through to the card in hand',submitUrgent:'We file online via MOS urgently, before your status expires'},
    conf:{normal:'98% approvals · appeal free for clients',appeal:'76% of appeals won'},
    why:'We specialize in filing through the new MOS system — where most get stuck during the transition. We guide you from the first document to the card in hand, in your language, and reply on WhatsApp within 15 minutes.',
    wa:{intro:'Hello! I took the quiz on the LegalSol site. My situation:',lbl:{goal:'Need',cit:'Citizenship',now:'Status now',basis:'Basis',expiry:'Expires',profil:'Profil Zaufany',dur:'In Poland',family:'Family',ref:'Applied before'},name:'Name',tail:'I want the analysis and a free consultation.'}
   },
   ru:{
    fab:'Проверить свой случай', dialog:'Квиз по легализации', back:'Назад', restart:'Пройти заново', close:'Закрыть',
    stepFmt:function(a,b){return 'Шаг '+a+' из '+b;}, almost:'почти готово', done:'готово',
    contactH:'Готовим ваш разбор', contactS:'Оставьте контакт — пришлём персональный разбор и план. Или сразу напишите в WhatsApp, мы уже собрали ваши ответы.',
    name:'Ваше имя', phone:'Телефон / WhatsApp', submit:'Показать мой разбор', or:'или', waPre:'Сразу в WhatsApp со всеми ответами',
    resultH:'Разбор вашей ситуации', accepted:'Заявка принята — ответим в WhatsApp за 15 минут',
    secCritical:'Критично сейчас', secTiming:'Важно по срокам', secLaw:'Что у вас по закону', secPath:'Ваш путь', secSteps:'Что мы сделаем', secWhy:'Почему LegalSol',
    recommended:'Рекомендуем вам', tFree:'Бесплатно', tReply:'Ответ 15 мин', tNoSpam:'Без спама', bApproval:'одобрений', bClients:'клиентов', bAppeal:'апелляция клиентам', bFree:'Беспл.',
    waResultUrgent:'Срочно к юристу в WhatsApp', waResult:'Обсудить разбор в WhatsApp', yourCountry:'вашей страны',
    q:{goal:'Что вам нужно?',cit:'Ваше гражданство?',now:'Вы сейчас в Польше?',basis:'На каком основании пребывание?',expiry:'Когда истекает текущий статус?',profil:'Есть Profil Zaufany?',dur:'Как долго вы в Польше?',family:'Переезжаете с семьёй?',ref:'Подавали заявление раньше?'},
    s:{goal:'Главная цель — подберём точный путь',cit:'От страны зависит набор документов и апостили',basis:'Чем подтверждается ваш статус',expiry:'С 27.04.2026 подача только онлайн через MOS — сроки критичны',profil:'Электронная подпись. Без неё подать онлайн нельзя — это первый шаг',dur:'Стаж влияет на путь к ПМЖ и гражданству',family:'Соберём заявки всех вместе — одним пакетом, в один срок'},
    hint:{expiry:'Главный вопрос срочности',profil:'Блокирующий шаг для MOS'},
    opt:{
      goal:{kp:'Карта побыту (ВНЖ)',pmzh:'ПМЖ / резидент ЕС',citizen:'Гражданство Польши',bluecard:'Blue Card (IT / высокая ЗП)',work:'Работа + легализация',biz:'Бизнес / фирма (Sp. z o.o.)',protection:'Международная защита',idk:'Не знаю — нужна консультация'},
      cit:{'Индия':'Индия','Пакистан':'Пакистан','Шри-Ланка':'Шри-Ланка','Бангладеш':'Бангладеш','Филиппины':'Филиппины','Нигерия':'Нигерия','Азербайджан':'Азербайджан','Турция':'Турция','Другая':'Другая страна'},
      now:{legal:'Да, статус в порядке',expiring:'Да, но виза/карта скоро кончается',expired:'Да, но статус уже истёк',abroad:'Ещё нет — планирую переезд'},
      basis:{work:'Работа',study:'Учёба',biz:'Бизнес / JDG',family:'Семья / брак',visa:'Виза D / Шенген',polak:'Karta Polaka',idk:'Пока не определился'},
      expiry:{fire:'Меньше 30 дней',soon:'1–3 месяца',ok:'Больше 3 месяцев',na:'Ещё за границей / не знаю'},
      profil:{yes:'Да, есть',no:'Нет',idk:'Не знаю, что это'},
      dur:{lt1:'Меньше 1 года','1_3':'1–3 года','3_5':'3–5 лет','5plus':'5+ лет',soon:'Ещё не приехал'},
      family:{solo:'Только я',partner:'С супругом/супругой',kids:'С семьёй и детьми'},
      ref:{no:'Нет, впервые',pending:'Подал, жду решения',refusal:'Был отказ — нужна апелляция'}
    },
    goalB:{
      pmzh_polak:{svc:'ПМЖ по Karcie Polaka',time:'решение 4–8 мес',diag:'У вас Karta Polaka — а это особый случай: ПМЖ доступен БЕЗ требования к сроку проживания. Большинство ждёт 5 лет, вам можно подавать сразу. Это бессрочный статус и прямой шаг к гражданству.',gives:'Подтверждение основания, подготовка пакета и подача на бессрочный статус.'},
      pmzh_5plus:{svc:'ПМЖ (резидент ЕС)',time:'решение 4–8 мес',diag:'У вас 5+ лет — вы уже проходите базовое требование для ПМЖ: 5 лет непрерывного проживания. Это бессрочный статус, работа без разрешений и шаг к гражданству. Критично проверить непрерывность стажа (длительные выезды могут его обнулять) и подтвердить доход за последние 3 года и знание языка.',gives:'Аудит непрерывности стажа, сбор подтверждений за 5 лет, подача на бессрочный статус.'},
      pmzh_3_5:{svc:'ВНЖ сейчас → ПМЖ скоро',time:'ПМЖ при 5 годах',diag:'До ПМЖ нужно 5 лет непрерывного проживания — вы почти у цели. Сейчас самое важное — не прервать стаж: вовремя продлить карту, чтобы к пятому году зайти на ПМЖ без обнуления срока. Одна просрочка может отбросить вас назад на годы.',gives:'Стратегия продления без разрывов и подготовка к ПМЖ к нужной дате.'},
      pmzh_other:{svc:'Karta Pobytu → курс на ПМЖ',time:'карта 1–3 года',diag:'Для ПМЖ нужно 5 лет непрерывного проживания — вам пока рано, но путь начинается уже сейчас. Главное — вести карты без единого разрыва, иначе отсчёт 5 лет обнулится. Мы выстроим траекторию так, чтобы каждый год работал на ваш ПМЖ.',gives:'Карта побыту сейчас и план продлений, ведущий к ПМЖ без потери стажа.'},
      citizen_brak:{svc:'Гражданство по браку',time:'решение 6–24 мес',diag:'Брак с гражданином Польши — самый короткий путь: достаточно 3 лет в браке и 2 лет проживания по ВНЖ/ПМЖ, плюс польский B1. Это в разы быстрее общих 10 лет. Разберём, проходите ли вы уже сейчас.',gives:'Проверка основания по браку, языковой вопрос и подача на паспорт.'},
      citizen_other:{svc:'Путь к гражданству',time:'решение 6–24 мес',diag:'Гражданство — это 10 лет непрерывного проживания, последние 3 из них по ПМЖ/долгосрочному резиденту, плюс польский B1. Если до этого далеко — не страшно: правильная траектория через ВНЖ и ПМЖ без разрывов стажа гарантированно приведёт к паспорту. Главная ошибка — терять годы на просрочках.',gives:'Оценка вашего основания, кратчайший маршрут и сопровождение до присяги.'},
      bluecard:{svc:'Blue Card (EU)',time:'решение 3–6 мес',diag:'Blue Card — для специалистов с высшим образованием (или 5+ лет опыта) и зарплатой от 1,5× средней по Польше. Главное преимущество: право на ПМЖ уже через 2 года вместо 5, и мобильность по ЕС через 18 месяцев. Семья получает карты сразу вместе с вами.',gives:'Проверка соответствия (диплом/опыт/ЗП), подготовка и подача на ускоренный трек.'},
      biz:{svc:'Фирма + карта на её основании',time:'Sp. z o.o. ~2 недели',diag:'Открываем Sp. z o.o. или JDG (ИП) и оформляем карту побыту на основании бизнеса. Получаете легальный статус, собственное дело и тот же путь к ПМЖ. Sp. z o.o. регистрируется примерно за 2 недели, дальше — бухгалтерия и подача на карту.',gives:'Регистрация фирмы, банк, бухгалтерия и карта побыту на основании бизнеса.'},
      work:{svc:'Работа + Karta Pobytu',time:'карта 3–6 мес',diag:'Лучшая стратегия — оформлять работу и легализацию параллельно, чтобы не было ни одного дня вне закона. Подаём на карту по работе; при подаче до истечения визы получаете штамп и право работать всё время ожидания. Карта выдаётся на 1–3 года.',gives:'Подбор/оформление работы у партнёра и подача на карту по этому основанию.'},
      protection:{svc:'Международная защита',time:'индивидуально',diag:'Международная защита — это беженство, гуманитарная виза или защита от выдворения. Здесь всё конфиденциально и часто срочно: при риске депортации значение имеет каждый день. Основания разбираем приватно, один на один с юристом.',gives:'Конфиденциальный разбор оснований и сопровождение по процедуре защиты.'},
      idk:{svc:'Бесплатная консультация',time:'15 минут',diag:'По вашим ответам уже видно несколько рабочих путей — и это нормально, большинство людей не знает свою точную категорию по польскому праву. 15-минутный разбор с юристом определит оптимальный вариант именно под вашу ситуацию, стаж и сроки — без догадок.',gives:'Точная диагностика вашей категории и пошаговый план под вашу ситуацию.'},
      kp_default:{svc:'Karta Pobytu (ВНЖ)',time:'решение 3–6 мес',diag:'Карта побыту — ваш базовый легальный статус: работа, NFZ, банковский счёт, свободный Шенген (90/180). Ключевой момент: подадите wniosek ДО истечения текущего статуса — в паспорт ставят штамп, и вы остаётесь легальны и с правом работать все 3–6 месяцев ожидания, даже если старая карта закончится.',gives:'Подбор основания, сбор документов и подача на карту через MOS.'}
    },
    refusalB:{svc:'Апелляция отказа',time:'срок на обжалование ограничен',diag:'Отказ почти никогда не бывает безупречным — в решении управления часто есть процедурные или фактические ошибки, которые и становятся основанием для отмены. Но срок на обжалование строго ограничен (как правило, 14 дней с момента получения решения). Пропустите его — и отказ станет окончательным, а с ним возможны последствия для дальнейшего пребывания.',gives:'Переразбор дела юристом, поиск оснований для отмены, подача апелляции в срок. Для наших клиентов апелляция — бесплатно.'},
    pendingB:{time:'дело уже на рассмотрении',diag:'Вы уже подали и ждёте решения — если подали до истечения предыдущего статуса, ваше пребывание во время рассмотрения легально. Главный риск в другом: управление почти всегда присылает запрос донести документы (uzupełnienie) с жёстким сроком. Пропуск этого срока = автоматический отказ. Многие теряют дело именно здесь.',gives:'Аудит вашего дела, контроль запросов управления и ответ на них в срок, возможное ускорение. Подключаемся даже к уже поданному wniosek.'},
    famAdd:' Заявки на всю семью подаём одним пакетом и в один срок — без рассинхрона статусов.',
    urg:{
      expired:{h:'Статус уже истёк — действовать нужно сегодня',t:'Сейчас ваше пребывание нелегально. Это прямой риск решения о возврате (выезде) и запрета на въезд в Шенген на несколько лет. Окно для легализации ещё может быть открыто, но оно закрывается с каждым днём — чем раньше начнём, тем больше рабочих вариантов остаётся.'},
      fire:{h:'Меньше 30 дней — критический срок',t:'Подать wniosek нужно ДО даты истечения статуса. Успеете вовремя — в паспорт ставят штамп, и вы остаётесь полностью легальны и с правом работать все 3–6 месяцев, пока идёт решение. Опоздаете хоть на день — этой возможности уже не будет, и пребывание станет нелегальным. Времени на раскачку нет.'},
      soon:{h:'1–3 месяца — пора начинать',t:'С 27.04.2026 подача только онлайн через MOS, а на сбор документов, переводы и оформление Profil Zaufany уходит время. Начнём сейчас — подадим с запасом и спокойно, а не в последние дни.'},
      appeal:{h:'Срок на апелляцию идёт прямо сейчас',t:'На обжалование отказа обычно есть лишь 14 дней с получения решения. Каждый день промедления уменьшает шансы. Нужно показать решение юристу немедленно.'}
    },
    noteProfil:'Без Profil Zaufany подать через MOS физически невозможно, а с 27.04.2026 это единственный способ подачи. Это первый шаг — оформляется за 1–2 дня, мы делаем это вместе с вами.',
    noteCountry:'Документы из %C (справки о несудимости, о браке/рождении) принимаются только с апостилем и присяжным переводом на польский. Это самая частая причина задержек на недели. Мы знаем требования под %C и собираем пакет правильно с первого раза.',
    step:{profil:'Оформляем Profil Zaufany — без него онлайн-подача невозможна (1–2 дня)',consult:'Бесплатная консультация: юрист разбирает ваш случай и фиксирует стратегию',appeal:'Анализируем решение, находим основания и подаём апелляцию в срок',pending:'Берём ваше дело под контроль и отвечаем на запросы управления вовремя',docs:'Собираем и проверяем документы (AI + юрист), переводы и апостили',submitNormal:'Подаём онлайн через MOS и доводим до карты на руках',submitUrgent:'Подаём онлайн через MOS срочно, до истечения статуса'},
    conf:{normal:'98% одобрений · апелляция для клиентов бесплатно',appeal:'76% выигранных апелляций'},
    why:'Мы специализируемся на подаче именно через новую систему MOS — на переходе спотыкается большинство. Ведём вас от первого документа до карты на руках, на вашем языке, и отвечаем в WhatsApp за 15 минут.',
    wa:{intro:'Здравствуйте! Прошёл квиз на сайте LegalSol. Моя ситуация:',lbl:{goal:'Нужно',cit:'Гражданство',now:'Статус сейчас',basis:'Основание',expiry:'Истекает',profil:'Profil Zaufany',dur:'В Польше',family:'Семья',ref:'Заявления раньше'},name:'Имя',tail:'Хочу разбор и бесплатную консультацию.'}
   }
  };

  var LANG='en', ans={}, step=0;
  function pickLang(){var l=(document.documentElement.lang||'en').toLowerCase().slice(0,2);return TXT[l]?l:'en';}
  function T(){return TXT[LANG];}
  function labelOf(id){return T().opt[id]?(T().opt[id][ans[id]]||ans[id]):ans[id];}
  function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
  function clone(o){return JSON.parse(JSON.stringify(o));}

  function goalKey(a){
    if(a.goal==='pmzh'){if(a.basis==='polak')return 'pmzh_polak';if(a.dur==='5plus')return 'pmzh_5plus';if(a.dur==='3_5')return 'pmzh_3_5';return 'pmzh_other';}
    if(a.goal==='citizen')return a.basis==='family'?'citizen_brak':'citizen_other';
    if(a.goal==='bluecard')return 'bluecard';if(a.goal==='biz')return 'biz';if(a.goal==='work')return 'work';
    if(a.goal==='protection')return 'protection';if(a.goal==='idk')return 'idk';return 'kp_default';
  }

  function analyze(){
    var a=ans,t=T(),R={};
    var expired=a.now==='expired',fire=a.expiry==='fire',soon=a.expiry==='soon';
    var noProf=(a.profil==='no'||a.profil==='idk'),withFamily=(a.family==='partner'||a.family==='kids');
    var nonEU=a.cit&&a.cit!=='Другая';
    var country=nonEU?labelOf('cit'):t.yourCountry;
    if(a.ref==='refusal'){var rb=clone(t.refusalB);R.svc=rb.svc;R.time=rb.time;R.diag=rb.diag;R.gives=rb.gives;}
    else if(a.ref==='pending'){R.svc=t.goalB[goalKey(a)].svc;R.time=t.pendingB.time;R.diag=t.pendingB.diag;R.gives=t.pendingB.gives;}
    else {var g=clone(t.goalB[goalKey(a)]);R.svc=g.svc;R.time=g.time;R.diag=g.diag;R.gives=g.gives;}
    if(withFamily)R.gives+=t.famAdd;
    if(a.ref==='refusal')R.urg={lvl:'fire',h:t.urg.appeal.h,t:t.urg.appeal.t};
    else if(expired)R.urg={lvl:'fire',h:t.urg.expired.h,t:t.urg.expired.t};
    else if(fire)R.urg={lvl:'fire',h:t.urg.fire.h,t:t.urg.fire.t};
    else if(soon)R.urg={lvl:'warn',h:t.urg.soon.h,t:t.urg.soon.t};
    R.notes=[];
    if(noProf&&!expired&&a.ref!=='refusal')R.notes.push({lvl:'warn',i:'lock',t:t.noteProfil});
    if(nonEU&&a.goal!=='protection')R.notes.push({lvl:'info',i:'award',t:t.noteCountry.split('%C').join(country)});
    var steps=[];
    if(noProf&&a.ref!=='refusal')steps.push(t.step.profil);
    steps.push(t.step.consult);
    if(a.ref==='refusal')steps.push(t.step.appeal);
    else if(a.ref==='pending')steps.push(t.step.pending);
    else {steps.push(t.step.docs);steps.push((fire||expired)?t.step.submitUrgent:t.step.submitNormal);}
    R.steps=steps.slice(0,4);
    R.conf=a.ref==='refusal'?t.conf.appeal:t.conf.normal;
    R.why=t.why;
    return R;
  }

  function waText(){var t=T(),L=[t.wa.intro];QSDEF.forEach(function(d){if(ans[d.id])L.push('• '+t.wa.lbl[d.id]+': '+labelOf(d.id));});if(ans.name)L.push('• '+t.wa.name+': '+ans.name);L.push('',t.wa.tail);return L.join('\n');}
  function waHref(){return 'https://wa.me/'+WA+'?text='+encodeURIComponent(waText());}

  function utmObj(){try{var p=new URLSearchParams(location.search),o={};p.forEach(function(v,k){if(k.indexOf('utm_')===0)o[k]=v;});return o;}catch(e){return{};}}
  function leadSent(){return !!ans.__sent;}
  function postLead(){
    if(leadSent())return; ans.__sent=true;
    var R=analyze();
    var msg=waText()+'\n\n— Recommended: '+R.svc+' ('+R.time+')';
    var payload={name:ans.name||'',phone:ans.phone||'',service:'Quiz: '+(T().opt.goal[ans.goal]||ans.goal||'general'),message:msg,source:'quiz_popup',page:location.pathname,lang:document.documentElement.lang||'en',utm:utmObj(),ref:document.referrer||''};
    if(typeof window._sendLead==='function'){try{window._sendLead(payload);return;}catch(e){}}
    try{fetch(LEAD_URL,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload)}).catch(function(){});}catch(e){}
    try{window.dataLayer=window.dataLayer||[];window.dataLayer.push({event:'lead_submit',lead_source:'quiz_popup',lead_service:payload.service,lead_lang:payload.lang,lead_page:payload.page});}catch(e){}
    try{if(window.fbq)fbq('track','Lead',{content_name:payload.service,content_category:'quiz_popup',source_url:payload.page});}catch(e){}
  }

  /* ---- DOM scaffold ---- */
  var fab,ov,card,bodyEl,barEl,stepEl,pctEl,brandEl;
  function build(){
    LANG=pickLang();
    var st=document.createElement('style');
    st.textContent=CSS;
    document.head.appendChild(st);
    var t=T();
    fab=document.createElement('button');
    fab.id='lsq-fab'; fab.type='button'; fab.setAttribute('aria-haspopup','dialog');
    fab.innerHTML='<span class="lsq-fdot"></span><span class="lsq-fbadge">'+LOGO+'</span><span id="lsq-fab-tx">'+esc(t.fab)+'</span>';
    ov=document.createElement('div');
    ov.id='lsq-ov'; ov.setAttribute('role','dialog'); ov.setAttribute('aria-modal','true'); ov.setAttribute('aria-label',t.dialog);
    ov.innerHTML='<div id="lsq-card"><div class="lsq-accent"></div><div id="lsq-head"><div class="lsq-brand">'+LOGO+'<div class="lsq-bn"><span class="lsq-name">LEGALSOL</span><span class="lsq-sub">LEGALIZATION SERVICES</span></div></div><button id="lsq-close" type="button" aria-label="'+esc(t.close)+'">'+ic('x',20)+'</button><div class="lsq-progwrap"><span id="lsq-step"></span><span id="lsq-pct"></span></div><div class="lsq-track"><div id="lsq-bar"></div></div></div><div id="lsq-body"></div></div>';
    document.body.appendChild(fab); document.body.appendChild(ov);
    bodyEl=document.getElementById('lsq-body'); barEl=document.getElementById('lsq-bar'); stepEl=document.getElementById('lsq-step'); pctEl=document.getElementById('lsq-pct'); card=document.getElementById('lsq-card');
    fab.addEventListener('click',open);
    document.getElementById('lsq-close').addEventListener('click',close);
    ov.addEventListener('click',function(e){if(e.target===ov)close();});
    document.addEventListener('keydown',function(e){if(e.key==='Escape'&&ov.classList.contains('on'))close();});
    // Follow the site language (set late on init, or switched live by the user)
    function syncLang(){var nl=pickLang();if(nl===LANG)return;LANG=nl;var tx=document.getElementById('lsq-fab-tx');if(tx)tx.textContent=T().fab;ov.setAttribute('aria-label',T().dialog);if(ov.classList.contains('on'))render();}
    try{new MutationObserver(syncLang).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});}catch(e){}
    syncLang();
  }
  function open(){LANG=pickLang();ov.classList.add('on');document.documentElement.style.overflow='hidden';render();try{card.focus();}catch(e){}
    try{window.dataLayer=window.dataLayer||[];window.dataLayer.push({event:'quiz_open',quiz_lang:LANG});}catch(e){}}
  function close(){ov.classList.remove('on');document.documentElement.style.overflow='';}

  function setProg(){var n=QSDEF.length,cur=Math.min(step,n),p=Math.round((cur/(n+1))*100);if(step>n)p=100;barEl.style.width=p+'%';if(pctEl)pctEl.textContent=p+'%';stepEl.textContent=step<n?T().stepFmt(step+1,n):(step===n?T().almost:T().done);}

  function render(){
    var t=T(); setProg();
    if(step<QSDEF.length){
      var D=QSDEF[step],id=D.id;
      var h='<div class="lsq-slide"><h3 class="lsq-qh">'+t.q[id]+'</h3>';
      h+=(D.hint&&t.hint[id])?'<div class="lsq-hint">'+ic('bolt',13)+t.hint[id]+'</div>':'';
      h+=t.s[id]?'<p class="lsq-qs">'+t.s[id]+'</p>':'<div style="height:8px"></div>';
      h+='<div class="lsq-opts'+(D.grid?' lsq-grid':'')+'">';
      D.opts.forEach(function(v){var sel=ans[id]===v?' sel':'';h+='<button class="lsq-opt'+sel+'" type="button" data-v="'+esc(v)+'"><span>'+t.opt[id][v]+'</span><span class="lsq-chk">'+ic('check',18)+'</span></button>';});
      h+='</div>';
      h+='<div class="lsq-trust"><span>'+ic('check',13)+t.tFree+'</span><span>'+ic('check',13)+t.tReply+'</span><span>'+ic('check',13)+t.tNoSpam+'</span></div>';
      if(step>0)h+='<button class="lsq-back" id="lsq-back" type="button">'+ic('arrowL',16)+t.back+'</button>';
      h+='</div>';
      bodyEl.innerHTML=h; bodyEl.scrollTop=0;
      [].forEach.call(bodyEl.querySelectorAll('.lsq-opt'),function(b){b.addEventListener('click',function(){ans[QSDEF[step].id]=b.getAttribute('data-v');b.classList.add('sel');setTimeout(function(){step++;render();},220);});});
      var bk=document.getElementById('lsq-back'); if(bk)bk.addEventListener('click',function(){step--;render();});
    } else if(step===QSDEF.length){
      bodyEl.innerHTML='<div class="lsq-slide"><h3 class="lsq-qh">'+t.contactH+'</h3><p class="lsq-qs">'+t.contactS+'</p>'+
        '<input id="lsq-name" placeholder="'+esc(t.name)+'" autocomplete="name"/>'+
        '<input id="lsq-phone" placeholder="'+esc(t.phone)+'" inputmode="tel" autocomplete="tel"/>'+
        '<button class="lsq-prim" id="lsq-submit" type="button">'+ic('file',17)+t.submit+'</button>'+
        '<div class="lsq-or">'+t.or+'</div>'+
        '<a class="lsq-wa ghost" id="lsq-wa-pre" href="#" target="_blank" rel="noopener">'+ic('chat',18)+t.waPre+'</a>'+
        '<button class="lsq-back" id="lsq-back" type="button">'+ic('arrowL',16)+t.back+'</button></div>';
      bodyEl.scrollTop=0;
      var upd=function(){var w=document.getElementById('lsq-wa-pre');if(w)w.href=waHref();};
      document.getElementById('lsq-name').addEventListener('input',function(){ans.name=this.value.trim();upd();});
      document.getElementById('lsq-phone').addEventListener('input',function(){ans.phone=this.value.trim();});
      upd();
      document.getElementById('lsq-submit').addEventListener('click',function(){ans.name=(document.getElementById('lsq-name').value||'').trim();ans.phone=(document.getElementById('lsq-phone').value||'').trim();postLead();step++;render();});
      document.getElementById('lsq-back').addEventListener('click',function(){step--;render();});
    } else {
      var R=analyze(),d=0;
      function dl(){d+=80;return ' style="animation-delay:'+d+'ms"';}
      var hi=ans.name?(', '+esc(ans.name)):'';
      var h='<div class="lsq-result">';
      h+='<div style="text-align:center;margin-bottom:4px;"><div class="lsq-pop lsq-badge">'+ic('checkc',28)+'</div>';
      h+='<h3 class="lsq-rise"'+dl()+' style="font-size:18px;font-weight:600;margin:0;color:#1a1535;">'+t.resultH+hi+'</h3>';
      h+='<p class="lsq-rise"'+dl()+' style="font-size:12px;color:#8b84a8;margin:5px 0 16px;">'+t.accepted+'</p></div>';
      if(R.urg){var fr=R.urg.lvl==='fire';var col=fr?'#c0392b':'#9a6800';var bg=fr?'rgba(226,75,74,.08)':'rgba(186,117,23,.09)';var bd=fr?'rgba(226,75,74,.32)':'rgba(186,117,23,.32)';
        h+='<div class="lsq-blk lsq-rise"'+dl()+' style="background:'+bg+';border-color:'+bd+';"><div class="lsq-bt" style="color:'+col+';">'+ic(fr?'alert':'clock',14)+(fr?t.secCritical:t.secTiming)+'</div><p style="color:'+col+';font-weight:600;margin:0 0 4px;">'+R.urg.h+'</p><p style="color:#5a5470;margin:0;">'+R.urg.t+'</p></div>';
      }
      h+='<div class="lsq-verdict lsq-rise"'+dl()+'><div class="lsq-vlabel">'+ic('nav',13)+t.recommended+'</div><div class="lsq-vsvc">'+R.svc+'</div><div class="lsq-vtime">'+ic('clock',13)+R.time+'</div><div class="lsq-vgive">'+R.gives+'</div></div>';
      h+='<div class="lsq-blk lsq-rise"'+dl()+' style="background:#f7f6fc;border-color:#ece9f6;"><div class="lsq-bt" style="color:#8b84a8;">'+ic('file',14)+t.secLaw+'</div><p style="color:#2a2545;margin:0;">'+R.diag+'</p></div>';
      R.notes.forEach(function(n){var w=n.lvl==='warn';var col=w?'#9a6800':'#7C5CFC';var bg=w?'rgba(186,117,23,.09)':'#f7f6fc';var bd=w?'rgba(186,117,23,.3)':'#ece9f6';
        h+='<div class="lsq-blk lsq-rise"'+dl()+' style="display:flex;gap:10px;align-items:flex-start;background:'+bg+';border-color:'+bd+';"><span style="color:'+col+';flex-shrink:0;margin-top:1px;">'+ic(n.i,18)+'</span><p style="color:#5a5470;margin:0;">'+n.t+'</p></div>';
      });
      h+='<div class="lsq-tl lsq-rise"'+dl()+'><div class="lsq-tl-h">'+t.secSteps+'</div>';
      R.steps.forEach(function(s,i){h+='<div class="lsq-tl-step"><span class="lsq-tl-num">'+(i+1)+'</span><span>'+s+'</span></div>';});
      h+='</div>';
      h+='<div class="lsq-badges lsq-rise"'+dl()+'><div class="lsq-tbadge">'+ic('checkc',18)+'<b>98%</b><span>'+t.bApproval+'</span></div><div class="lsq-tbadge">'+ic('users',18)+'<b>3000+</b><span>'+t.bClients+'</span></div><div class="lsq-tbadge">'+ic('shield',18)+'<b>'+t.bFree+'</b><span>'+t.bAppeal+'</span></div></div>';
      h+='<a class="lsq-wa lsq-rise"'+dl()+' href="'+waHref()+'" target="_blank" rel="noopener" style="margin-top:6px;" data-lead-source="quiz_result_wa">'+ic('chat',18)+(R.urg&&R.urg.lvl==='fire'?t.waResultUrgent:t.waResult)+'</a>';
      h+='<button class="lsq-back" id="lsq-restart" type="button" style="margin:14px auto 0;">'+ic('refresh',15)+t.restart+'</button></div>';
      bodyEl.innerHTML=h; bodyEl.scrollTop=0;
      document.getElementById('lsq-restart').addEventListener('click',function(){ans={};step=0;render();});
    }
  }

  var CSS='#lsq-fab{position:fixed;left:20px;bottom:24px;z-index:900;display:flex;align-items:center;gap:8px;padding:13px 18px;border-radius:60px;border:none;cursor:pointer;font-family:Inter,system-ui,sans-serif;font-size:14px;font-weight:600;color:#fff;background:linear-gradient(135deg,#5B52CC,#7C5CFC);box-shadow:0 8px 28px rgba(91,82,204,.5);transition:transform .2s,box-shadow .2s;animation:lsqPulse 2.8s ease-in-out infinite;}'
  +'#lsq-fab:hover{transform:translateY(-2px);box-shadow:0 14px 36px rgba(91,82,204,.62);}'
  +'.lsq-fdot{width:8px;height:8px;border-radius:50%;background:#4ade80;flex-shrink:0;box-shadow:0 0 0 0 rgba(74,222,128,.7);animation:lsqDot 1.6s ease-out infinite;}'
  +'.lsq-fbadge{display:inline-flex;align-items:center;justify-content:center;background:#fff;border-radius:6px;padding:3px 4px;flex-shrink:0;}'
  +'.lsq-fbadge svg{width:16px;height:15px;display:block;}'
  +'@keyframes lsqDot{0%{box-shadow:0 0 0 0 rgba(74,222,128,.6);}70%{box-shadow:0 0 0 7px rgba(74,222,128,0);}100%{box-shadow:0 0 0 0 rgba(74,222,128,0);}}'
  +'@keyframes lsqPulse{0%,100%{transform:translateY(0);}50%{transform:translateY(-3px);}}'
  +'#lsq-ov{position:fixed;inset:0;z-index:100000;display:none;align-items:flex-start;justify-content:center;padding:24px 16px;background:rgba(20,16,40,.55);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);overflow-y:auto;}'
  +'#lsq-ov.on{display:flex;animation:lsqFade .25s ease;}'
  +'@keyframes lsqFade{from{opacity:0;}to{opacity:1;}}'
  +'#lsq-card{width:100%;max-width:468px;margin:auto;background:#fff;border-radius:22px;overflow:hidden;box-shadow:0 30px 80px rgba(10,6,25,.45);font-family:Inter,system-ui,sans-serif;animation:lsqUp .35s cubic-bezier(.16,1,.3,1);outline:none;}'
  +'@keyframes lsqUp{from{opacity:0;transform:translateY(24px);}to{opacity:1;transform:none;}}'
  +'#lsq-head{position:relative;padding:18px 20px 14px;border-bottom:1px solid #f0eef8;}'
  +'.lsq-brand{display:flex;align-items:center;gap:9px;}'
  +'.lsq-mark{flex-shrink:0;display:block;}'
  +'.lsq-bn{display:flex;flex-direction:column;line-height:1;}'
  +'.lsq-name{font-size:13px;font-weight:800;letter-spacing:.04em;color:#1a1535;}'
  +'.lsq-sub{font-size:8px;font-weight:600;letter-spacing:.16em;color:#9a93b5;text-transform:uppercase;margin-top:3px;}'
  +'#lsq-close{position:absolute;top:14px;right:14px;width:32px;height:32px;border:none;background:#f4f2fb;color:#8b84a8;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background .15s,color .15s;}'
  +'#lsq-close:hover{background:#ece9f6;color:#1a1535;}'
  +'.lsq-accent{height:4px;background:linear-gradient(90deg,#5B52CC,#7C5CFC 55%,#34d3b0);}'
  +'.lsq-progwrap{display:flex;align-items:center;justify-content:space-between;margin:12px 0 7px;}#lsq-step{font-size:11.5px;color:#8b84a8;font-weight:600;}#lsq-pct{font-size:11.5px;color:#7C5CFC;font-weight:700;}'
  +'.lsq-track{height:6px;border-radius:99px;background:#efedf7;overflow:hidden;}#lsq-bar{height:100%;width:11%;border-radius:99px;background:linear-gradient(90deg,#7C5CFC,#5eead4);transition:width .5s cubic-bezier(.16,1,.3,1);}'
  +'#lsq-body{padding:22px 20px 26px;max-height:64vh;overflow-y:auto;}'
  +'.lsq-qh{font-size:21px;font-weight:600;line-height:1.25;color:#1a1535;margin:0 0 6px;letter-spacing:-.01em;}'
  +'.lsq-qs{font-size:13px;line-height:1.5;color:#6f6890;margin:0 0 16px;}'
  +'.lsq-hint{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:600;color:#6d28d9;background:rgba(124,92,252,.1);padding:5px 11px;border-radius:99px;margin:0 0 12px;}'
  +'.lsq-opts{display:flex;flex-direction:column;gap:9px;}'
  +'.lsq-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px;}'
  +'.lsq-opt{position:relative;overflow:hidden;display:flex;align-items:center;gap:10px;width:100%;text-align:left;padding:14px 15px 14px 16px;border-radius:13px;background:#fff;border:1px solid #e7e3f3;color:#1a1535;font-family:inherit;font-size:14px;font-weight:500;cursor:pointer;opacity:0;transform:translateY(8px);animation:lsqIn .38s cubic-bezier(.16,1,.3,1) forwards;transition:transform .15s,border-color .15s,box-shadow .15s,background .15s;}'
  +".lsq-opt::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:linear-gradient(#7C5CFC,#34d3b0);transform:scaleY(0);transition:transform .2s cubic-bezier(.16,1,.3,1);}"
  +'.lsq-opt:hover::before,.lsq-opt.sel::before{transform:scaleY(1);}'
  +'.lsq-grid .lsq-opt::before{display:none;}'
  +'.lsq-grid .lsq-opt{justify-content:center;text-align:center;}'
  +'.lsq-opt:hover{transform:translateX(4px);border-color:#7C5CFC;box-shadow:0 8px 20px rgba(124,92,252,.18);}'
  +'.lsq-opt.sel{border-color:#7C5CFC;background:rgba(124,92,252,.07);box-shadow:0 0 0 1px #7C5CFC;}'
  +'.lsq-opt .lsq-chk{margin-left:auto;color:#7C5CFC;opacity:0;transform:scale(.4);transition:opacity .2s,transform .25s cubic-bezier(.34,1.5,.6,1);display:inline-flex;}'
  +'.lsq-grid .lsq-opt .lsq-chk{position:absolute;top:6px;right:7px;margin:0;}'
  +'.lsq-opt.sel .lsq-chk{opacity:1;transform:scale(1);}'
  +'.lsq-opt:nth-child(1){animation-delay:.03s}.lsq-opt:nth-child(2){animation-delay:.06s}.lsq-opt:nth-child(3){animation-delay:.09s}.lsq-opt:nth-child(4){animation-delay:.12s}.lsq-opt:nth-child(5){animation-delay:.15s}.lsq-opt:nth-child(6){animation-delay:.18s}.lsq-opt:nth-child(7){animation-delay:.21s}.lsq-opt:nth-child(8){animation-delay:.24s}.lsq-opt:nth-child(9){animation-delay:.27s}'
  +'@keyframes lsqIn{to{opacity:1;transform:none;}}'
  +'#lsq-body input{width:100%;box-sizing:border-box;padding:13px 15px;border-radius:11px;background:#fff;border:1px solid #e7e3f3;color:#1a1535;font-family:inherit;font-size:15px;margin-bottom:11px;outline:none;transition:border-color .15s,box-shadow .15s;}'
  +'#lsq-body input:focus{border-color:#7C5CFC;box-shadow:0 0 0 3px rgba(124,92,252,.15);}'
  +'.lsq-prim{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;box-sizing:border-box;padding:15px;border:none;border-radius:13px;background:linear-gradient(135deg,#5B52CC,#7C5CFC);color:#fff;font-family:inherit;font-size:15px;font-weight:600;cursor:pointer;box-shadow:0 8px 22px rgba(91,82,204,.32);transition:transform .15s,box-shadow .25s;}'
  +'.lsq-prim:hover{transform:translateY(-2px);box-shadow:0 12px 30px rgba(91,82,204,.45);}'
  +'.lsq-or{text-align:center;font-size:12px;color:#a49dbf;margin:12px 0;}'
  +'.lsq-wa{display:flex;align-items:center;justify-content:center;gap:9px;width:100%;box-sizing:border-box;padding:15px;border-radius:13px;background:#25d366;color:#fff;border:none;font-family:inherit;font-size:14.5px;font-weight:600;cursor:pointer;text-decoration:none;box-shadow:0 8px 22px rgba(37,211,102,.3);transition:background .15s,transform .15s;}'
  +'.lsq-wa:hover{background:#1eb555;transform:translateY(-2px);}'
  +'.lsq-wa.ghost{background:#fff;color:#1eb555;border:1.5px solid #25d366;box-shadow:none;}'
  +'.lsq-wa.ghost:hover{background:rgba(37,211,102,.08);}'
  +'.lsq-back{display:inline-flex;align-items:center;gap:5px;background:none;border:none;color:#a49dbf;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;padding:8px 0;margin-top:16px;}'
  +'.lsq-back:hover{color:#1a1535;}'
  +'.lsq-blk{text-align:left;border:1px solid;border-radius:13px;padding:14px 15px;margin:0 0 11px;opacity:0;animation:lsqRise .5s cubic-bezier(.16,1,.3,1) forwards;}'
  +'.lsq-blk .lsq-bt{display:flex;align-items:center;gap:7px;font-size:10.5px;letter-spacing:.09em;text-transform:uppercase;font-weight:700;margin-bottom:7px;}'
  +'.lsq-blk p{font-size:13px;line-height:1.55;}'
  +'.lsq-badge{width:52px;height:52px;border-radius:50%;background:rgba(124,92,252,.1);color:#7C5CFC;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;}'
  +'.lsq-steps-h{font-size:10.5px;letter-spacing:.09em;text-transform:uppercase;font-weight:700;color:#a49dbf;margin-bottom:11px;}'
  +'.lsq-stp{display:flex;gap:11px;align-items:flex-start;margin-bottom:11px;}'
  +'.lsq-num{flex-shrink:0;width:25px;height:25px;border-radius:50%;background:linear-gradient(135deg,#5B52CC,#7C5CFC);color:#fff;font-size:12px;font-weight:600;display:flex;align-items:center;justify-content:center;}'
  +'.lsq-stp>span:last-child{font-size:13px;line-height:1.4;color:#2a2545;padding-top:3px;}'
  +'.lsq-slide{animation:lsqSlide .4s cubic-bezier(.16,1,.3,1);}'
  +'@keyframes lsqSlide{from{opacity:0;transform:translateX(18px);}to{opacity:1;transform:none;}}'
  +'.lsq-pop{animation:lsqPop .5s cubic-bezier(.34,1.4,.6,1) backwards;}'
  +'@keyframes lsqPop{from{opacity:0;transform:scale(.5);}to{opacity:1;transform:scale(1);}}'
  +'.lsq-rise{opacity:0;animation:lsqRise .5s cubic-bezier(.16,1,.3,1) forwards;}'
  +'@keyframes lsqRise{to{opacity:1;transform:none;}}'
  +'.lsq-trust{display:flex;flex-wrap:wrap;gap:12px;margin-top:18px;padding-top:14px;border-top:1px solid #f0eef8;}'
  +'.lsq-trust span{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;color:#9a93b5;}'
  +'.lsq-trust span svg{color:#34c79a;}'
  +'.lsq-verdict{position:relative;overflow:hidden;text-align:left;border-radius:16px;padding:17px 18px;margin:0 0 11px;background:linear-gradient(140deg,#5B52CC,#7C5CFC);color:#fff;box-shadow:0 14px 32px rgba(91,82,204,.34);opacity:0;animation:lsqRise .5s cubic-bezier(.16,1,.3,1) forwards;}'
  +'.lsq-vlabel{display:flex;align-items:center;gap:6px;font-size:10px;font-weight:700;letter-spacing:.13em;text-transform:uppercase;color:rgba(255,255,255,.74);margin-bottom:6px;}'
  +'.lsq-vsvc{font-size:19px;font-weight:700;line-height:1.2;letter-spacing:-.01em;margin-bottom:9px;}'
  +'.lsq-vtime{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:600;background:rgba(255,255,255,.18);padding:5px 11px;border-radius:99px;margin-bottom:11px;}'
  +'.lsq-vgive{font-size:13px;line-height:1.55;color:rgba(255,255,255,.94);}'
  +'.lsq-tl{margin:16px 0 14px;}'
  +'.lsq-tl-h{font-size:10.5px;letter-spacing:.09em;text-transform:uppercase;font-weight:700;color:#a49dbf;margin-bottom:13px;}'
  +'.lsq-tl-step{position:relative;display:flex;gap:13px;padding-bottom:15px;}'
  +".lsq-tl-step:not(:last-child)::before{content:'';position:absolute;left:12.5px;top:27px;bottom:-1px;width:2px;background:#e7e3f3;}"
  +'.lsq-tl-num{position:relative;z-index:1;flex-shrink:0;width:26px;height:26px;border-radius:50%;background:linear-gradient(135deg,#5B52CC,#7C5CFC);color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 8px rgba(91,82,204,.3);}'
  +'.lsq-tl-step>span:last-child{font-size:13px;line-height:1.42;color:#2a2545;padding-top:4px;}'
  +'.lsq-badges{display:flex;gap:8px;margin:4px 0 14px;}'
  +'.lsq-tbadge{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;text-align:center;background:#f7f6fc;border:1px solid #ece9f6;border-radius:12px;padding:11px 6px;}'
  +'.lsq-tbadge svg{color:#7C5CFC;}'
  +'.lsq-tbadge b{font-size:13px;font-weight:700;color:#1a1535;}'
  +'.lsq-tbadge span{font-size:9.5px;font-weight:500;color:#9a93b5;letter-spacing:.02em;line-height:1.2;}'
  +'@media(max-width:900px){#lsq-fab{bottom:76px;left:12px;padding:11px 15px;font-size:13px;}}'
  +'@media(max-width:380px){#lsq-fab #lsq-fab-tx{display:none;}#lsq-fab{padding:13px;}}'
  +'@media(prefers-reduced-motion:reduce){#lsq-fab,#lsq-fab *,#lsq-ov *{animation:none!important;transition:none!important;opacity:1!important;transform:none!important;}}';

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',build);
  else build();
})();
