/* list.js - Implementação completa para Cloudflare D1 com autenticação de usuário
*/

// --- FUNÇÕES DE UTILIDADE E SEGURANÇA ---

// Função para criar o hash da senha (armazenamento seguro)
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Função para obter o ID do usuário a partir de um token de autorização
async function getUserIdFromToken(request, env) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    const token = authHeader.split(' ')[1];

    const now = Math.floor(Date.now() / 1000);

    // Busca a sessão no banco de dados que não tenha expirado
    const session = await env.nomevariavel.prepare(
        `SELECT user_id FROM sessions WHERE token = ? AND expires_at > ?`
    ).bind(token, now).first();

    return session ? session.user_id : null;
}


// --- HANDLERS DAS ROTAS DA API ---

async function handleRegister(request, env) {
    const { username, password } = await request.json();

    if (!username || !password) {
        return new Response(JSON.stringify({ message: 'Usuário e senha são obrigatórios' }), { status: 400 });
    }

    const passwordHash = await hashPassword(password);

    try {
        await env.nomevariavel.prepare(
            `INSERT INTO usuarios (username, password_hash) VALUES (?, ?)`
        ).bind(username, passwordHash).run();

        return new Response(JSON.stringify({ success: true, message: 'Usuário criado com sucesso!' }), { status: 201 });
    } catch (e) {
        if (e.message.includes('UNIQUE constraint failed')) {
            return new Response(JSON.stringify({ message: 'Este nome de usuário já existe.' }), { status: 409 });
        }
        console.error("Erro no registro:", e);
        return new Response(JSON.stringify({ message: 'Erro interno ao criar usuário.' }), { status: 500 });
    }
}

async function handleLogin(request, env) {
    const { username, password } = await request.json();

    if (!username || !password) {
        return new Response(JSON.stringify({ message: 'Usuário e senha são obrigatórios' }), { status: 400 });
    }
    
    const user = await env.nomevariavel.prepare(
        `SELECT id, password_hash FROM usuarios WHERE username = ?`
    ).bind(username).first();

    if (!user) {
        return new Response(JSON.stringify({ message: 'Usuário ou senha inválidos.' }), { status: 401 });
    }

    const passwordHash = await hashPassword(password);
    if (passwordHash !== user.password_hash) {
        return new Response(JSON.stringify({ message: 'Usuário ou senha inválidos.' }), { status: 401 });
    }

    // Se a senha estiver correta, crie uma sessão
    const token = crypto.randomUUID();
    const expires_at = Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7); // Expira em 7 dias

    await env.nomevariavel.prepare(
        `INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)`
    ).bind(token, user.id, expires_at).run();

    return new Response(JSON.stringify({ success: true, token: token }), { status: 200 });
}

async function handleLogout(request, env) {
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        await env.nomevariavel.prepare(`DELETE FROM sessions WHERE token = ?`).bind(token).run();
    }
    return new Response(JSON.stringify({ success: true, message: 'Logout realizado.' }), { status: 200 });
}


async function handleGetList(request, env) {
    const userId = await getUserIdFromToken(request, env);
    if (!userId) {
        return new Response(JSON.stringify({ message: 'Não autorizado' }), { status: 401 });
    }

    const { results } = await env.nomevariavel.prepare(
        `SELECT item AS name, shibata AS priceShibata, nagumo AS priceNagumo, purchased 
         FROM nometabela WHERE user_id = ? ORDER BY id DESC`
    ).bind(userId).all();

    const items = results.map(row => ({
        ...row,
        purchased: row.purchased === 1,
    }));

    return new Response(JSON.stringify(items), { headers: { 'Content-Type': 'application/json' } });
}

async function handleSaveList(request, env) {
    const userId = await getUserIdFromToken(request, env);
    if (!userId) {
        return new Response(JSON.stringify({ message: 'Não autorizado' }), { status: 401 });
    }

    const items = await request.json();

    const deleteStmt = env.nomevariavel.prepare(`DELETE FROM nometabela WHERE user_id = ?`).bind(userId);
    
    const insertStmts = items.map(item => env.nomevariavel.prepare(
        `INSERT INTO nometabela (item, shibata, nagumo, purchased, user_id) VALUES (?, ?, ?, ?, ?)`
    ).bind(
        item.name, 
        item.priceShibata || 'R$ 0,00', 
        item.priceNagumo || 'R$ 0,00', 
        item.purchased ? 1 : 0,
        userId
    ));

    await env.nomevariavel.batch([deleteStmt, ...insertStmts]);

    return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
}


// --- ROTEADOR PRINCIPAL ---

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        // Roteia para a função correta com base no caminho e no método HTTP
        if (url.pathname === '/api/register' && request.method === 'POST') {
            return handleRegister(request, env);
        }
        if (url.pathname === '/api/login' && request.method === 'POST') {
            return handleLogin(request, env);
        }
        if (url.pathname === '/api/logout' && request.method === 'POST') {
            return handleLogout(request, env);
        }
        if (url.pathname === '/api/list' && request.method === 'GET') {
            return handleGetList(request, env);
        }
        if (url.pathname === '/api/list' && request.method === 'POST') {
            return handleSaveList(request, env);
        }

        return new Response('Endpoint não encontrado', { status: 404 });
    }
};
