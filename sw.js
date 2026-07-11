/* INPERSON ISO service worker — versionado por build. NÃO editar o valor de VER à mão: o build.js injeta. */
var VER="mrgmgvko";
var C="inperson-iso-"+VER;

self.addEventListener("install", function(e){ self.skipWaiting(); });

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
function netFirst(req){
  return new Promise(function(resolve){
    var done=false;
    var t=setTimeout(function(){
      if(done) return; done=true;
      caches.match(req).then(function(c){ resolve(c || fetch(req).catch(function(){ return new Response("",{status:504}); })); });
    }, 4000);
    fetch(req).then(function(r){
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
