// src/worker.js

// O binding SHOPPING_LIST_KV é definido no wrangler.toml
// e acessa o seu namespace KV.

// A chave que buscamos é "shopping_list"
const KV_KEY = "shopping_list";

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  let listaJSON = '[]';
  
  try {
    // 1. Acessa o KV com o binding definido no wrangler.toml
    // Tenta obter a chave "shopping_list" como texto
    const kvResult = await SHOPPING_LIST_KV.get(KV_KEY);

    if (kvResult) {
      listaJSON = kvResult;
    } else {
      console.log(`Chave '${KV_KEY}' não encontrada no KV.`);
      // Se não encontrar, retorna uma lista vazia ou um erro
      listaJSON = '[]'; 
    }
  } catch (error) {
    console.error("Erro ao acessar Cloudflare KV:", error);
    listaJSON = '[]'; // Em caso de falha na busca, retorna vazio
  }

  // 2. Prepara o conteúdo HTML, injetando o JSON obtido.
  const htmlContent = generateHtml(listaJSON);

  // 3. Retorna a resposta HTML
  return new Response(htmlContent, {
    headers: { 
      'content-type': 'text/html;charset=UTF-8' 
    },
  })
}

/**
 * Função que gera a página HTML, injetando o JSON do KV
 * @param {string} jsonString - O JSON da lista de compras (string)
 */
function generateHtml(jsonString) {
  // Escapa aspas simples e barras invertidas para garantir que o JSON
  // seja injetado corretamente dentro do JS (string) do HTML.
  const escapedJson = jsonString.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Lista de Compras Cloudflare KV</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f4f4f9; }
        .container { max-width: 600px; margin: auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
        h1 { color: #333; text-align: center; border-bottom: 2px solid #ccc; padding-bottom: 10px; }
        ul { list-style: none; padding: 0; }
        li { padding: 10px; border-bottom: 1px solid #eee; cursor: pointer; transition: background-color 0.3s; }
        li:last-child { border-bottom: none; }
        li:hover { background-color: #eef; }
        .comprado { text-decoration: line-through; color: #888; background-color: #fafafa; }
        .instrucao { text-align: center; margin-top: 15px; font-size: 0.9em; color: #666; }
    </style>
</head>
<body>

    <div class="container">
        <h1>Lista de Compras (KV Dinâmico)</h1>
        <p class="instrucao">Dados carregados diretamente do Cloudflare KV.</p>
        <ul id="lista-compras">
            </ul>
    </div>

    <script>
        // 1. O JSON é injetado diretamente pelo Cloudflare Worker
        const listaComprasJsonString = '${escapedJson}';
        let dadosLista;
        
        try {
            dadosLista = JSON.parse(listaComprasJsonString);
        } catch (e) {
            console.error("Erro ao parsear JSON injetado:", e);
            dadosLista = [];
        }

        // Função para carregar e exibir a lista
        function carregarLista() {
            const listaUl = document.getElementById('lista-compras');
            listaUl.innerHTML = ''; 

            if (dadosLista.length === 0) {
                listaUl.innerHTML = '<li>Nenhum item encontrado no KV. Verifique a chave "shopping_list".</li>';
                return;
            }

            dadosLista.forEach(item => {
                const li = document.createElement('li');
                li.textContent = item.nome;
                
                // Adiciona a funcionalidade de marcar como comprado
                li.addEventListener('click', function() {
                    li.classList.toggle('comprado');
                });
                
                listaUl.appendChild(li);
            });
        }

        // Carrega a lista quando o script é executado
        carregarLista();
    </script>

</body>
</html>
`;
}
