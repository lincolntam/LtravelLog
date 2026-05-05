export async function onRequest(context) {
  // 從 Cloudflare Pages 的環境變數中讀取金鑰
  // 變數名稱必須與你在 Cloudflare Settings 裡設定的一模一樣
  const apiKey = context.env.Maps_API_KEY;

  if (!apiKey) {
    return new Response(JSON.stringify({ error: "API Key not found in environment" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  return new Response(JSON.stringify({ Maps_API_KEY: apiKey }), {
    headers: { 
      "Content-Type": "application/json",
      "Cache-Control": "no-store" 
    }
  });
}
