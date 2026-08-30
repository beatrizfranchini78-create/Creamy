const CACHE_NAME = "creamy-v1";

const ARQUIVOS = [
    "./",
    "./index.html",
    "./style.css",
    "./script.js",
    "./manifest.json"
];

self.addEventListener("install", evento => {

    evento.waitUntil(

        caches.open(CACHE_NAME)
            .then(cache => {

                return cache.addAll(ARQUIVOS);

            })

    );

});


self.addEventListener("activate", evento => {

    evento.waitUntil(

        caches.keys()
            .then(chaves => {

                return Promise.all(

                    chaves
                        .filter(chave => chave !== CACHE_NAME)
                        .map(chave => caches.delete(chave))

                );

            })

    );

});


self.addEventListener("fetch", evento => {

    evento.respondWith(

        caches.match(evento.request)
            .then(resposta => {

                return resposta ||
                    fetch(evento.request);

            })
            .catch(() => {

                return caches.match("./index.html");

            })

    );

});
