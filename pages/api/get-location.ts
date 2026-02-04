import type { NextApiRequest, NextApiResponse } from "next";

interface LocationResponse {
  country?: string;
  city?: string;
  error?: string;
}

const normalizeLocation = (country?: string, city?: string) => ({
  country: country || "Unknown",
  city: city || "Unknown",
});

const fetchIpinfo = async (ip: string) => {
  const token =
    process.env.NEXT_PUBLIC_IPINFO_TOKEN || process.env.IPINFO_TOKEN;
  if (!token) {
    console.log("No IPINFO_TOKEN found, skipping ipinfo.io");
    return null;
  }

  try {
    const response = await fetch(`https://ipinfo.io/${ip}?token=${token}`, {
      method: "GET",
      headers: {
        "User-Agent": "BitsShake/1.0",
      },
    });

    if (!response.ok) {
      console.log(`ipinfo.io returned status ${response.status}`);
      return null;
    }

    const data = await response.json();
    console.log(`ipinfo.io result for ${ip}:`, data);
    return normalizeLocation(data.country, data.city);
  } catch (err) {
    console.error("Error fetching from ipinfo.io:", err);
    return null;
  }
};

const fetchIpApi = async (ip: string) => {
  try {
    const response = await fetch(
      `https://ip-api.com/json/${ip}?fields=country,city,status,message`,
      {
        method: "GET",
        headers: {
          "User-Agent": "BitsShake/1.0",
        },
      },
    );

    if (!response.ok) {
      console.log(`ip-api.com returned status ${response.status}`);
      return null;
    }

    const data = await response.json();
    console.log(`ip-api.com result for ${ip}:`, data);
    if (data.status === "success") {
      return normalizeLocation(data.country, data.city);
    }

    console.log(
      `ip-api.com returned non-success status: ${data.status} - ${data.message}`,
    );
    return null;
  } catch (err) {
    console.error("Error fetching from ip-api.com:", err);
    return null;
  }
};

const fetchGeoJs = async (ip: string) => {
  try {
    console.log(`Trying geo.js for ${ip}`);
    const response = await fetch(`https://get.geojs.io/v1/ip/geo/${ip}.json`, {
      headers: {
        "User-Agent": "BitsShake/1.0",
      },
    });

    if (!response.ok) {
      console.log(`geo.js returned status ${response.status}`);
      return null;
    }

    const data = await response.json();
    console.log(`geo.js result for ${ip}:`, data);
    if (data.country || data.city) {
      return normalizeLocation(data.country, data.city);
    }

    return null;
  } catch (err) {
    console.error("Error fetching from geo.js:", err);
    return null;
  }
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<LocationResponse>,
) {
  try {
    const { ip } = req.query;

    if (!ip || typeof ip !== "string") {
      console.log("No IP provided to get-location");
      return res.status(200).json(normalizeLocation());
    }

    console.log(`Attempting to geolocate IP: ${ip}`);

    // Try ipinfo first (if token available)
    const ipinfoResult = await fetchIpinfo(ip);
    if (ipinfoResult) {
      console.log(`Using ipinfo result for ${ip}:`, ipinfoResult);
      return res.status(200).json(ipinfoResult);
    }

    // Try ip-api second
    const ipApiResult = await fetchIpApi(ip);
    if (ipApiResult) {
      console.log(`Using ip-api result for ${ip}:`, ipApiResult);
      return res.status(200).json(ipApiResult);
    }

    // Try geo.js third (free alternative)
    const geoJsResult = await fetchGeoJs(ip);
    if (geoJsResult) {
      console.log(`Using geo.js result for ${ip}:`, geoJsResult);
      return res.status(200).json(geoJsResult);
    }

    console.log(`No geolocation data found for ${ip}, returning Unknown`);
    return res.status(200).json(normalizeLocation());
  } catch (error: any) {
    console.error("Error fetching location:", error);
    return res.status(200).json(normalizeLocation());
  }
}
