let map;

// 1. 初始化地圖
function initMap() {
    // 預設中心設為香港
    map = L.map('map', { 
        zoomControl: false,
        attributionControl: false 
    }).setView([22.3193, 114.1694], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
}

// 2. 切換視圖 (Step 1 -> 2 -> 3)
function goToStep(step) {
    // 移除所有 active 標籤
    document.querySelectorAll('.ui-step').forEach(el => el.classList.remove('active'));
    
    // 激活當前步驟
    const target = document.getElementById(`step-${step}`);
    if (target) {
        target.classList.add('active');
    }

    // 進入第三步時自動觸發計算
    if (step === 3) {
        calculate();
    }
}

// 3. 核心計算邏輯
function calculate() {
    const carModelElement = document.getElementById('car-model');
    if (!carModelElement) return;

    const carData = carModelElement.value.split('|');
    const consumptionRate = parseFloat(carData[0]); // 耗電率 (kWh/km)
    const unitPrice = parseFloat(carData[1]);      // 能源單價

    // 模擬里程 (未來可對接導航 API 獲取實際距離)
    const distance = 12.8; 
    const energyCost = distance * consumptionRate * unitPrice;
    
    // 模擬隧道費
    const tunnelFee = 25; 

    // 更新介面數值
    document.getElementById('km').innerText = distance.toFixed(1);
    document.getElementById('duration').innerText = Math.round(distance * 2); // 粗略估計時間
    document.getElementById('t-fee').innerText = '$' + tunnelFee;
    
    const total = energyCost + tunnelFee;
    document.getElementById('total').innerText = total.toFixed(1);
}

// 啟動
window.onload = () => {
    initMap();
    // 初始進入第一步
    setTimeout(() => goToStep(1), 500);
};
