
// functions/api/list.js

const LIST_KEY = "shopping_list";

export async function onRequestGet({ env }) {
  const listJson = await env.SHOPPING_LIST_KV.get(LIST_KEY);
  if (!listJson) {
    return new Response('[]', { headers: { 'Content-Type': 'application/json' } });
  }
  return new Response(listJson, { headers: { 'Content-Type': 'application/json' } });
}

export async function onRequestPost({ request, env }) {
  try {
    const newListJson = await request.text();
    await env.SHOPPING_LIST_KV.put(LIST_KEY, newListJson);
    return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
      }/**
 * Cloudflare Worker (functions/api/index.js)
 * Agora o endpoint externo será /functions/api/saved_items
 */

const KV_KEY = 'shopping_list';

function sortItems(a, b) {
    const cleanA = a.nome.replace(/^[^a-zA-Z\d\s]+/, '').trim().toLowerCase();
    const cleanB = b.nome.replace(/^[^a-zA-Z\d\s]+/, '').trim().toLowerCase();
    return cleanA.localeCompare(cleanB, 'pt-BR', { sensitivity: 'base' });
}

async function handlePutRequest(request, env) {
    try {
        const items = await request.json();
        
        // Uso do binding confirmado: env.SHOPPING_LIST_KV
        await env.SHOPPING_LIST_KV.put(KV_KEY, JSON.stringify(items.sort(sortItems)));
        
        return new Response(JSON.stringify({ message: 'Lista salva com sucesso.' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (e) {
        console.error('Erro no PUT:', e);
        return new Response(`Erro interno do servidor: ${e.message}`, { status: 500 });
    }
}

async function handleGetRequest(env) {
    try {
        // Uso do binding confirmado: env.SHOPPING_LIST_KV
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
        console.error('Erro no GET:', e);
        return new Response(`Erro no Worker ao buscar dados: ${e.message}`, { status: 500 });
    }
}

// Ponto de entrada do Cloudflare Worker
export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        // O Worker precisa verificar a rota que ele espera receber do frontend
        // O caminho da URL será: /functions/api/saved_items
        if (url.pathname === '/functions/api/saved_items') {
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
