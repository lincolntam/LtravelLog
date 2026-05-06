import { clearSessionHeaders, json } from "../_utils/auth.js";

export async function onRequestPost() {
    return json({ message: "Logged out" }, 200, clearSessionHeaders());
}
