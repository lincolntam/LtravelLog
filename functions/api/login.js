export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        // 1. 取得前端傳來的 JSON 資料
        const { email, password } = await request.json();

        // 2. 基本欄位檢查
        if (!email || !password) {
            return new Response(
                JSON.stringify({ error: "請填寫 Email 和密碼" }), 
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        // 3. 檢查環境變數中的資料庫是否已綁定 (變數名稱必須為 DB)
        if (!env.DB) {
            console.error("D1 Database binding 'DB' is missing.");
            return new Response(
                JSON.stringify({ error: "資料庫連線未設定 (Database binding missing)" }), 
                { status: 500, headers: { "Content-Type": "application/json" } }
            );
        }

        // 4. 從 D1 資料庫查詢用戶
        const user = await env.DB.prepare(
            "SELECT * FROM users WHERE email = ?"
        ).bind(email).first();

        // 5. 驗證邏輯
        if (!user) {
            // 用戶不存在
            return new Response(
                JSON.stringify({ error: "找不到此帳戶，請先註冊" }), 
                { status: 401, headers: { "Content-Type": "application/json" } }
            );
        }

        if (user.password === password) {
            // 登入成功
            return new Response(
                JSON.stringify({ message: "登入成功", status: "success" }), 
                { status: 200, headers: { "Content-Type": "application/json" } }
            );
        } else {
            // 密碼錯誤
            return new Response(
                JSON.stringify({ error: "密碼不正確" }), 
                { status: 401, headers: { "Content-Type": "application/json" } }
            );
        }

    } catch (err) {
        // 捕捉未知的系統錯誤 (例如 JSON 解析失敗或 SQL 報錯)
        console.error("Login API Error:", err);
        return new Response(
            JSON.stringify({ error: "伺服器內部錯誤: " + err.message }), 
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
}
