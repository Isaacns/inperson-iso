/* INPERSON ISO service worker — versionado por build. NÃO editar o valor de VER à mão: o build.js injeta. */
var VER="mrrwf4ba";
var C="inperson-iso-"+VER;

self.addEventListener("install", function(e){ self.skipWaiting(); });

/* O app pede para a versão nova assumir AGORA, quando o usuário toca em
   "atualizar". Sem isto o SW novo ficaria em 'waiting' até todas as abas
   fecharem — e num atalho de tela inicial isso pode não acontecer nunca.
   Mesmo padrão do VIZIO Money. */
self.addEventListener("message", function(e){
  if(e.data && e.data.type==="PULAR_ESPERA") self.skipWaiting();
});

self.addEventListener("activate", function(e){
  e.waitUntil((async function(){
    try{
      var keys=await caches.keys();
      await Promise.all(keys.filter(function(k){ return k!==C; }).map(function(k){ return caches.delete(k); }));
    }catch(x){}
    await self.clients.claim();
  })());
});

/* Só gerencia o app shell (mesma origem). Chamadas ao Supabase/CDNs passam direto, sem interceptar. */

/* `no-cache` obriga revalidar com o servidor (ETag -> 304 barato, ou 200 com a
   versão nova). Sem isto, o fetch do SW pode ser servido pelo CACHE HTTP do
   navegador e o network-first vira cache-first disfarçado: o app novo existe
   no servidor e nunca chega no aparelho. */
function buscar(req){
  try{ return fetch(req,{cache:"no-cache"}); }catch(e){ return fetch(req); }
}

function netFirst(req){
  return new Promise(function(resolve){
    var done=false;
    var t=setTimeout(function(){
      if(done) return; done=true;
      caches.match(req).then(function(c){ resolve(c || buscar(req).catch(function(){ return new Response("",{status:504}); })); });
    }, 4000);
    buscar(req).then(function(r){
      if(done) return; done=true; clearTimeout(t);
      try{ var cp=r.clone(); caches.open(C).then(function(c){ c.put(req,cp); }).catch(function(){}); }catch(x){}
      resolve(r);
    }).catch(function(){
      if(done) return; done=true; clearTimeout(t);
      caches.match(req).then(function(c){ resolve(c || new Response("offline",{status:503})); });
    });
  });
}

self.addEventListener("fetch", function(e){
  if(e.request.method!=="GET") return;
  var url;
  try{ url=new URL(e.request.url); }catch(x){ return; }
  if(url.origin!==self.location.origin) return; /* deixa Supabase e CDNs passarem */
  e.respondWith(netFirst(e.request));
});
