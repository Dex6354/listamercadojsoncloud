const CACHE_NAME = 'meu-mercado-editando-cache-v3'; // MUDANÇA: Aumentei a versão para forçar a atualização
const urlsToCache = [
  '/',
  'index.html', // CORREÇÃO: Usar o nome do arquivo HTML explicitamente
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/webfonts/fa-brands-400.woff2',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/webfonts/fa-solid-900.woff2', // Adicionando a fonte Solid para ícones
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
        // Filtra o '/index' que estava incorreto no original
        return cache.addAll(urlsToCache.filter(url => url !== '/index'));
      })
  );
});

// Evento de Fetch: Intercepta as requisições.
self.addEventListener('fetch', event => {
  // CORREÇÃO CRÍTICA: Para a API de listagem e o iFrame do Streamlit, use a estratégia Network-Only.
  // Isso impede que o Service Worker retorne dados antigos do cache.
  if (event.request.url.includes('/api/list') || event.request.url.includes('streamlit.app')) {
    return event.respondWith(
      fetch(event.request).catch(error => {
        // Se a rede falhar, é o comportamento esperado para o modo offline (o código JS lida com isso)
        console.log(`[Service Worker] API ou iFrame não carregou em modo offline.`, error);
        // Retorna um erro que será tratado pelo código JS para evitar travamento
        return new Response(null, { status: 503, statusText: 'Service Unavailable (Offline)' });
      })
    );
  }
  
  // Para outros ativos (CSS, JS, Fonts), mantém a estratégia Cache-First
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
                // Não armazena API, apenas assets estáticos (por isso a filtragem acima é importante)
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
