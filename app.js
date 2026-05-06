/* * (L)TravelCal - Version 0.41.0 
 * Feature: Integrated Deep Black Glass UI & Auth Shield
 */

// 2. 全域變數與隧道數據
let googleMap, ds, drGo, drBack;
let returnMode = false;

const TUNNEL_DATA = [
    { id: "whc", name: "西隧", loc: "Western Harbour Crossing", toll: "h" },
    { id: "cht", name: "紅隧", loc: "Cross-Harbour Tunnel", toll: "h" },
    { id: "ehc", name: "東隧", loc: "Eastern Harbour Crossing", toll: "h" },
    { id: "tlt", name: "大欖", loc: "Tai Lam Tunnel", toll: "tlt" },
    { id: "smt", name: "城門", loc: "Shing Mun Tunnels", toll: 5 },
    { id: "tct", name: "大老山", loc: "Tate's Cairn Tunnel", toll: 15 },
    { id: "tpr", name: "大埔道", loc: "Tai Po Road", toll: 0 },
    { id: "lrt", name: "獅子山", loc: "Lion Rock Tunnel", toll: 8 },
    { id: "ent", name: "尖山", loc: "Eagle's Nest Tunnel", toll: 8 }
];

// 3. 初始化應用：從 Cloudflare API 獲取 Config 並加載地圖
async function initApp() {
    try {
        const res = await fetch('/api/config');
        if (res.status === 401) {
            window.location.href = 'login.html';
            return;
        }
        if (!res.ok) throw new Error("Config loading failed");
        const config = await res.json();
        
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${config.Maps_API_KEY}&libraries=places&callback=setupGoogleServices`;
        script.async = true; 
        document.head.appendChild(script);
    } catch (e) { 
        console.error("API Key 載入失敗，請檢查 Cloudflare 環境變數:", e); 
    }
}

// 4. 設定 Google Maps 服務
function setupGoogleServices() {
    ds = new google.maps.DirectionsService();
    
    // 設定去程與回程的路線顯示顏色 (亮藍色與半透明白色)
    drGo = new google.maps.DirectionsRenderer({ 
        polylineOptions: { strokeColor: "#58CCFF", strokeWeight: 6, strokeOpacity: 0.9 } 
    });
    drBack = new google.maps.DirectionsRenderer({ 
        polylineOptions: { strokeColor: "#FFFFFF", strokeWeight: 4, strokeOpacity: 0.4 }, 
        suppressMarkers: true 
    });
    
    // 預設出發時間為「現在」
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    const localNow = new Date(now - tzOffset).toISOString().slice(0, 16);
    document.getElementById('start-time').value = localNow;

    // 綁定輸入框自動完成
    document.querySelectorAll('.node-input').forEach(bindAutocomplete);
    
    // 生成隧道按鈕
    renderButtons('goTunnels', 'go');
    renderButtons('backTunnels', 'back');
}

function bindAutocomplete(inp) {
    const ac = new google.maps.places.Autocomplete(inp, { componentRestrictions: { country: "hk" } });
    ac.addListener('place_changed', calculate);
}

function renderButtons(id, prefix) {
    const container = document.getElementById(id);
    TUNNEL_DATA.forEach(t => {
        const div = document.createElement('div');
        div.className = `t-btn ${prefix}-t`;
        div.innerText = t.name;
        div.onclick = function() { 
            this.classList.toggle('active'); 
            calculate(); 
        };
        div.setAttribute('data-loc', t.loc);
        container.appendChild(div);
    });
}

// 5. 費用計算邏輯 (分時段收費)
function getToll(loc, targetDate) {
    const data = TUNNEL_DATA.find(d => d.loc === loc);
    if (!data) return 0;
    
    const h = targetDate.getHours() + targetDate.getMinutes() / 60;
    
    // 簡單模擬：繁忙時段 $60，一般時段 $30 (三隧分流邏輯)
    if (data.toll === "h") {
        return (h >= 10.25 && h < 16.5) ? 30 : 60;
    }
    // 大欖隧道預設 $45
    if (data.toll === "tlt") return 45;
    
    return data.toll;
}

// 6. 核心路徑與費用計算
async function calculate() {
    const inputs = document.querySelectorAll('.node-input');
    const locs = Array.from(inputs).map(i => i.value.trim()).filter(v => v.length > 2);
    const mapEl = document.getElementById('map');
    
    if (locs.length < 2) {
        document.getElementById('go-card').classList.remove('visible');
        document.getElementById('back-card').classList.remove('visible');
        mapEl.classList.remove('active');
        return;
    }

    document.getElementById('go-card').classList.add('visible');
    document.getElementById('back-card').classList.toggle('visible', returnMode);
    mapEl.classList.add('active');

    // 初始化地圖（如果尚未建立），並套用深色樣式
    if (!googleMap) {
        googleMap = new google.maps.Map(mapEl, { 
            zoom: 12, 
            center: { lat: 22.3, lng: 114.1 }, 
            disableDefaultUI: true,
            styles: [
                { "elementType": "geometry", "stylers": [{ "color": "#212121" }] },
                { "elementType": "labels.text.stroke", "stylers": [{ "color": "#212121" }] },
                { "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
                { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#424242" }] }
            ]
        });
    }

    // 計算去程
    const goTime = new Date(document.getElementById('start-time').value);
    const goSelected = Array.from(document.querySelectorAll('.go-t.active'))
                            .map(b => TUNNEL_DATA.find(d => d.loc === b.getAttribute('data-loc')));
    const go = await getRouteData(locs[0], locs[locs.length-1], goSelected, goTime);

    let totalKm = go.km, totalToll = go.toll, totalSec = go.sec;
    if (go.raw) { drGo.setMap(googleMap); drGo.setDirections(go.raw); }

    // 計算回程 (如果開啟往返模式)
    if (returnMode) {
        const backTime = new Date(document.getElementById('return-time').value || document.getElementById('start-time').value);
        const backSelected = Array.from(document.querySelectorAll('.back-t.active'))
                                .map(b => TUNNEL_DATA.find(d => d.loc === b.getAttribute('data-loc')));
        const back = await getRouteData(locs[locs.length-1], locs[0], backSelected, backTime);
        totalKm += back.km; totalToll += back.toll; totalSec += back.sec;
        if (back.raw) { drBack.setMap(googleMap); drBack.setDirections(back.raw); }
    } else { 
        drBack.setMap(null); 
    }

    updateUI(totalKm, totalToll, totalSec);
}

async function getRouteData(origin, dest, tunnels, time) {
    return new Promise(resolve => {
        let pts = tunnels.map(t => ({ location: t.loc, stopover: true }));
        ds.route({ 
            origin: origin, 
            destination: dest, 
            waypoints: pts, 
            travelMode: 'DRIVING',
            optimizeWaypoints: false 
        }, (res, stat) => {
            if (stat === 'OK') {
                const km = res.routes[0].legs.reduce((a, b) => a + b.distance.value, 0) / 1000;
                const sec = res.routes[0].legs.reduce((a, b) => a + b.duration.value, 0);
                resolve({ km, toll: tunnels.reduce((a, b) => a + getToll(b.loc, time), 0), sec, raw: res });
            } else resolve({ km: 0, toll: 0, sec: 0, raw: null });
        });
    });
}

// 7. 更新介面數值
function updateUI(km, toll, sec) {
    const carConfig = document.getElementById('car-model').value.split('|');
    const efficiency = parseFloat(carConfig[0]); // kWh/km
    const rate = parseFloat(carConfig[1]);       // HKD/kWh
    
    const energyCost = km * efficiency * rate;
    const total = energyCost + toll;

    document.getElementById('km').innerHTML = `${km.toFixed(1)} <small>km</small>`;
    document.getElementById('duration').innerHTML = `${Math.round(sec / 60)} <small>min</small>`;
    document.getElementById('t-fee').innerText = "$" + toll;
    document.getElementById('e-cost').innerText = "$" + energyCost.toFixed(1);
    document.getElementById('total').innerText = total.toFixed(1);
}

// 8. 輔助功能
function addNode() {
    const div = document.createElement('div');
    div.className = 'input-wrapper';
    div.innerHTML = `<input class="node-input" placeholder="中途站" autocomplete="off" oninput="calculate()">`;
    document.getElementById('nodes-container').appendChild(div);
    bindAutocomplete(div.querySelector('.node-input'));
}

function toggleReturn() {
    returnMode = !returnMode;
    document.getElementById('retBtn').classList.toggle('active', returnMode);
    document.querySelectorAll('.return-only').forEach(el => el.style.display = returnMode ? 'block' : 'none');
    calculate();
}

// 9. 登出邏輯
function logout() {
    fetch('/api/logout', { method: 'POST' }).finally(() => {
        localStorage.removeItem('isLoggedIn');
        window.location.href = 'login.html';
    });
}

// 啟動應用
initApp();
