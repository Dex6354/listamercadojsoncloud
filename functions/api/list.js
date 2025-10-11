/* list.js - Implementação para Cloudflare D1 */

// A interface D1 não suporta campos booleanos nativamente
// então usamos INTEGER (0 para false, 1 para true).

export async function onRequestGet({ env }) {
    // 1. SELECT: Busca todos os itens da lista, ordenando para exibir primeiro os não comprados.
    try {
        const { results } = await env.nomebcd1.prepare( // ATUALIZADO
            `SELECT 
                item AS name, 
                shibata AS priceShibata, 
                nagumo AS priceNagumo, 
                purchased, 
                id
            FROM nometabela  -- ATUALIZADO
            ORDER BY purchased ASC, id DESC`
        ).all();

        // 2. Mapeia os resultados para o formato esperado pelo frontend (converte purchased de INTEGER para BOOLEAN)
        const items = results.map(row => ({
            name: row.name,
            priceShibata: row.priceShibata,
            priceNagumo: row.priceNagumo,
            purchased: row.purchased === 1, // Converte 0/1 para false/true
            id: row.id // Inclui o ID para operações de exclusão/atualização
        }));

        return new Response(JSON.stringify(items), { 
            headers: { 'Content-Type': 'application/json' } 
        });

    } catch (error) {
        console.error("Erro ao buscar lista do D1:", error);
        return new Response(JSON.stringify([]), { // Retorna lista vazia em caso de erro
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

export async function onRequestPost({ request, env }) {
    try {
        // Recebe o array completo de itens do frontend
        const items = await request.json();

        // 1. Inicia uma transação para garantir que a atualização seja atômica
        // (excluir tudo e reinserir, ou atualizar o que existe, é mais simples do que lidar com diffs complexos)

        // 2. DROP & CREATE: Limpa a tabela e insere o novo estado
        // Esta é a maneira mais simples de "salvar o estado" quando o frontend envia a lista completa.
        // **Alternativa mais performática:** Fazer um diff (INSERT, UPDATE, DELETE) no D1. Para este caso,
        // o "limpar e reinserir" é aceitável, mas pode ser lento para listas muito longas.

        await env.nomebcd1.batch([ // ATUALIZADO
            // Exclui todos os itens existentes
            env.nomebcd1.prepare(`DELETE FROM nometabela`), // ATUALIZADO
            
            // Prepara as inserções dos novos itens
            ...items.map(item => env.nomebcd1.prepare( // ATUALIZADO
                `INSERT INTO nometabela (item, shibata, nagumo, purchased)  -- ATUALIZADO
                 VALUES (?, ?, ?, ?)`
            ).bind(
                item.name, 
                item.priceShibata || 'R$ 0,00', 
                item.priceNagumo || 'R$ 0,00', 
                item.purchased ? 1 : 0 // Converte boolean para 0/1
            ))
        ]);

        return new Response(JSON.stringify({ success: true }), { 
            headers: { 'Content-Type': 'application/json' } 
        });

    } catch (error) {
        console.error("Erro ao salvar lista no D1:", error);
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
