const CACHE_NAME = 'meu-treino-cache-v1';
const urlsToCache = [
  '/',
  '/index',
  '/sobre',
  '/todos_exercicios',
  '/biblioteca_de_treinos',
  '/personal_trainer',
  '/exercicios_completo.json',
  '/img/favicon.png',
  '/img/icone_treino.jpg',
  'https://hits.sh/meutreinoapp.pages.dev.svg?label=Total%20de%20Treinos&extraCount=1770&color=ffc107&labelColor=a0a0a0',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/webfonts/fa-brands-400.woff2',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/sortablejs@1.14.0/Sortable.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/lz-string/1.4.4/lz-string.min.js'
];

// Evento de Instalação: Abre o cache e armazena os arquivos principais.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache aberto');
        return cache.addAll(urlsToCache);
      })
  );
});

// Evento de Fetch: Intercepta as requisições.
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Se a resposta estiver no cache, retorna do cache.
        if (response) {
          return response;
        }
        // Se não, busca na rede, clona, armazena no cache e retorna.
        return fetch(event.request).then(
          (response) => {
            // Verifica se recebemos uma resposta válida
            if(!response || response.status !== 200 || response.type !== 'basic' && response.type !== 'cors') {
              return response;
            }

            var responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return response;
          }
        );
      })
  );
});

// Opcional: Limpa caches antigos em uma nova ativação
self.addEventListener('activate', event => {
  var cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
