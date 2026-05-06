/* LTravelLog - Version 0.43.0 */

let googleMap;
let directionsService;
let directionsRenderer;
let activeRoute = null;

const TUNNEL_DATA = [
    { id: "whc", name: "Western", loc: "Western Harbour Crossing", toll: "harbour" },
    { id: "cht", name: "Cross", loc: "Cross-Harbour Tunnel", toll: "harbour" },
    { id: "ehc", name: "Eastern", loc: "Eastern Harbour Crossing", toll: "harbour" },
    { id: "tlt", name: "Tai Lam", loc: "Tai Lam Tunnel", toll: "tlt" },
    { id: "smt", name: "Shing Mun", loc: "Shing Mun Tunnels", toll: 5 },
    { id: "tct", name: "Tate's Cairn", loc: "Tate's Cairn Tunnel", toll: 15 },
    { id: "tpr", name: "Tai Po", loc: "Tai Po Road", toll: 0 },
    { id: "lrt", name: "Lion Rock", loc: "Lion Rock Tunnel", toll: 8 },
    { id: "ent", name: "Eagle's Nest", loc: "Eagle's Nest Tunnel", toll: 8 }
];

const app = document.querySelector(".phone-shell");
const originInput = document.getElementById("origin-input");
const destinationInput = document.getElementById("destination-input");
const calloutDestination = document.getElementById("callout-destination");
const calloutSubtitle = document.getElementById("callout-subtitle");

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
    document.getElementById("collapse-trip-btn").addEventListener("click", showSearch);
    document.getElementById("logout-btn").addEventListener("click", logout);
    document.getElementById("car-model").addEventListener("change", () => {
        if (activeRoute) updateTripSummary(activeRoute);
    });

    document.querySelectorAll(".recent-row").forEach(button => {
        button.addEventListener("click", () => {
            originInput.value = button.dataset.origin || "";
            destinationInput.value = button.dataset.destination || "";
            updateCallout();
        });
    });

    [originInput, destinationInput].forEach(input => {
        input.addEventListener("input", updateCallout);
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

    [originInput, destinationInput].forEach(input => bindAutocomplete(input));
}

function setupFallbackMap() {
    document.getElementById("map").classList.add("fallback-map");
}

function bindAutocomplete(input) {
    if (!window.google?.maps?.places) return;
    const autocomplete = new google.maps.places.Autocomplete(input, {
        componentRestrictions: { country: "hk" },
        fields: ["formatted_address", "geometry", "name"]
    });
    autocomplete.addListener("place_changed", updateCallout);
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

function updateCallout() {
    const destination = destinationInput.value.trim();
    calloutDestination.textContent = destination || "Where to?";
    calloutSubtitle.textContent = originInput.value.trim() || "Select your route";
}

async function calculateTrip() {
    const origin = originInput.value.trim();
    const destination = destinationInput.value.trim();
    if (!origin || !destination) {
        alert("Please enter pick up point and destination.");
        return;
    }

    calloutDestination.textContent = destination;
    calloutSubtitle.textContent = "Calculating";

    const selectedTunnels = Array.from(document.querySelectorAll(".t-btn.active"))
        .map(button => TUNNEL_DATA.find(tunnel => tunnel.loc === button.dataset.loc))
        .filter(Boolean);

    const route = await getRouteData(origin, destination, selectedTunnels);
    activeRoute = { ...route, origin, destination, selectedTunnels };
    updateTripSummary(activeRoute);
    showTrip();
}

async function getRouteData(origin, destination, selectedTunnels) {
    if (!directionsService) {
        return { km: 0, sec: 0, toll: estimateTunnelToll(selectedTunnels), raw: null };
    }

    return new Promise(resolve => {
        directionsService.route({
            origin,
            destination,
            waypoints: selectedTunnels.map(tunnel => ({ location: tunnel.loc, stopover: true })),
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
    const durationMin = Math.round(route.sec / 60);

    document.getElementById("arrival-title").textContent = durationMin ? `Arriving in ${durationMin} min` : "Route ready";
    document.getElementById("route-name").textContent = route.destination;
    document.getElementById("summary-origin").textContent = route.origin;
    document.getElementById("summary-destination").textContent = route.destination;
    document.getElementById("km").textContent = `${route.km.toFixed(1)} km`;
    document.getElementById("duration").textContent = `${durationMin} min`;
    document.getElementById("t-fee").textContent = `$${route.toll}`;
    document.getElementById("e-cost").textContent = `$${energyCost.toFixed(1)}`;
    document.getElementById("total").textContent = total.toFixed(1);

    if (route.raw && directionsRenderer) directionsRenderer.setDirections(route.raw);
}

function showTrip() { app.dataset.view = "trip"; }
function showSearch() { app.dataset.view = "search"; }

function logout() {
    fetch("/api/logout", { method: "POST" }).finally(() => {
        localStorage.removeItem("isLoggedIn");
        localStorage.removeItem("userEmail");
        window.location.href = "login.html";
    });
}

window.setupGoogleServices = setupGoogleServices;
initApp();
