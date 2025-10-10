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
}
