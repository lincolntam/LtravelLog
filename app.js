/* LTravelLog - Version 0.55.13 */

let googleMap;
let directionsService;
let directionsRenderer;
let geocoder;
let returnPolyline;
let activeRoute = null;
let waypointId = 0;
let selectedOutboundTunnels = ["auto"];
let selectedReturnTunnels = ["auto"];

const FUEL_CAR_COST_PER_KM = 2.25;
const TUNNEL_DETECTION_RADIUS_M = 420;
const TUNNEL_DATA = [
    { id: "tpr", name: "大埔公路", loc: "Tai Po Road", toll: 0, gates: { south: { lat: 22.353056, lng: 114.156194 }, north: { lat: 22.353056, lng: 114.156194 } }, radius: 420, aliases: ["tai po road"] },
    { id: "cht", name: "紅隧", loc: "Cross-Harbour Tunnel", toll: "harbour", gates: { south: { lat: 22.289806, lng: 114.182389 }, north: { lat: 22.290000, lng: 114.182222 } }, radius: 520, aliases: ["cross-harbour tunnel", "cross harbour tunnel"] },
    { id: "ehc", name: "東隧", loc: "Eastern Harbour Crossing", toll: "harbour", gates: { south: { lat: 22.296139, lng: 114.224833 }, north: { lat: 22.295944, lng: 114.224222 } }, radius: 520, aliases: ["eastern harbour crossing", "eastern tunnel"] },
    { id: "whc", name: "西隧", loc: "Western Harbour Crossing", toll: "harbour", gates: { south: { lat: 22.297361, lng: 114.153278 }, north: { lat: 22.297139, lng: 114.152917 } }, radius: 520, aliases: ["western harbour crossing", "western tunnel", "west harbour crossing"] },
    { id: "lrt", name: "獅子山隧道", loc: "Lion Rock Tunnel", toll: 8, gates: { south: { lat: 22.351611, lng: 114.177389 }, north: { lat: 22.351194, lng: 114.177056 } }, radius: 420, aliases: ["lion rock tunnel"] },
    { id: "tct", name: "大老山隧道", loc: "Tate's Cairn Tunnel", toll: 20, gates: { south: { lat: 22.358444, lng: 114.210583 }, north: { lat: 22.359000, lng: 114.210333 } }, radius: 420, aliases: ["tate's cairn tunnel", "tates cairn tunnel"] },
    { id: "ent", name: "尖山隧道", loc: "Eagle's Nest Tunnel", toll: 8, gates: { south: { lat: 22.351722, lng: 114.158889 }, north: { lat: 22.351611, lng: 114.158222 } }, radius: 60, aliases: ["eagle's nest tunnel", "eagles nest tunnel"] },
    { id: "tlt", name: "大欖隧道", loc: "Tai Lam Tunnel", toll: "tlt", gates: { south: { lat: 22.387111, lng: 114.062722 }, north: { lat: 22.387111, lng: 114.062722 } }, radius: 520, aliases: ["tai lam tunnel"] },
    { id: "skh", name: "西貢公路", loc: "Sai Kung Highway", toll: 0, gates: { south: { lat: 22.371639, lng: 114.259889 }, north: { lat: 22.371639, lng: 114.259889 } }, radius: 420, aliases: ["sai kung highway"] },
    { id: "tmr", name: "屯門公路", loc: "Tuen Mun Road", toll: 0, gates: { south: { lat: 22.363028, lng: 114.040222 }, north: { lat: 22.362583, lng: 114.039361 } }, radius: 520, aliases: ["tuen mun road"] },
    { id: "smt", name: "城門隧道", loc: "Shing Mun Tunnels", toll: 8, gates: { south: { lat: 22.376250, lng: 114.150528 }, north: { lat: 22.376611, lng: 114.150361 } }, radius: 420, aliases: ["shing mun tunnels", "shing mun tunnel"] }
];

const ROUTE_TUNNEL_OPTIONS = [
    { id: "auto", name: "自動" },
    { id: "cht", name: "紅隧" },
    { id: "ehc", name: "東隧" },
    { id: "whc", name: "西隧" },
    { id: "tpr", name: "大埔公路" },
    { id: "lrt", name: "獅子山" },
    { id: "tct", name: "大老山" },
    { id: "ent", name: "尖山" },
    { id: "tlt", name: "大欖" },
    { id: "tmr", name: "屯門公路" },
    { id: "smt", name: "城門" }
];

const HK_GENERAL_HOLIDAYS_2026 = new Set([
    "2026-01-01",
    "2026-02-17",
    "2026-02-18",
    "2026-02-19",
    "2026-04-03",
    "2026-04-04",
    "2026-04-06",
    "2026-04-07",
    "2026-05-01",
    "2026-05-25",
    "2026-06-19",
    "2026-07-01",
    "2026-09-26",
    "2026-10-01",
    "2026-10-19",
    "2026-12-25",
    "2026-12-26"
]);

const app = document.querySelector(".phone-shell");
const originInput = document.getElementById("origin-input");
const destinationInput = document.getElementById("destination-input");
const returnDestinationInput = document.getElementById("return-destination-input");
const tripSheet = document.querySelector(".trip-sheet");
const collapseIcon = document.getElementById("collapse-trip-icon");

async function initApp() {
    app.dataset.returnTrip = "false";
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
    document.getElementById("plan-btn").addEventListener("click", () => {
        resetTunnelSelections();
        calculateTrip();
    });
    document.getElementById("cancel-btn").addEventListener("click", showSearch);
    document.getElementById("back-btn").addEventListener("click", goHome);
    document.getElementById("menu-btn").addEventListener("click", goHome);
    document.getElementById("collapse-trip-btn").addEventListener("click", toggleTripCard);
    document.getElementById("logout-btn").addEventListener("click", logout);
    document.getElementById("add-waypoint-btn").addEventListener("click", () => addWaypoint());
    document.getElementById("swap-route-btn").addEventListener("click", swapRoute);
    document.getElementById("return-route-btn").addEventListener("click", toggleReturnRoute);
    document.getElementById("avoid-tolls").addEventListener("change", () => {
        if (activeRoute) calculateTrip();
    });
    document.getElementById("car-model").addEventListener("change", () => {
        if (activeRoute) updateTripSummary(activeRoute);
    });

    bindLocationButtons(document);
    renderTunnelSelectors();

    [originInput, destinationInput, returnDestinationInput].forEach(input => {
        input.addEventListener("keydown", event => {
            if (event.key === "Enter") calculateTrip();
        });
    });

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
    bindAutocomplete(returnDestinationInput);
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

function renderTunnelSelectors() {
    renderTunnelSelector("goTunnels", "outbound");
    renderTunnelSelector("returnTunnels", "return");
}

function resetTunnelSelections() {
    selectedOutboundTunnels = ["auto"];
    selectedReturnTunnels = ["auto"];
    renderTunnelSelectors();
}

function renderTunnelSelector(containerId, direction) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = ROUTE_TUNNEL_OPTIONS.map(option => `
        <button class="t-btn ${option.id === "auto" ? "active" : ""}" type="button" data-tunnel="${option.id}">
            ${escapeHtml(option.name)}
        </button>
    `).join("");

    container.querySelectorAll(".t-btn").forEach(button => {
        button.addEventListener("click", () => {
            const selected = direction === "outbound" ? selectedOutboundTunnels : selectedReturnTunnels;
            const tunnelId = button.dataset.tunnel;
            let nextSelected;

            if (tunnelId === "auto") {
                nextSelected = ["auto"];
            } else {
                nextSelected = selected.filter(id => id !== "auto");
                if (nextSelected.includes(tunnelId)) {
                    nextSelected = nextSelected.filter(id => id !== tunnelId);
                } else {
                    nextSelected.push(tunnelId);
                }
                if (!nextSelected.length) nextSelected = ["auto"];
            }

            if (direction === "outbound") {
                selectedOutboundTunnels = nextSelected;
            } else {
                selectedReturnTunnels = nextSelected;
            }
            container.querySelectorAll(".t-btn").forEach(item => {
                item.classList.toggle("active", nextSelected.includes(item.dataset.tunnel));
            });
            if (activeRoute) calculateTrip();
        });
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
            <input class="node-input waypoint-input" id="${id}" placeholder="輸入途經點" autocomplete="off">
            <button class="remove-waypoint-btn" type="button" aria-label="移除途經點">
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
    clearReturnRoute();
}

function toggleReturnRoute() {
    if (app.dataset.returnTrip === "true") {
        clearReturnRoute();
        return;
    }

    app.dataset.returnTrip = "true";
    returnDestinationInput.placeholder = originInput.value.trim() || "留空則返回出發點";
    document.getElementById("return-route-btn").classList.add("active");
}

function clearReturnRoute() {
    app.dataset.returnTrip = "false";
    returnDestinationInput.value = "";
    returnDestinationInput.placeholder = "留空則返回出發點";
    document.getElementById("return-route-btn").classList.remove("active");
}

async function calculateTrip() {
    const origin = originInput.value.trim();
    const destination = destinationInput.value.trim();
    if (!origin || !destination) {
        alert("請輸入出發點和目的地。");
        return;
    }

    const isReturnTrip = app.dataset.returnTrip === "true";
    const returnDestination = isReturnTrip ? (returnDestinationInput.value.trim() || origin) : "";

    const stagingPosts = getWaypointValues();
    const avoidTolls = document.getElementById("avoid-tolls").checked;

    const route = await getRouteData(origin, destination, stagingPosts, returnDestination, avoidTolls);
    activeRoute = { ...route, origin, destination, stagingPosts, returnDestination, avoidTolls };
    updateTripSummary(activeRoute);
    showTrip();
}

async function getRouteData(origin, outboundDestination, stagingPosts, returnDestination, avoidTolls) {
    if (!directionsService) {
        return { km: 0, sec: 0, toll: 0, tunnelDetails: [], raw: null, returnRaw: null };
    }

    const departTime = new Date(document.getElementById("start-time").value || Date.now());
    const [originPoint, outboundDestinationPoint] = await Promise.all([
        resolveRoutePoint(origin),
        resolveRoutePoint(outboundDestination)
    ]);
    const outboundRouteDirection = getPointDirection(originPoint, outboundDestinationPoint);
    const outboundDecisions = avoidTolls ? [] : decideTunnelsFromPoints(originPoint, outboundDestinationPoint, selectedOutboundTunnels);
    const outboundWaypoints = [
        ...stagingPosts.map(location => ({ location, stopover: true })),
        ...getTunnelWaypoints(outboundDecisions.map(decision => decision.tunnelId), outboundRouteDirection)
    ];
    const outboundAttempt = await requestDirections(origin, outboundDestination, outboundWaypoints, avoidTolls || outboundDecisions.some(decision => decision.tunnelId === "tpr"));
    if (outboundAttempt.status !== "OK") {
        return { km: 0, sec: 0, toll: 0, tunnelDetails: [], raw: null, returnRaw: null };
    }

    const outboundStats = getRouteStats(outboundAttempt.response);
    let returnAttempt = null;
    let returnStats = { km: 0, sec: 0 };
    let returnDecisions = [];

    if (returnDestination) {
        const returnDestinationPoint = await resolveRoutePoint(returnDestination);
        const returnRouteDirection = getPointDirection(outboundDestinationPoint, returnDestinationPoint);
        returnDecisions = avoidTolls ? [] : decideTunnelsFromPoints(outboundDestinationPoint, returnDestinationPoint, selectedReturnTunnels);
        returnAttempt = await requestDirections(outboundDestination, returnDestination, getTunnelWaypoints(returnDecisions.map(decision => decision.tunnelId), returnRouteDirection), avoidTolls || returnDecisions.some(decision => decision.tunnelId === "tpr"));
        if (returnAttempt.status === "OK") {
            returnStats = getRouteStats(returnAttempt.response);
        }
    }

    const returnStartTime = new Date(departTime.getTime() + (outboundStats.sec * 1000));
    const tunnelDetails = [
        ...getRouteTunnelTollDetails(outboundAttempt.response, "去程", departTime),
        ...(returnAttempt?.status === "OK" ? getRouteTunnelTollDetails(returnAttempt.response, "回程", returnStartTime) : [])
    ];

    return {
        km: outboundStats.km + returnStats.km,
        sec: outboundStats.sec + returnStats.sec,
        toll: tunnelDetails.reduce((sum, item) => sum + item.toll, 0),
        tunnelDetails,
        raw: outboundAttempt.response,
        returnRaw: returnAttempt?.status === "OK" ? returnAttempt.response : null
    };
}

function requestDirections(origin, destination, waypoints, avoidTolls) {
    return new Promise(resolve => {
        directionsService.route({
            origin,
            destination,
            waypoints,
            travelMode: "DRIVING",
            optimizeWaypoints: false,
            avoidTolls
        }, (response, status) => resolve({ response, status }));
    });
}

function getRouteStats(response) {
    const legs = response.routes[0].legs;
    return {
        km: legs.reduce((sum, leg) => sum + leg.distance.value, 0) / 1000,
        sec: legs.reduce((sum, leg) => sum + leg.duration.value, 0)
    };
}

function decideTunnelFromPoints(originPoint, destinationPoint, selectedTunnel) {
    if (selectedTunnel && selectedTunnel !== "auto") {
        return {
            tunnelId: selectedTunnel,
            reason: selectedTunnel === "tpr" ? "手動選擇零收費路線" : "手動選擇隧道"
        };
    }

    const originRegion = getHongKongRegion(originPoint);
    const destinationRegion = getHongKongRegion(destinationPoint);

    if (originRegion === "island" && destinationRegion !== "island") {
        return { tunnelId: chooseHarbourTunnel(originPoint, destinationPoint), reason: "港島至九龍/新界，自動選擇過海隧道" };
    }
    if (originRegion !== "island" && destinationRegion === "island") {
        return { tunnelId: chooseHarbourTunnel(originPoint, destinationPoint), reason: "九龍/新界至港島，自動選擇過海隧道" };
    }
    if (isKowloonNewTerritoriesTrip(originRegion, destinationRegion)) {
        return { tunnelId: "tpr", reason: "新界至九龍，自動選擇大埔公路零隧道費路線" };
    }
    return { tunnelId: null, reason: "同區或未需指定收費隧道" };
}

function decideTunnelsFromPoints(originPoint, destinationPoint, selectedTunnels) {
    const selected = Array.isArray(selectedTunnels) ? selectedTunnels : [selectedTunnels];
    if (selected.some(id => id && id !== "auto")) {
        return selected
            .filter(id => id && id !== "auto")
            .map(id => ({
                tunnelId: id,
                reason: id === "tpr" ? "手動選擇零收費路線" : "手動選擇隧道"
            }));
    }
    return [decideTunnelFromPoints(originPoint, destinationPoint, "auto")].filter(decision => decision.tunnelId);
}

function geocodeLocation(location) {
    return new Promise(resolve => {
        if (!geocoder) {
            resolve(null);
            return;
        }
        geocoder.geocode({ address: location, componentRestrictions: { country: "HK" } }, (results, status) => {
            if (status !== "OK" || !results?.[0]?.geometry?.location) {
                resolve(null);
                return;
            }
            resolve(pointToLatLng(results[0].geometry.location));
        });
    });
}

async function resolveRoutePoint(location) {
    return parseCoordinateText(location) || getKnownPlacePoint(location) || await geocodeLocation(location);
}

function parseCoordinateText(value) {
    const text = String(value || "");
    const dmsMatch = text.match(/(\d+(?:\.\d+)?)°\s*(\d+(?:\.\d+)?)['’]\s*(\d+(?:\.\d+)?)?"?\s*([NS])\s+(\d+(?:\.\d+)?)°\s*(\d+(?:\.\d+)?)['’]\s*(\d+(?:\.\d+)?)?"?\s*([EW])/i);
    if (dmsMatch) {
        const lat = dmsToDecimal(dmsMatch[1], dmsMatch[2], dmsMatch[3], dmsMatch[4]);
        const lng = dmsToDecimal(dmsMatch[5], dmsMatch[6], dmsMatch[7], dmsMatch[8]);
        return { lat, lng };
    }

    const decimalMatch = text.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
    if (decimalMatch) {
        return { lat: Number(decimalMatch[1]), lng: Number(decimalMatch[2]) };
    }
    return null;
}

function dmsToDecimal(degrees, minutes, seconds = 0, hemisphere = "N") {
    const value = Number(degrees) + (Number(minutes) / 60) + (Number(seconds || 0) / 3600);
    return /[SW]/i.test(hemisphere) ? -value : value;
}

function getKnownPlacePoint(value) {
    const text = String(value || "").toLowerCase();
    const places = [
        { keys: ["fo tan", "火炭"], point: { lat: 22.393639, lng: 114.192889 } },
        { keys: ["siu sai wan", "小西灣", "小西湾"], point: { lat: 22.264417, lng: 114.240667 } }
    ];
    return places.find(place => place.keys.some(key => text.includes(key)))?.point || null;
}

function getHongKongRegion(point) {
    if (!point) return "unknown";
    if (point.lat < 22.285) return "island";
    if (point.lat < 22.36 && point.lng > 114.10 && point.lng < 114.24) return "kowloon";
    return "nt";
}

function getPointDirection(originPoint, destinationPoint) {
    if (!originPoint || !destinationPoint) return "";
    if (originPoint.lat > destinationPoint.lat) return "南行";
    if (originPoint.lat < destinationPoint.lat) return "北行";
    return "";
}

function isKowloonNewTerritoriesTrip(originRegion, destinationRegion) {
    return (originRegion === "kowloon" && destinationRegion === "nt") ||
        (originRegion === "nt" && destinationRegion === "kowloon");
}

function chooseHarbourTunnel(originPoint, destinationPoint) {
    const meanLng = [originPoint?.lng, destinationPoint?.lng]
        .filter(value => typeof value === "number")
        .reduce((sum, value, index, values) => sum + (value / values.length), 0);
    if (meanLng && meanLng < 114.165) return "whc";
    if (meanLng && meanLng > 114.205) return "ehc";
    return "cht";
}

function getTunnelWaypoints(tunnelIds, routeDirection = "") {
    const ids = sortTunnelIdsByLatitude(Array.isArray(tunnelIds) ? tunnelIds : [tunnelIds], routeDirection);
    return ids.flatMap(tunnelId => {
        const tunnel = getTunnelById(tunnelId);
        const location = getTunnelGateForDirection(tunnel, routeDirection) || tunnel?.detect;
        if (!location) return [];
        return [{ location, stopover: false }];
    });
}

function sortTunnelIdsByLatitude(tunnelIds, routeDirection = "") {
    return tunnelIds
        .map((tunnelId, index) => {
            const tunnel = getTunnelById(tunnelId);
            const gate = getTunnelGateForDirection(tunnel, routeDirection) || tunnel?.detect;
            return { tunnelId, index, lat: gate?.lat };
        })
        .sort((left, right) => {
            if (typeof left.lat !== "number" || typeof right.lat !== "number") {
                return left.index - right.index;
            }
            if (routeDirection === "南行") return right.lat - left.lat;
            if (routeDirection === "北行") return left.lat - right.lat;
            return left.index - right.index;
        })
        .map(item => item.tunnelId);
}

function getTunnelGateForDirection(tunnel, routeDirection) {
    if (!tunnel?.gates) return null;
    if (routeDirection === "南行") return tunnel.gates.south || tunnel.gates.north || null;
    if (routeDirection === "北行") return tunnel.gates.north || tunnel.gates.south || null;
    return tunnel.gates.north || tunnel.gates.south || null;
}

function getTunnelTollDetails(tunnelId, direction, targetDate, reason) {
    const tunnel = getTunnelById(tunnelId);
    if (!tunnel) return [];
    return [{
        id: tunnel.id,
        name: tunnel.name,
        direction,
        toll: getToll(tunnel, targetDate),
        rule: getTunnelTollRule(tunnel, targetDate),
        reason
    }];
}

function getRouteTunnelTollDetails(response, direction, targetDate) {
    const routeDirection = getRouteDirection(response.routes[0]);
    return detectRouteTunnels(response.routes[0], routeDirection).map(hit => ({
        id: hit.tunnel.id,
        name: hit.tunnel.name,
        direction: `${direction}${routeDirection ? ` ${routeDirection}` : ""}`,
        toll: getToll(hit.tunnel, targetDate),
        rule: getTunnelTollRule(hit.tunnel, targetDate),
        reason: `${direction === "去程" ? "綠線" : "藍線"}碰到${routeDirection || ""}指定座標`
    }));
}

function getTunnelTollRule(tunnel, targetDate) {
    if (!tunnel) return "";
    if (tunnel.toll === "harbour") {
        const isSundayOrHoliday = targetDate.getDay() === 0 || HK_GENERAL_HOLIDAYS_2026.has(formatDateKey(targetDate));
        return `${isSundayOrHoliday ? "星期日/公眾假期" : "平日"}分時段收費`;
    }
    if (tunnel.toll === "tlt") return "大欖隧道分時段收費";
    return "固定收費";
}

function detectRouteTunnels(route, routeDirection = getRouteDirection(route)) {
    const routePoints = route.legs.flatMap(leg =>
        leg.steps.flatMap(step => step.path || [])
    ).map(pointToLatLng);
    const geometryMatches = TUNNEL_DATA
        .map(tunnel => routePathTouchesTunnel(routePoints, tunnel, routeDirection))
        .filter(Boolean);

    return uniqueTunnels(geometryMatches);
}

function detectRouteTunnelsByLegs(route, returnLegStart) {
    if (returnLegStart < 0) return detectRouteTunnels(route);

    return [
        ...detectRouteTunnels({ legs: route.legs.slice(0, returnLegStart) }),
        ...detectRouteTunnels({ legs: route.legs.slice(returnLegStart) })
    ];
}

function routePointTouchesTunnel(point, tunnel) {
    const radius = tunnel.radius || TUNNEL_DETECTION_RADIUS_M;
    if (tunnel.detect && distanceMeters(point, tunnel.detect) <= radius) return true;
    const gates = getTunnelGatePoints(tunnel);
    return gates.some(gate => distanceMeters(point, gate) <= radius);
}

function routePathTouchesTunnel(points, tunnel, routeDirection) {
    const radius = tunnel.radius || TUNNEL_DETECTION_RADIUS_M;
    const gates = getTunnelGatePoints(tunnel, routeDirection);

    for (let index = 1; index < points.length; index += 1) {
        const previous = points[index - 1];
        const current = points[index];

        if (tunnel.detect && distanceToSegmentMeters(tunnel.detect, previous, current) <= radius) {
            return {
                tunnel,
                travelDirection: routeDirection,
                hitIndex: index
            };
        }
        for (const gate of gates) {
            if (distanceToSegmentMeters(gate.point, previous, current) <= radius) {
                return {
                    tunnel,
                    travelDirection: routeDirection,
                    hitIndex: index
                };
            }
        }
    }
    return null;
}

function getTunnelGatePoints(tunnel, routeDirection = "") {
    if (tunnel.gates) {
        if (routeDirection === "南行" && tunnel.gates.south) return [{ key: "south", point: tunnel.gates.south }];
        if (routeDirection === "北行" && tunnel.gates.north) return [{ key: "north", point: tunnel.gates.north }];
        return Object.entries(tunnel.gates).map(([key, point]) => ({ key, point }));
    }
    if (tunnel.portals) {
        return tunnel.portals.map((point, index) => ({ key: index === 0 ? "south" : "north", point }));
    }
    return [];
}

function getRouteDirection(route) {
    const firstLeg = route.legs[0];
    const lastLeg = route.legs[route.legs.length - 1];
    const start = pointToLatLng(firstLeg.start_location);
    const end = pointToLatLng(lastLeg.end_location);
    if (start.lat > end.lat) return "南行";
    if (start.lat < end.lat) return "北行";
    return "";
}

function getTunnelById(id) {
    return TUNNEL_DATA.find(tunnel => tunnel.id === id);
}

function uniqueTunnels(tunnels) {
    const seen = new Set();
    return tunnels.filter(hit => {
        if (!hit?.tunnel || seen.has(hit.tunnel.id)) return false;
        seen.add(hit.tunnel.id);
        return true;
    });
}

function pointToLatLng(point) {
    return {
        lat: typeof point.lat === "function" ? point.lat() : point.lat,
        lng: typeof point.lng === "function" ? point.lng() : point.lng
    };
}

function distanceMeters(left, right) {
    const earthRadius = 6371000;
    const dLat = toRadians(right.lat - left.lat);
    const dLng = toRadians(right.lng - left.lng);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRadians(left.lat)) * Math.cos(toRadians(right.lat)) *
        Math.sin(dLng / 2) ** 2;
    return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function distanceToSegmentMeters(point, start, end) {
    const meanLat = toRadians((point.lat + start.lat + end.lat) / 3);
    const metersPerDegreeLat = 111320;
    const metersPerDegreeLng = Math.cos(meanLat) * 111320;
    const px = (point.lng - start.lng) * metersPerDegreeLng;
    const py = (point.lat - start.lat) * metersPerDegreeLat;
    const ex = (end.lng - start.lng) * metersPerDegreeLng;
    const ey = (end.lat - start.lat) * metersPerDegreeLat;
    const lengthSquared = (ex * ex) + (ey * ey);

    if (!lengthSquared) return distanceMeters(point, start);
    const ratio = Math.max(0, Math.min(1, ((px * ex) + (py * ey)) / lengthSquared));
    const closest = {
        lat: start.lat + ((end.lat - start.lat) * ratio),
        lng: start.lng + ((end.lng - start.lng) * ratio)
    };
    return distanceMeters(point, closest);
}

function toRadians(value) {
    return value * Math.PI / 180;
}

function getToll(tunnel, targetDate) {
    if (!tunnel) return 0;
    if (tunnel.toll === "harbour") {
        return getHarbourToll(tunnel.id, targetDate);
    }
    if (tunnel.toll === "tlt") return getTaiLamToll(targetDate);
    return tunnel.toll;
}

function getTaiLamToll(targetDate) {
    const minutes = targetDate.getHours() * 60 + targetDate.getMinutes();
    const isSundayOrHoliday = targetDate.getDay() === 0 || HK_GENERAL_HOLIDAYS_2026.has(formatDateKey(targetDate));
    const table = isSundayOrHoliday ? TAI_LAM_TOLL_TABLE.holiday : TAI_LAM_TOLL_TABLE.weekday;
    const segment = table.find(item => minutes >= item.start && minutes <= item.end);

    if (!segment) return 18;
    if (segment.toll !== undefined) return segment.toll;
    return transitionToll(minutes, segment);
}

function getHarbourToll(tunnelId, targetDate) {
    const minutes = targetDate.getHours() * 60 + targetDate.getMinutes();
    const isSundayOrHoliday = targetDate.getDay() === 0 || HK_GENERAL_HOLIDAYS_2026.has(formatDateKey(targetDate));
    const group = tunnelId === "whc" ? "western" : "easternCrossHarbour";
    const table = HARBOUR_TOLL_TABLE[isSundayOrHoliday ? "holiday" : "weekday"][group];
    const segment = table.find(item => minutes >= item.start && minutes <= item.end);

    if (!segment) return 20;
    if (segment.toll !== undefined) return segment.toll;
    return transitionToll(minutes, segment);
}

const HARBOUR_TOLL_TABLE = {
    weekday: {
        western: [
            fixedSegment("00:00", "07:29", 20),
            transitionSegment("07:30", "08:07", 22, 2, 2),
            fixedSegment("08:08", "10:14", 60),
            transitionSegment("10:15", "10:42", 58, -2, 2),
            fixedSegment("10:43", "16:29", 30),
            transitionSegment("16:30", "16:57", 32, 2, 2),
            fixedSegment("16:58", "18:59", 60),
            transitionSegment("19:00", "19:37", 58, -2, 2),
            fixedSegment("19:38", "23:59", 20)
        ],
        easternCrossHarbour: [
            fixedSegment("00:00", "07:29", 20),
            transitionSegment("07:30", "07:47", 22, 2, 2),
            fixedSegment("07:48", "10:14", 40),
            transitionSegment("10:15", "10:22", 38, -2, 2),
            fixedSegment("10:23", "16:29", 30),
            transitionSegment("16:30", "16:37", 32, 2, 2),
            fixedSegment("16:38", "18:59", 40),
            transitionSegment("19:00", "19:17", 38, -2, 2),
            fixedSegment("19:18", "23:59", 20)
        ]
    },
    holiday: {
        western: [
            fixedSegment("00:00", "10:10", 20),
            transitionSegment("10:11", "10:14", 21, 2, 2),
            fixedSegment("10:15", "19:14", 25),
            transitionSegment("19:15", "19:18", 23, -2, 2),
            fixedSegment("19:19", "23:59", 20)
        ],
        easternCrossHarbour: [
            fixedSegment("00:00", "10:10", 20),
            transitionSegment("10:11", "10:14", 21, 2, 2),
            fixedSegment("10:15", "19:14", 25),
            transitionSegment("19:15", "19:18", 23, -2, 2),
            fixedSegment("19:19", "23:59", 20)
        ]
    }
};

const TAI_LAM_TOLL_TABLE = {
    weekday: [
        fixedSegment("00:00", "07:14", 18),
        transitionSegment("07:15", "07:40", 19, 2, 2),
        fixedSegment("07:41", "09:44", 45),
        transitionSegment("09:45", "09:58", 43, -2, 2),
        fixedSegment("09:59", "17:14", 30),
        transitionSegment("17:15", "17:28", 31, 2, 2),
        fixedSegment("17:29", "18:59", 45),
        transitionSegment("19:00", "19:25", 43, -2, 2),
        fixedSegment("19:26", "23:59", 18)
    ],
    holiday: [
        fixedSegment("00:00", "23:59", 18)
    ]
};

function transitionToll(minutes, segment) {
    const elapsed = Math.max(0, minutes - segment.start);
    const steps = Math.floor(elapsed / segment.stepMinutes);
    return segment.firstToll + (steps * segment.stepAmount);
}

function fixedSegment(start, end, toll) {
    return { start: timeToMinutes(start), end: timeToMinutes(end), toll };
}

function transitionSegment(start, end, firstToll, stepAmount, stepMinutes) {
    return {
        start: timeToMinutes(start),
        end: timeToMinutes(end),
        firstToll,
        stepAmount,
        stepMinutes
    };
}

function timeToMinutes(value) {
    const [hours, minutes] = value.split(":").map(Number);
    return (hours * 60) + minutes;
}

function formatDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
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

    document.getElementById("arrival-title").textContent = durationMin ? `預計 ${durationMin} 分鐘` : "路線未能計算";
    document.getElementById("summary-origin").textContent = route.origin;
    document.getElementById("summary-destination").textContent = route.destination;
    document.getElementById("summary-return-destination").textContent = route.returnDestination || "-";
    const summaryStops = route.stagingPosts.map((point, index) => ({ label: `途經點 ${index + 1}`, point }));
    document.getElementById("summary-waypoints").innerHTML = summaryStops
        .map(point => `
            <div class="summary-waypoint">
                <span class="dot"></span>
                <div>
                    <small>${escapeHtml(point.label)}</small>
                    <strong>${escapeHtml(point.point)}</strong>
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
    renderTunnelBreakdown(route.tunnelDetails || []);

    renderDirections(route);
}

function renderTunnelBreakdown(tunnelDetails) {
    const tunnelNames = document.getElementById("tunnel-names");
    const tunnelCalculation = document.getElementById("tunnel-calculation");
    if (!tunnelNames || !tunnelCalculation) return;

    if (!tunnelDetails.length) {
        tunnelNames.textContent = "沒有偵測到收費隧道";
        tunnelCalculation.textContent = "隧道費：HK$0";
        return;
    }

    tunnelNames.textContent = tunnelDetails.map(item => `${item.direction}：${item.name}`).join("、");
    tunnelCalculation.textContent = tunnelDetails
        .map(item => `${item.direction} ${item.name} HK$${item.toll}（${item.rule}，${item.reason}）`)
        .join(" + ");
}

function renderDirections(route) {
    if (returnPolyline) {
        returnPolyline.setMap(null);
        returnPolyline = null;
    }
    if (!route.raw || !directionsRenderer) return;
    directionsRenderer.setDirections(route.raw);
    renderReturnPolyline(route);
}

function renderReturnPolyline(route) {
    if (!googleMap || !route.returnRaw) return;

    const returnPath = route.returnRaw.routes[0].legs
        .flatMap(leg => leg.steps.flatMap(step => step.path || []));

    if (!returnPath.length) return;
    returnPolyline = new google.maps.Polyline({
        path: returnPath,
        map: googleMap,
        strokeColor: "#2f7df6",
        strokeOpacity: 0.92,
        strokeWeight: 5,
        zIndex: 20
    });
}

function showTrip() {
    tripSheet.classList.remove("is-compact");
    collapseIcon.textContent = "expand_more";
    app.dataset.view = "trip";
}

function showSearch() {
    app.dataset.view = "search";
}

function goHome() {
    window.location.href = "home.html";
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

    input.value = "正在取得目前位置...";
    navigator.geolocation.getCurrentPosition(
        position => {
            const location = { lat: position.coords.latitude, lng: position.coords.longitude };
            if (googleMap) googleMap.panTo(location);
            resolveAddress(location, input);
        },
        () => {
            input.value = "";
            alert("未能取得目前位置，請手動輸入地址。");
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
