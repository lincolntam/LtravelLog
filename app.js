let map;

/**
 * 1. 從 config.js 讀取 API Key 並動態注入 Google Maps Script
 * 確保在 Cloudflare 環境下也能正確運作
 */
function loadMapScript() {
    if (typeof CONFIG !== 'undefined' && CONFIG.GOOGLE_MAPS_API_KEY) {
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${CONFIG.GOOGLE_MAPS_API_KEY}&callback=initMap`;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
    } else {
        console.error("LTravelLog: Missing API Key in config.js");
        // 如果地圖無法加載，給予一個深色背景以示區別
        document.getElementById('map').style.backgroundColor = '#1a1a1a';
    }
}

/**
 * 2. 初始化地圖
 */
function initMap() {
    map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: 22.3193, lng: 114.1694 }, // 以香港中心為基準
        zoom: 15,
        disableDefaultUI: true,
        gestureHandling: "greedy",
        styles: [{ featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] }]
    });
}

/**
 * 3. UI 導航切換
 */
function goToStep(step) {
    document.querySelectorAll('.ui-step').forEach(el => el.classList.remove('active'));
    document.getElementById(`step-${step}`).classList.add('active');
    
    // Step 1 顯示頂部標籤，Step 2 隱藏以騰出空間
    const bubble = document.getElementById('top-bubble');
    if(step === 1) bubble.classList.add('active');
    else bubble.classList.remove('active');
    
    if (step === 2) calculate();
}

/**
 * 4. 核心預算計算 (保留原本 GitHub 的 Tesla 與充電費率邏輯)
 */
function calculate() {
    const carModel = document.getElementById('car-model');
    if (!carModel) return;

    const [rate, price] = carModel.value.split('|').map(parseFloat);
    let distance = 15.6; // 模擬預設距離，後續可接 Directions API

    const energyCost = distance * rate * price;
    const tunnelFee = 25; // 模擬紅隧收費

    document.getElementById('km').innerText = distance.toFixed(1) + " km";
    document.getElementById('total').innerText = "HK$ " + (energyCost + tunnelFee).toFixed(1);
}

function logout() {
    localStorage.removeItem('isLoggedIn');
    window.location.href = 'login.html';
}

// 執行加載
loadMapScript();
window.initMap = initMap;
