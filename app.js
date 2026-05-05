/**
 * LTravelLog - App Logic v0.40.4
 * 整合 Cloudflare 變數與 Google Maps 導航
 */

let map;
let isReturnMode = false;

// 1. 初始化 Google Maps
function initMap() {
    const hkCenter = { lat: 22.3193, lng: 114.1694 };
    
    map = new google.maps.Map(document.getElementById("map"), {
        center: hkCenter,
        zoom: 14,
        disableDefaultUI: true,
        gestureHandling: "greedy",
        styles: [
            { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] }
        ]
    });

    // 啟動 UI
    setTimeout(() => goToStep(1), 500);
}

// 2. 切換 UI 步驟
function goToStep(step) {
    document.querySelectorAll('.ui-step').forEach(el => el.classList.remove('active'));
    const target = document.getElementById(`step-${step}`);
    if (target) target.classList.add('active');

    if (step === 3) calculate();
}

// 3. 處理行程節點 (保留原有功能)
function addNode() {
    const container = document.getElementById('nodes-container');
    const input = document.createElement('input');
    input.className = 'node-input';
    input.placeholder = '中途站站點...';
    input.oninput = calculate;
    container.appendChild(input);
}

function toggleReturn() {
    isReturnMode = !isReturnMode;
    const btn = document.getElementById('retBtn');
    btn.style.backgroundColor = isReturnMode ? '#dcfce7' : '#f1f5f9';
    btn.style.color = isReturnMode ? '#10B981' : '#64748b';
    calculate();
}

// 4. 核心計算邏輯 (整合能源方案)
function calculate() {
    const carModel = document.getElementById('car-model');
    if (!carModel) return;

    // 解析 "耗電率|單價" 格式
    const [rate, price] = carModel.value.split('|').map(parseFloat);

    // 模擬計算數據 (實際應用中可對接 Directions API)
    let distance = 12.8; 
    if (isReturnMode) distance *= 2;

    const energyCost = distance * rate * price;
    const tunnelFee = isReturnMode ? 50 : 25; // 模擬隧道費

    // 更新介面數值
    updateUI('km', distance.toFixed(1) + " km");
    updateUI('t-fee', "$" + tunnelFee);
    updateUI('e-cost', "$" + energyCost.toFixed(1));
    updateUI('total', (energyCost + tunnelFee).toFixed(1));
}

function updateUI(id, val) {
    const el = document.getElementById(id);
    if (el) el.innerText = val;
}

// 5. 登出與生命週期
window.initMap = initMap;

window.onerror = function(msg, url, line) {
    console.error(`LTravelLog Error: ${msg} on line ${line}`);
    return false;
};
