// /functions/api/list.js

/**
 * Função para obter o ID do usuário a partir de um token de autorização
 */
async function getUserIdFromToken(request, env) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    const token = authHeader.split(' ')[1];
    const now = Math.floor(Date.now() / 1000);

    const session = await env.nomevariavel.prepare(
        `SELECT user_id FROM sessions WHERE token = ? AND expires_at > ?`
    ).bind(token, now).first();

    return session ? session.user_id : null;
}

/**
 * Handler para buscar a lista (GET)
 */
export async function onRequestGet({ request, env }) {
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

/**
 * Handler para salvar a lista (POST)
 */
export async function onRequestPost({ request, env }) {
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
