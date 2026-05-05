let map, ds, dr;

async function initMap() {
  const res = await fetch('/api/config');
  const config = await res.json();

  const script = document.createElement('script');
  script.src = `https://maps.googleapis.com/maps/api/js?key=${config.mapsApiKey}&libraries=places&callback=setupMap`;
  document.head.appendChild(script);
}

function setupMap() {
  map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: 22.3, lng: 114.1 },
    zoom: 12
  });

  ds = new google.maps.DirectionsService();
  dr = new google.maps.DirectionsRenderer();
  dr.setMap(map);

  new google.maps.places.Autocomplete(document.getElementById("start"));
  new google.maps.places.Autocomplete(document.getElementById("end"));
}

async function calculate() {
  const start = document.getElementById("start").value;
  const end = document.getElementById("end").value;

  if (!start || !end) return;

  document.getElementById("search-card").style.display = "none";
  document.getElementById("result-card").style.display = "block";

  document.getElementById("pickup-text").innerText = start;
  document.getElementById("dropoff-text").innerText = end;

  ds.route({
    origin: start,
    destination: end,
    travelMode: "DRIVING"
  }, (res, status) => {
    if (status === "OK") {
      dr.setDirections(res);

      const leg = res.routes[0].legs[0];
      const km = leg.distance.value / 1000;
      const time = leg.duration.value / 60;

      const energy = km * 0.16 * 1.7;
      const tunnel = 30;
      const total = energy + tunnel;

      document.getElementById("km").innerText = km.toFixed(1);
      document.getElementById("duration").innerText = Math.round(time);
      document.getElementById("e-cost").innerText = energy.toFixed(1);
      document.getElementById("t-fee").innerText = tunnel;
      document.getElementById("total").innerText = total.toFixed(1);
    }
  });
}

function resetView() {
  document.getElementById("search-card").style.display = "block";
  document.getElementById("result-card").style.display = "none";
}

initMap();