const http=require('http'),fs=require('fs'),path=require('path');
const root='/tmp/legalsol';
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.ico':'image/x-icon','.json':'application/json','.webp':'image/webp'};
http.createServer((req,res)=>{
  let p=decodeURIComponent(req.url.split('?')[0]);
  if(p==='/'||p===''||p==='/index.html') p='/_index.html';
  let f=path.join(root,p);
  try{ if(!fs.existsSync(f)||fs.statSync(f).isDirectory()) f=path.join(root,'_index.html'); }catch(e){ f=path.join(root,'_index.html'); }
  const ext=path.extname(f).toLowerCase();
  fs.readFile(f,(e,d)=>{ if(e){res.writeHead(404);res.end('nf');return;} res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream'});res.end(d); });
}).listen(8767,()=>console.log('server up on 8767'));
