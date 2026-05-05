/**
 * LTravelLog - v0.40.4
 * 整合 Cloudflare Pages Functions 與新 UI 邏輯
 */

let map;

// 1. 從後端 API 獲取配置並加載地圖
async function initializeApp() {
    try {
        // 呼叫 Cloudflare Pages Function 路由
        const response = await fetch('/api/config');
        const config = await response.json();
        
        if (config.GOOGLE_MAPS_API_KEY) {
            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=${config.GOOGLE_MAPS_API_KEY}&callback=initMap`;
            script.async = true;
            script.defer = true;
            document.head.appendChild(script);
        } else {
            throw new Error("API Key not found in config response");
        }
    } catch (error) {
        console.error("Initialization failed:", error);
        document.getElementById('map').style.backgroundColor = '#1a1a1a';
    }
}

// 2. Google Maps 初始化回調
function initMap() {
    map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: 22.3193, lng: 114.1694 },
        zoom: 15,
        disableDefaultUI: true,
        gestureHandling: "greedy",
        styles: [{ featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] }]
    });
}

// 3. UI 導航切換
function goToStep(step) {
    document.querySelectorAll('.ui-step').forEach(el => el.classList.remove('active'));
    document.getElementById(`step-${step}`).classList.add('active');
    
    // 控制頂部氣泡
    const bubble = document.getElementById('top-bubble');
    if(step === 1) bubble.classList.add('active');
    else bubble.classList.remove('active');
    
    if (step === 2) calculate();
}

// 4. 計算邏輯 (保留 Tesla 與 EV 費率)
function calculate() {
    const carModel = document.getElementById('car-model');
    if (!carModel) return;

    const [rate, price] = carModel.value.split('|').map(parseFloat);
    let distance = 15.6; // 模擬數據

    const energyCost = distance * rate * price;
    const tunnelFee = 25; // 模擬紅隧

    document.getElementById('km').innerText = distance.toFixed(1) + " km";
    document.getElementById('total').innerText = "HK$ " + (energyCost + tunnelFee).toFixed(1);
}

// 啟動流程
initializeApp();
window.initMap = initMap;
