/* list.js - Implementação para Cloudflare D1 com usuários */

// Função para criar o hash da senha (seguro!)
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// NOVO: Endpoint para registrar um usuário
export async function onRegisterPost({ request, env }) {
    const { username, password } = await request.json();

    if (!username || !password) {
        return new Response('Usuário e senha são obrigatórios', { status: 400 });
    }

    const passwordHash = await hashPassword(password);

    try {
        await env.nomevariavel.prepare(
            `INSERT INTO usuarios (username, password_hash) VALUES (?, ?)`
        ).bind(username, passwordHash).run();

        return new Response(JSON.stringify({ success: true, message: 'Usuário criado!' }), { status: 201 });
    } catch (e) {
        // Verifica se o erro é de usuário duplicado
        if (e.message.includes('UNIQUE constraint failed')) {
            return new Response('Este nome de usuário já existe.', { status: 409 });
        }
        return new Response('Erro ao criar usuário.', { status: 500 });
    }
}


// ATUALIZADO: Buscar a lista (agora precisa saber QUAL usuário)
export async function onRequestGet({ request, env }) {
    // AQUI VIRIA A LÓGICA PARA PEGAR O ID DO USUÁRIO LOGADO
    // Por exemplo, a partir de um token no cabeçalho `Authorization`
    const userId = 1; // Exemplo fixo, isso teria que ser dinâmico

    try {
        const { results } = await env.nomevariavel.prepare(
            `SELECT item AS name, shibata, nagumo, purchased 
             FROM nometabela 
             WHERE user_id = ?` // <-- A MÁGICA ACONTECE AQUI
        ).bind(userId).all();
        
        // ... resto do código para formatar a resposta
        // ...
    } catch (e) {
        // ...
    }
}

// ... onRequestPost também seria atualizado para usar o user_id ...

// Você precisaria adicionar rotas para chamar onRegisterPost, onLoginPost etc.
// Isso geralmente é feito no arquivo _routes.json ou diretamente no dashboard.
