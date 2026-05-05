/**
 * LTravelLog - Precision Navigation
 * 動態加載 Google Maps 並整合 Cloudflare 變數
 */

let map;
let isReturnMode = false;

// 1. 從 config.js 加載 API Key 並啟動地圖
function startApp() {
    if (typeof CONFIG !== 'undefined' && CONFIG.GOOGLE_MAPS_API_KEY) {
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${CONFIG.GOOGLE_MAPS_API_KEY}&callback=initMap`;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
    } else {
        console.error("LTravelLog: Missing API Key in config.js");
        // 如果 Key 遺失，顯示背景顏色而非純黑
        document.getElementById('map').style.background = '#2c3e50';
    }
}

// 2. 初始化 Google Maps
function initMap() {
    const hkCenter = { lat: 22.3193, lng: 114.1694 };
    map = new google.maps.Map(document.getElementById("map"), {
        center: hkCenter,
        zoom: 14,
        disableDefaultUI: true,
        gestureHandling: "greedy",
        styles: [{ featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] }]
    });
    
    // 初始化完成後顯示第一步 UI
    setTimeout(() => goToStep(1), 500);
}

// 3. UI 導航邏輯
function goToStep(step) {
    document.querySelectorAll('.ui-step').forEach(el => el.classList.remove('active'));
    const target = document.getElementById(`step-${step}`);
    if (target) target.classList.add('active');
    if (step === 3) calculate();
}

// 4. 行程節點與功能
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

// 5. 預算計算 (整合能源與里程)
function calculate() {
    const carModel = document.getElementById('car-model');
    if (!carModel) return;

    const [rate, price] = carModel.value.split('|').map(parseFloat);
    let distance = 15.2; // 此處未來可對接 Directions API 的距離數據
    if (isReturnMode) distance *= 2;

    const energyCost = distance * rate * price;
    const tunnelFee = isReturnMode ? 50 : 25; // 模擬隧道費數據

    document.getElementById('km').innerText = distance.toFixed(1) + " km";
    document.getElementById('e-cost').innerText = "$" + energyCost.toFixed(1);
    document.getElementById('t-fee').innerText = "$" + tunnelFee;
    document.getElementById('total').innerText = (energyCost + tunnelFee).toFixed(1);
}

function logout() {
    localStorage.removeItem('isLoggedIn');
    window.location.href = 'login.html';
}

// 啟動程序
startApp();
window.initMap = initMap;
