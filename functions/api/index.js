/**
 * Cloudflare Worker (api/index.js)
 * Conecta ao KV Namespace "SHOPPING_LIST_KV" e usa a chave "shopping_list".
 */

// Chave onde o array JSON completo será salvo dentro do KV Namespace
const KV_KEY = 'shopping_list';

// Função de Ordenação: Mantém a lista sempre em ordem alfabética.
function sortItems(a, b) {
    const cleanA = a.nome.replace(/^[^a-zA-Z\d\s]+/, '').trim().toLowerCase();
    const cleanB = b.nome.replace(/^[^a-zA-Z\d\s]+/, '').trim().toLowerCase();
    return cleanA.localeCompare(cleanB, 'pt-BR', { sensitivity: 'base' });
}

// Lida com requisições PUT para salvar a lista completa
async function handlePutRequest(request, env) {
    try {
        const items = await request.json();

        if (!Array.isArray(items)) {
            return new Response('Corpo da requisição deve ser um array JSON.', { status: 400 });
        }
        
        // 1. Ordena os itens antes de salvar
        const sortedItems = items.sort(sortItems);

        // 2. Salva o array JSON na chave única
        await env.SHOPPING_LIST_KV.put(KV_KEY, JSON.stringify(sortedItems));
        
        return new Response(JSON.stringify({ message: 'Lista salva com sucesso e ordenada.' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (e) {
        console.error('Erro no PUT:', e);
        return new Response(`Erro interno do servidor: ${e.message}`, { status: 500 });
    }
}

// Lida com requisições GET para buscar a lista
async function handleGetRequest(env) {
    try {
        // Busca o valor da chave no KV como texto
        const value = await env.SHOPPING_LIST_KV.get(KV_KEY, { type: 'text' });

        if (value === null) {
            // Se a chave não existir, retorna lista vazia []
            return new Response('[]', { 
                status: 200,
                headers: { 'Content-Type': 'application/json' } 
            });
        }
        
        // Retorna o conteúdo JSON (já ordenado pelo último PUT)
        return new Response(value, {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (e) {
        console.error('Erro no GET:', e);
        return new Response(`Erro interno do servidor: ${e.message}`, { status: 500 });
    }
}

// Ponto de entrada do Cloudflare Worker
export default {
    /**
     * @param {Request} request
     * @param {Env} env
     */
    async fetch(request, env) {
        const url = new URL(request.url);

        if (url.pathname === '/api/saved_items') {
            switch (request.method) {
                case 'GET':
                    return handleGetRequest(env);
                case 'PUT':
                    return handlePutRequest(request, env);
                default:
                    return new Response('Método não permitido.', { status: 405 });
            }
        }

        return new Response('Not Found', { status: 404 });
    },
};
