// /functions/api/list.js

/**
 * Obtém o ID do usuário a partir do token de autorização.
 * Esta função permanece a mesma.
 */
async function getUserIdFromToken(request, env) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    const token = authHeader.split(' ')[1];
    const now = Math.floor(Date.now() / 1000);

    // Assumindo que 'nomevariavel' é o nome do seu binding para o D1
    const session = await env.nomevariavel.prepare(
        `SELECT user_id FROM sessions WHERE token = ? AND expires_at > ?`
    ).bind(token, now).first();

    return session ? session.user_id : null;
}

/**
 * Handler para buscar a lista (GET).
 * CORRIGIDO: Agora seleciona o 'id' de cada item, que é crucial para o frontend.
 */
export async function onRequestGet({ request, env }) {
    const userId = await getUserIdFromToken(request, env);
    if (!userId) {
        return new Response(JSON.stringify({ message: 'Não autorizado' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    const { results } = await env.nomevariavel.prepare(
        // Adicionamos a coluna 'id' à consulta SELECT
        `SELECT id, item AS name, shibata AS priceShibata, nagumo AS priceNagumo, purchased 
         FROM nometabela WHERE user_id = ?`
    ).bind(userId).all();

    // Mapeia o resultado para o formato esperado pelo frontend (purchased: 1 -> true)
    const items = results.map(row => ({
        ...row,
        purchased: row.purchased === 1,
    }));

    return new Response(JSON.stringify(items), { headers: { 'Content-Type': 'application/json' } });
}

/**
 * Handler para salvar/mesclar a lista (POST).
 * CORRIGIDO: Implementa a lógica de "merge" (fusão) em vez de "delete all/insert all".
 */
export async function onRequestPost({ request, env }) {
    const userId = await getUserIdFromToken(request, env);
    if (!userId) {
        return new Response(JSON.stringify({ message: 'Não autorizado' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    // 1. Recebe a lista de itens do cliente
    const clientList = await request.json();
    if (!Array.isArray(clientList)) {
        return new Response(JSON.stringify({ message: 'Corpo da requisição inválido' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // 2. Busca os IDs de todos os itens que o usuário tem atualmente no banco de dados
    const serverItemsResult = await env.nomevariavel.prepare(
        `SELECT id FROM nometabela WHERE user_id = ?`
    ).bind(userId).all();
    const serverItemIds = new Set(serverItemsResult.results.map(item => item.id));
    const clientItemIds = new Set(clientList.map(item => item.id));

    // 3. Determina quais itens foram deletados pelo cliente
    const idsToDelete = [...serverItemIds].filter(id => !clientItemIds.has(id));

    // 4. Prepara uma lista de operações (statements) para executar em uma única transação (batch)
    const statements = [];

    // 4a. Adiciona a operação de exclusão, se houver itens para deletar
    if (idsToDelete.length > 0) {
        // Cria uma string de placeholders (?,?,?) para a cláusula IN
        const placeholders = idsToDelete.map(() => '?').join(',');
        const deleteStmt = env.nomevariavel.prepare(
            `DELETE FROM nometabela WHERE user_id = ? AND id IN (${placeholders})`
        ).bind(userId, ...idsToDelete);
        statements.push(deleteStmt);
    }

    // 4b. Prepara a operação de "UPSERT" (Update or Insert) para cada item da lista do cliente
    // A cláusula ON CONFLICT (id) DO UPDATE... só funciona se 'id' for a PRIMARY KEY.
    const upsertSql = `
        INSERT INTO nometabela (id, user_id, item, shibata, nagumo, purchased)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT (id) DO UPDATE SET
            item = excluded.item,
            shibata = excluded.shibata,
            nagumo = excluded.nagumo,
            purchased = excluded.purchased
    `;
    
    clientList.forEach(item => {
        // Ignora itens sem ID ou nome, para segurança
        if (!item.id || !item.name) return;

        statements.push(
            env.nomevariavel.prepare(upsertSql).bind(
                item.id,
                userId,
                item.name,
                item.priceShibata || 'R$ 0,00',
                item.priceNagumo || 'R$ 0,00',
                item.purchased ? 1 : 0
            )
        );
    });

    // 5. Executa todas as operações (deletes e upserts) em uma única transação atômica
    if (statements.length > 0) {
        await env.nomevariavel.batch(statements);
    }

    // 6. Após a fusão, busca a lista consolidada e final do banco de dados para retornar ao cliente.
    // Isso garante que a tela do cliente seja atualizada com o estado mais recente e correto.
    const finalResult = await env.nomevariavel.prepare(
        `SELECT id, item AS name, shibata AS priceShibata, nagumo AS priceNagumo, purchased 
         FROM nometabela WHERE user_id = ?`
    ).bind(userId).all();
    
    const mergedList = finalResult.results.map(row => ({
        ...row,
        purchased: row.purchased === 1,
    }));

    return new Response(JSON.stringify(mergedList), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
