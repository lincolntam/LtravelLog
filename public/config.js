export async function getMapsKey() {
  const res = await fetch("/api/config");
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Failed to load Google Maps API key");
  }

  return data.mapsApiKey;
}
