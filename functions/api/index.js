// Cloudflare Worker (index.js)
const KV_KEY = 'shopping_list';

function sortItems(a, b) {
    // ... (função de ordenação) ...
    const cleanA = a.nome.replace(/^[^a-zA-Z\d\s]+/, '').trim().toLowerCase();
    const cleanB = b.nome.replace(/^[^a-zA-Z\d\s]+/, '').trim().toLowerCase();
    return cleanA.localeCompare(cleanB, 'pt-BR', { sensitivity: 'base' });
}

async function handleGetRequest(env) {
    try {
        // ATENÇÃO: env.SHOPPING_LIST_KV deve ser o NOME DO SEU BINDING
        const value = await env.SHOPPING_LIST_KV.get(KV_KEY, { type: 'text' }); 

        if (value === null) {
            return new Response('[]', { 
                status: 200,
                headers: { 'Content-Type': 'application/json' } 
            });
        }
        
        return new Response(value, {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (e) {
        // ... (tratamento de erro) ...
    }
}

// ... (resto do Worker) ...
export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        if (url.pathname === '/api/saved_items') {
            switch (request.method) {
                case 'GET':
                    return handleGetRequest(env);
                // ... (outros métodos) ...
                default:
                    return new Response('Método não permitido.', { status: 405 });
            }
        }
        return new Response('Not Found', { status: 404 });
    },
};
