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
  const token = process.env.IPINFO_TOKEN;
  if (!token) return null;

  const response = await fetch(`https://ipinfo.io/${ip}?token=${token}`, {
    method: "GET",
    headers: {
      "User-Agent": "BitsShake/1.0",
    },
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  return normalizeLocation(data.country, data.city);
};

const fetchIpApi = async (ip: string) => {
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
    return null;
  }

  const data = await response.json();
  if (data.status === "success") {
    return normalizeLocation(data.country, data.city);
  }

  return null;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<LocationResponse>,
) {
  try {
    const { ip } = req.query;

    if (!ip || typeof ip !== "string") {
      return res.status(200).json(normalizeLocation());
    }

    const ipinfoResult = await fetchIpinfo(ip);
    if (ipinfoResult) {
      return res.status(200).json(ipinfoResult);
    }

    const ipApiResult = await fetchIpApi(ip);
    if (ipApiResult) {
      return res.status(200).json(ipApiResult);
    }

    return res.status(200).json(normalizeLocation());
  } catch (error: any) {
    console.error("Error fetching location:", error);
    return res.status(200).json(normalizeLocation());
  }
}
