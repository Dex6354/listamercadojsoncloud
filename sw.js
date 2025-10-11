// Aumentamos a versão do cache para forçar o navegador a instalar o novo Service Worker
const CACHE_NAME = 'meu-mercado-editando-cache-v4'; 
const urlsToCache = [
  '/', 
  'index.html', // Garante que o arquivo HTML seja cacheado para carregamento offline
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/webfonts/fa-brands-400.woff2',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/webfonts/fa-solid-900.woff2', 
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/sortablejs@1.14.0/Sortable.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/lz-string/1.4.4/lz-string.min.js'
];

// Evento de Instalação: Abre o cache e armazena os arquivos principais.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW v4] Cache aberto. Adicionando ativos estáticos.');
        return cache.addAll(urlsToCache);
      })
      .catch(err => {
        console.error('[SW v4] Falha ao adicionar URLs ao cache:', err);
      })
  );
});

// Evento de Fetch: Intercepta as requisições.
self.addEventListener('fetch', event => {
  
  // ESTRATÉGIA: NETWORK-ONLY
  // Para a API de listagem e o iFrame (dados dinâmicos), SEMPRE tente a rede.
  // Isso impede que o Service Worker retorne dados antigos.
  if (event.request.url.includes('/api/list') || event.request.url.includes('streamlit.app')) {
    return event.respondWith(
      fetch(event.request).catch(error => {
        // Quando a rede falhar (OFFLINE), o Service Worker retornará um erro, 
        // e o código JavaScript em index.html usará o localStorage.
        console.log(`[SW v4] API/iFrame falhou (Offline). Deixando o código JS usar o localStorage.`, error);
        return new Response(null, { status: 503, statusText: 'Service Unavailable (Offline)' });
      })
    );
  }

  // ESTRATÉGIA: CACHE-FIRST
  // Para outros ativos (HTML, CSS, JS, Fonts), usa o cache primeiro.
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response; // Retorna do cache se encontrado.
        }
        
        // Se não estiver no cache, busca na rede e armazena.
        return fetch(event.request).then(
          (response) => {
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

// Evento de Ativação: Limpa caches antigos
self.addEventListener('activate', event => {
  console.log('[SW v4] Ativando cache v4 e limpando versões antigas.');
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
