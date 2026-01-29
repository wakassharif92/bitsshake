import type { NextApiRequest, NextApiResponse } from "next";

interface LocationResponse {
  country?: string;
  city?: string;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<LocationResponse>,
) {
  try {
    const { ip } = req.query;

    if (!ip || typeof ip !== "string") {
      return res.status(200).json({ country: "Unknown", city: "Unknown" });
    }

    // Use ip-api.com with https and proper error handling
    const geoResponse = await fetch(
      `https://ip-api.com/json/${ip}?fields=country,city,status,message`,
      {
        method: "GET",
        headers: {
          "User-Agent": "BitsShake/1.0",
        },
      },
    );

    if (!geoResponse.ok) {
      console.error("Geolocation API response not ok:", geoResponse.status);
      return res.status(200).json({ country: "Unknown", city: "Unknown" });
    }

    const geoData = await geoResponse.json();

    // Check if the API returned success
    if (geoData.status === "success") {
      return res.status(200).json({
        country: geoData.country || "Unknown",
        city: geoData.city || "Unknown",
      });
    } else {
      console.error("Geolocation API error:", geoData.message);
      return res.status(200).json({ country: "Unknown", city: "Unknown" });
    }
  } catch (error: any) {
    console.error("Error fetching location:", error);
    return res.status(200).json({ country: "Unknown", city: "Unknown" });
  }
}
