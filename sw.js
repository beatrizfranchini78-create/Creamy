const CACHE_NAME = "creamy-v2";

const ARQUIVOS = [
    "./",
    "./index.html",
    "./style.css",
    "./manifest.json"
];

self.addEventListener("install", function (event) {

    self.skipWaiting();

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(function (cache) {
                return cache.addAll(ARQUIVOS);
            })
    );

});


self.addEventListener("activate", function (event) {

    event.waitUntil(

        caches.keys().then(function (nomes) {

            return Promise.all(

                nomes
                    .filter(function (nome) {
                        return nome !== CACHE_NAME;
                    })
                    .map(function (nome) {
                        return caches.delete(nome);
                    })

            );

        }).then(function () {

            return self.clients.claim();

        })

    );

});


self.addEventListener("fetch", function (event) {

    const url = new URL(event.request.url);

    if (url.origin !== self.location.origin) {
        return;
    }

    event.respondWith(

        fetch(event.request)
            .then(function (resposta) {

                const copia =
                    resposta.clone();

                caches.open(CACHE_NAME)
                    .then(function (cache) {

                        cache.put(
                            event.request,
                            copia
                        );

                    });

                return resposta;

            })
            .catch(function () {

                return caches.match(
                    event.request
                );

            })

    );

});
