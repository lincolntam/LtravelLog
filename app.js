let map;
let isReturnMode = false;

// 1. 動態加載 Google Maps API (如果沒有在 HTML 寫死)
function loadGoogleMaps(apiKey) {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initMap`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
}

// 2. 初始化地圖
function initMap() {
    const hkCenter = { lat: 22.3193, lng: 114.1694 };
    map = new google.maps.Map(document.getElementById("map"), {
        center: hkCenter,
        zoom: 14,
        disableDefaultUI: true,
        gestureHandling: "greedy"
    });
    setTimeout(() => goToStep(1), 500);
}

// 3. UI 導航與功能
function goToStep(step) {
    document.querySelectorAll('.ui-step').forEach(el => el.classList.remove('active'));
    const target = document.getElementById(`step-${step}`);
    if (target) target.classList.add('active');
    if (step === 3) calculate();
}

function addNode() {
    const container = document.getElementById('nodes-container');
    const input = document.createElement('input');
    input.className = 'node-input';
    input.placeholder = '中途站站點';
    input.oninput = calculate;
    container.appendChild(input);
}

function toggleReturn() {
    isReturnMode = !isReturnMode;
    const btn = document.getElementById('retBtn');
    btn.style.color = isReturnMode ? '#10B981' : '#64748b';
    calculate();
}

// 4. 核心計算邏輯
function calculate() {
    const carData = document.getElementById('car-model').value.split('|');
    const rate = parseFloat(carData[0]); 
    const price = parseFloat(carData[1]);

    let dist = 12.5; // 模擬數據
    if (isReturnMode) dist *= 2;

    const energyCost = dist * rate * price;
    const tunnelFee = isReturnMode ? 50 : 25;

    document.getElementById('km').innerText = dist.toFixed(1) + " km";
    document.getElementById('e-cost').innerText = "$" + energyCost.toFixed(1);
    document.getElementById('t-fee').innerText = "$" + tunnelFee;
    document.getElementById('total').innerText = (energyCost + tunnelFee).toFixed(1);
}

// 這裡假設你從 Cloudflare 獲取 API KEY 的邏輯
// 如果你是直接在打包時替換，請直接在 HTML 引入 script
window.initMap = initMap;
