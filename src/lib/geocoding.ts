export interface GeocodeResult {
  latitude: number;
  longitude: number;
  displayName?: string;
}

export interface StructuredAddress {
  street?: string;
  city?: string;
  postalCode?: string;
  country?: string;
}

const USER_AGENT = "SaleorVendorPortal/1.0 (Contact: jop@salp.shop)";

/**
 * Geocodes a structured address using Nominatim (OpenStreetMap).
 * Respects the 1-second delay policy by implementing a simple retry on 429.
 */
export async function geocodeAddress(addr: StructuredAddress): Promise<GeocodeResult | null> {
  const params = new URLSearchParams({
    format: "json",
    limit: "1",
    street: addr.street || "",
    city: addr.city || "",
    postalcode: addr.postalCode || "",
    country: addr.country || "",
  });

  const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
      },
    });

    if (response.status === 429) {
      console.warn("Nominatim Rate Limit hit. Retrying in 2 seconds...");
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return geocodeAddress(addr);
    }

    if (!response.ok) {
        // Log status but don't crash
        console.error(`Nominatim responded with ${response.status}: ${response.statusText}`);
        return null;
    }

    const data = await response.json();
    if (data && data.length > 0) {
      return {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon),
        displayName: data[0].display_name,
      };
    }
    
    // Fallback: Try with just city and country if full address fails
    if (addr.street || addr.postalCode) {
        console.warn(`Exact match failed for ${addr.street}, trying city fallback...`);
        return geocodeAddress({ city: addr.city, country: addr.country });
    }

    return null;
  } catch (error) {
    console.error("Geocoding exception:", error);
    return null;
  }
}
