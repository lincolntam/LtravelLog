/* LTravelLog - Version 0.45.0 */

let googleMap;
let directionsService;
let directionsRenderer;
let geocoder;
let activeRoute = null;
let waypointId = 0;

const FUEL_CAR_COST_PER_KM = 2.25;

const TUNNEL_DATA = [
    { id: "whc", name: "西隧", loc: "Western Harbour Crossing", toll: "harbour" },
    { id: "cht", name: "紅隧", loc: "Cross-Harbour Tunnel", toll: "harbour" },
    { id: "ehc", name: "東隧", loc: "Eastern Harbour Crossing", toll: "harbour" },
    { id: "tlt", name: "大欖", loc: "Tai Lam Tunnel", toll: "tlt" },
    { id: "smt", name: "城門", loc: "Shing Mun Tunnels", toll: 5 },
    { id: "tct", name: "大老山", loc: "Tate's Cairn Tunnel", toll: 15 },
    { id: "tpr", name: "大埔道", loc: "Tai Po Road", toll: 0 },
    { id: "lrt", name: "獅子山", loc: "Lion Rock Tunnel", toll: 8 },
    { id: "ent", name: "尖山", loc: "Eagle's Nest Tunnel", toll: 8 }
];

const app = document.querySelector(".phone-shell");
const originInput = document.getElementById("origin-input");
const destinationInput = document.getElementById("destination-input");
const tripSheet = document.querySelector(".trip-sheet");
const collapseIcon = document.getElementById("collapse-trip-icon");

async function initApp() {
    bindUi();
    setDefaultTime();

    try {
        const res = await fetch("/api/config");
        if (res.status === 401) {
            window.location.href = "login.html";
            return;
        }
        if (!res.ok) throw new Error("Config loading failed");

        const config = await res.json();
        const script = document.createElement("script");
        script.src = `https://maps.googleapis.com/maps/api/js?key=${config.Maps_API_KEY}&libraries=places&callback=setupGoogleServices`;
        script.async = true;
        document.head.appendChild(script);
    } catch (error) {
        console.error("Failed to load Google Maps config:", error);
        setupFallbackMap();
    }
}

function bindUi() {
    document.getElementById("plan-btn").addEventListener("click", calculateTrip);
    document.getElementById("cancel-btn").addEventListener("click", showSearch);
    document.getElementById("back-btn").addEventListener("click", showSearch);
    document.getElementById("collapse-trip-btn").addEventListener("click", toggleTripCard);
    document.getElementById("logout-btn").addEventListener("click", logout);
    document.getElementById("add-waypoint-btn").addEventListener("click", () => addWaypoint());
    document.getElementById("swap-route-btn").addEventListener("click", swapRoute);
    document.getElementById("car-model").addEventListener("change", () => {
        if (activeRoute) updateTripSummary(activeRoute);
    });

    bindLocationButtons(document);

    [originInput, destinationInput].forEach(input => {
        input.addEventListener("keydown", event => {
            if (event.key === "Enter") calculateTrip();
        });
    });

    renderTunnelButtons();
}

function setDefaultTime() {
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    document.getElementById("start-time").value = new Date(now - tzOffset).toISOString().slice(0, 16);
}

function setupGoogleServices() {
    directionsService = new google.maps.DirectionsService();
    geocoder = new google.maps.Geocoder();
    googleMap = new google.maps.Map(document.getElementById("map"), {
        zoom: 13,
        center: { lat: 22.3193, lng: 114.1694 },
        disableDefaultUI: true,
        gestureHandling: "greedy",
        styles: [
            { elementType: "geometry", stylers: [{ color: "#edf0ed" }] },
            { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
            { elementType: "labels.text.fill", stylers: [{ color: "#8b9698" }] },
            { elementType: "labels.text.stroke", stylers: [{ color: "#f7f8f5" }] },
            { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
            { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#dde5e1" }] },
            { featureType: "water", elementType: "geometry", stylers: [{ color: "#d7e8ee" }] }
        ]
    });
    directionsRenderer = new google.maps.DirectionsRenderer({
        map: googleMap,
        suppressMarkers: false,
        polylineOptions: { strokeColor: "#18c877", strokeWeight: 6, strokeOpacity: 0.88 }
    });

    bindAutocomplete(originInput);
    bindAutocomplete(destinationInput);
    getWaypointInputs().forEach(bindAutocomplete);
}

function setupFallbackMap() {
    document.getElementById("map").classList.add("fallback-map");
}

function bindAutocomplete(input) {
    if (!window.google?.maps?.places || input.dataset.autocompleteBound) return;
    const autocomplete = new google.maps.places.Autocomplete(input, {
        componentRestrictions: { country: "hk" },
        fields: ["formatted_address", "geometry", "name"]
    });
    autocomplete.addListener("place_changed", () => {});
    input.dataset.autocompleteBound = "true";
}

function bindLocationButtons(root) {
    root.querySelectorAll(".field-location-btn").forEach(button => {
        button.addEventListener("click", () => useCurrentLocation(button.dataset.target));
    });
}

function renderTunnelButtons() {
    const container = document.getElementById("goTunnels");
    container.innerHTML = "";
    TUNNEL_DATA.forEach(tunnel => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "t-btn";
        button.textContent = tunnel.name;
        button.dataset.loc = tunnel.loc;
        button.addEventListener("click", () => {
            button.classList.toggle("active");
            if (activeRoute) calculateTrip();
        });
        container.appendChild(button);
    });
}

function addWaypoint(value = "") {
    waypointId += 1;
    const id = `waypoint-${waypointId}`;
    const row = document.createElement("label");
    row.className = "waypoint-row";
    row.innerHTML = `
        <span>途經點</span>
        <div class="input-action">
            <input class="node-input waypoint-input" id="${id}" placeholder="新增途經地點" autocomplete="off">
            <button class="remove-waypoint-btn" type="button" aria-label="刪除途經點">
                <span class="material-icons">close</span>
            </button>
        </div>
    `;

    const input = row.querySelector("input");
    input.value = value;
    row.querySelector(".remove-waypoint-btn").addEventListener("click", () => {
        row.remove();
        if (activeRoute) calculateTrip();
    });

    document.getElementById("waypoint-list").appendChild(row);
    bindAutocomplete(input);
}

function getWaypointInputs() {
    return Array.from(document.querySelectorAll(".waypoint-input"));
}

function getWaypointValues() {
    return getWaypointInputs()
        .map(input => input.value.trim())
        .filter(Boolean);
}

function swapRoute() {
    const origin = originInput.value;
    originInput.value = destinationInput.value;
    destinationInput.value = origin;
}

async function calculateTrip() {
    const origin = originInput.value.trim();
    const destination = destinationInput.value.trim();
    if (!origin || !destination) {
        alert("請輸入出發點和目的地。");
        return;
    }

    const stagingPosts = getWaypointValues();
    const selectedTunnels = Array.from(document.querySelectorAll(".t-btn.active"))
        .map(button => TUNNEL_DATA.find(tunnel => tunnel.loc === button.dataset.loc))
        .filter(Boolean);

    const route = await getRouteData(origin, destination, stagingPosts, selectedTunnels);
    activeRoute = { ...route, origin, destination, stagingPosts, selectedTunnels };
    updateTripSummary(activeRoute);
    showTrip();
}

async function getRouteData(origin, destination, stagingPosts, selectedTunnels) {
    const routeWaypoints = [
        ...stagingPosts.map(location => ({ location, stopover: true })),
        ...selectedTunnels.map(tunnel => ({ location: tunnel.loc, stopover: true }))
    ];

    if (!directionsService) {
        return { km: 0, sec: 0, toll: estimateTunnelToll(selectedTunnels), raw: null };
    }

    return new Promise(resolve => {
        directionsService.route({
            origin,
            destination,
            waypoints: routeWaypoints,
            travelMode: "DRIVING",
            optimizeWaypoints: false
        }, (response, status) => {
            if (status !== "OK") {
                resolve({ km: 0, sec: 0, toll: estimateTunnelToll(selectedTunnels), raw: null });
                return;
            }

            const legs = response.routes[0].legs;
            const km = legs.reduce((sum, leg) => sum + leg.distance.value, 0) / 1000;
            const sec = legs.reduce((sum, leg) => sum + leg.duration.value, 0);
            resolve({ km, sec, toll: estimateTunnelToll(selectedTunnels), raw: response });
        });
    });
}

function estimateTunnelToll(selectedTunnels) {
    const start = new Date(document.getElementById("start-time").value || Date.now());
    return selectedTunnels.reduce((sum, tunnel) => sum + getToll(tunnel, start), 0);
}

function getToll(tunnel, targetDate) {
    if (!tunnel) return 0;
    if (tunnel.toll === "harbour") {
        const hour = targetDate.getHours() + targetDate.getMinutes() / 60;
        return hour >= 10.25 && hour < 16.5 ? 30 : 60;
    }
    if (tunnel.toll === "tlt") return 45;
    return tunnel.toll;
}

function updateTripSummary(route) {
    const carConfig = document.getElementById("car-model").value.split("|");
    const efficiency = Number(carConfig[0]);
    const rate = Number(carConfig[1]);
    const energyCost = route.km * efficiency * rate;
    const total = energyCost + route.toll;
    const fuelCarCost = route.km * FUEL_CAR_COST_PER_KM + route.toll;
    const fuelSavings = Math.max(0, fuelCarCost - total);
    const durationMin = Math.round(route.sec / 60);

    document.getElementById("arrival-title").textContent = durationMin ? `預計 ${durationMin} 分鐘` : "路線已準備";
    document.getElementById("summary-origin").textContent = route.origin;
    document.getElementById("summary-destination").textContent = route.destination;
    document.getElementById("summary-waypoints").innerHTML = route.stagingPosts
        .map((point, index) => `
            <div class="summary-waypoint">
                <span class="dot"></span>
                <div>
                    <small>途經點 ${index + 1}</small>
                    <strong>${escapeHtml(point)}</strong>
                </div>
            </div>
        `)
        .join("");
    document.getElementById("km").textContent = `${route.km.toFixed(1)} km`;
    document.getElementById("duration").textContent = `${durationMin} min`;
    document.getElementById("t-fee").textContent = `$${route.toll}`;
    document.getElementById("e-cost").textContent = `$${energyCost.toFixed(1)}`;
    document.getElementById("compact-total").textContent = total.toFixed(1);
    document.getElementById("fuel-savings").textContent = fuelSavings.toFixed(1);

    if (route.raw && directionsRenderer) directionsRenderer.setDirections(route.raw);
}

function showTrip() {
    tripSheet.classList.remove("is-compact");
    collapseIcon.textContent = "expand_more";
    app.dataset.view = "trip";
}

function showSearch() {
    app.dataset.view = "search";
}

function toggleTripCard() {
    const compact = tripSheet.classList.toggle("is-compact");
    collapseIcon.textContent = compact ? "expand_less" : "expand_more";
}

function useCurrentLocation(targetId) {
    const input = document.getElementById(targetId);
    if (!navigator.geolocation) {
        alert("此瀏覽器不支援目前位置。");
        return;
    }

    input.value = "定位中...";
    navigator.geolocation.getCurrentPosition(
        position => {
            const location = { lat: position.coords.latitude, lng: position.coords.longitude };
            if (googleMap) googleMap.panTo(location);
            resolveAddress(location, input);
        },
        () => {
            input.value = "";
            alert("未能取得目前位置，請檢查定位權限。");
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
}

function resolveAddress(location, input) {
    const fallback = `${location.lat.toFixed(6)},${location.lng.toFixed(6)}`;
    if (!geocoder) {
        input.value = fallback;
        return;
    }

    geocoder.geocode({ location }, (results, status) => {
        input.value = status === "OK" && results?.[0] ? results[0].formatted_address : fallback;
    });
}

function escapeHtml(value) {
    return value.replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[char]));
}

function logout() {
    fetch("/api/logout", { method: "POST" }).finally(() => {
        localStorage.removeItem("isLoggedIn");
        localStorage.removeItem("userEmail");
        window.location.href = "login.html";
    });
}

window.setupGoogleServices = setupGoogleServices;
initApp();
