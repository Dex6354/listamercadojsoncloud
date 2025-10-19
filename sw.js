// sw.js
// Aumentamos a versão do cache para forçar o navegador a instalar o novo Service Worker
// IMPORTANTE: Mude para 'meu-mercado-cache-v3' para forçar a limpeza do cache antigo!
const CACHE_NAME = 'meu-mercado-cache-v3'; 
const urlsToCache = [
  '/', 
  'index.html',
  'itens.json',
  '01.png',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/webfonts/fa-brands-400.woff2',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/webfonts/fa-solid-900.woff2', 
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/sortablejs@1.14.0/Sortable.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/lz-string/1.4.4/lz-string.min.js'
];

// Evento de Instalação: Abre o cache e armazena os arquivos principais (agora sem itens.json).
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW v5] Cache aberto. Adicionando ativos estáticos (sem itens.json).');
        return cache.addAll(urlsToCache);
      })
      .catch(err => {
        console.error('[SW v5] Falha ao adicionar URLs ao cache:', err);
      })
  );
});

// Evento de Fetch: Intercepta as requisições.
self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);
  const path = requestUrl.pathname;

  // ESTRATÉGIA 1: NETWORK-ONLY
  // Para a API de listagem e o iFrame (dados dinâmicos), SEMPRE tente a rede.
  if (event.request.url.includes('/api/list') || event.request.url.includes('streamlit.app')) {
    return event.respondWith(
      fetch(event.request).catch(error => {
        console.log(`[SW v5] API/iFrame falhou (Offline). Deixando o código JS usar o localStorage.`, error);
        return new Response(null, { status: 503, statusText: 'Service Unavailable (Offline)' });
      })
    );
  }

  // ESTRATÉGIA 2: STALE-WHILE-REVALIDATE (SWR) para itens.json
  // Serve a versão em cache imediatamente, enquanto busca a nova versão em segundo plano.
  if (path.endsWith('/itens.json')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache => {
        return cache.match(event.request).then(response => {
          
          // Tenta a rede, mesmo que haja resposta no cache.
          const fetchPromise = fetch(event.request).then(networkResponse => {
            if (networkResponse.ok) {
              // Atualiza o cache com a nova versão
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(error => {
            // Se a rede falhar, e não houver cache para retornar, o código aqui não é necessário,
            // pois o cache.match abaixo já cobre o cenário. Mas deixamos a mensagem.
            console.log("[SW v5] itens.json: Falha na rede durante o revalidate.", error);
          });
          
          // Se tiver cache, retorna o cache (STALE) e deixa a rede revalidar.
          // Se não tiver cache, aguarda a rede (o fetchPromise).
          return response || fetchPromise;
        });
      })
    );
    return; // Para o fluxo de fetch para itens.json
  }

  // ESTRATÉGIA 3: CACHE-FIRST
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
  console.log('[SW v5] Ativando cache v5 e limpando versões antigas.');
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
