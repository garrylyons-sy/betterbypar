const CACHE_NAME = "better-by-par-blue-v2";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", () => {
  // Keep network behaviour unchanged while making the app installable.
});

function notificationHref(value) {
  try {
    if(typeof value!=="string" || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020\u007f]/.test(value)) return "/";
    const url=new URL(value,self.location.origin);
    return url.origin===self.location.origin ? url.pathname+url.search+url.hash : "/";
  } catch { return "/"; }
}

self.addEventListener("push", (event) => {
  let message={};
  try { message=event.data ? event.data.json() : {}; } catch { return; }
  if(!message || typeof message!=="object") return;
  if(message.expiresAt && (!Number.isFinite(new Date(message.expiresAt).getTime()) || new Date(message.expiresAt).getTime()<=Date.now())) return;
  event.waitUntil(self.registration.showNotification(typeof message.title==="string" ? message.title : "Better By Par", {
    body:typeof message.body==="string" ? message.body : "",
    tag:typeof message.tag==="string" ? message.tag : undefined,
    icon:"/icons/icon-192.png",
    data:{href:notificationHref(message.href)}
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href=notificationHref(event.notification.data?.href);
  event.waitUntil(self.clients.matchAll({type:"window",includeUncontrolled:true}).then(async (windows)=>{
    for(const client of windows){
      const url=new URL(client.url);
      if(url.origin===self.location.origin && url.pathname==="/"){
        await client.focus();
        const handled=await new Promise(resolve=>{
          const channel=new MessageChannel();
          const timer=setTimeout(()=>{channel.port1.close();resolve(false);},1500);
          channel.port1.onmessage=event=>{
            if(event.data?.handled!==true)return;
            clearTimeout(timer);channel.port1.close();resolve(true);
          };
          client.postMessage({type:"interclub:open-notification",href},[channel.port2]);
        });
        // Older or still-loading app windows cannot handle in-app navigation yet.
        if(!handled)await client.navigate(href);
        return;
      }
    }
    return self.clients.openWindow(href);
  }));
});
