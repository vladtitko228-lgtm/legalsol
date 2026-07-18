// Vercel Edge Middleware — закрывает раздачу исходников и конфигов как статики.
//
// Проблема: в vercel.json стоит "outputDirectory": ".", поэтому Vercel публикует
// ВСЮ папку как статические файлы. Из-за этого сырой код функций (/api/*.js),
// сам /vercel.json, шаблон /_index.html и черновики /preview/* можно просто
// скачать в браузере. Секреты не утекают (они в env), но утекает вся логика
// авторизации, ID полей Kommo, пороги rate-limit и т.п. — готовая карта для атаки.
//
// Фикс: на эти пути отдаём 404. Реальные вызовы функций идут по путям БЕЗ .js
// (напр. POST /api/cabinet/login, /api/blog-inject), поэтому фильтр их не трогает —
// ломаться нечему. Фронтовые скрипты (/quiz.js, /cookie-banner.js) лежат в корне,
// а не в /api, и тоже не затрагиваются.

export const config = {
  matcher: ['/api/:path*', '/vercel.json', '/middleware.js', '/_index.html', '/.gitignore', '/preview/:path*'],
};

export default function middleware(req) {
  const { pathname } = new URL(req.url);

  // 1) Сырые исходники функций: /api/**/*.js|ts|mjs|cjs|json
  const isApiSource = pathname.startsWith('/api/') && /\.(js|ts|mjs|cjs|json)$/i.test(pathname);

  // 2) Конфиг, шаблон главной, .gitignore и черновики preview/
  //    (если понадобится смотреть preview вживую — убери '/preview/' ниже)
  const isPrivate =
    pathname === '/vercel.json' ||
    pathname === '/middleware.js' ||
    pathname === '/_index.html' ||
    pathname === '/.gitignore' ||
    pathname.startsWith('/preview/');

  if (isApiSource || isPrivate) {
    return new Response('Not Found', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'x-robots-tag': 'noindex, nofollow' },
    });
  }
  // иначе — пропускаем запрос дальше; функции и статика работают как обычно
}
