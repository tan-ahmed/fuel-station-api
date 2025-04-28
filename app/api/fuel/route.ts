// app/api/fuel/route.ts
import { NextRequest, NextResponse } from "next/server";

interface FuelStation {
  site_id: string;
  brand: string;
  address: string;
  postcode: string;
  location: {
    latitude: string;
    longitude: string;
  };
  prices: Record<string, number>;
}

const sources = [
  {
    name: "Applegreen UK",
    url: "https://applegreenstores.com/fuel-prices/data.json",
  },
  {
    name: "Ascona Group",
    url: "https://fuelprices.asconagroup.co.uk/newfuel.json",
  },
  { name: "Asda", url: "https://storelocator.asda.com/fuel_prices_data.json" },
  // {
  //   name: "bp",
  //   url: "https://www.bp.com/en_gb/uk/home/fuelprices/fuel_prices_data.json",
  // },
  {
    name: "Esso Tesco Alliance",
    url: "https://fuelprices.esso.co.uk/latestdata.json",
  },
  {
    name: "JET Retail UK",
    url: "https://jetlocal.co.uk/fuel_prices_data.json",
  },
  {
    name: "Karan Retail Ltd",
    url: "https://api2.krlmedia.com/integration/live_price/krl",
  },
  { name: "Morrisons", url: "https://www.morrisons.com/fuel-prices/fuel.json" },
  { name: "Moto", url: "https://moto-way.com/fuel-price/fuel_prices.json" },
  {
    name: "Motor Fuel Group",
    url: "https://fuel.motorfuelgroup.com/fuel_prices_data.json",
  },
  {
    name: "Rontec",
    url: "https://www.rontec-servicestations.co.uk/fuel-prices/data/fuel_prices_data.json",
  },
  {
    name: "Sainsbury’s",
    url: "https://api.sainsburys.co.uk/v1/exports/latest/fuel_prices_data.json",
  },
  { name: "Shell", url: "https://www.shell.co.uk/fuel-prices-data.html" },
  {
    name: "Tesco",
    url: "https://www.tesco.com/fuel_prices/fuel_prices_data.json",
  },
];

async function fetchJson(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      next: { revalidate: 60 },
    });

    if (!res.ok) throw new Error(`Failed to fetch ${url}`);
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function getAllStations(): Promise<FuelStation[]> {
  const stations: FuelStation[] = [];

  await Promise.all(
    sources.map(async (source) => {
      try {
        const data = await fetchJson(source.url);
        const stationArray = Array.isArray(data) ? data : data.stations;

        if (!Array.isArray(stationArray)) {
          console.warn(`Unexpected structure from ${source.name}`);
          return;
        }

        stationArray.forEach((station: FuelStation) => {
          if (!station.site_id || !station.address || !station.location) return;

          stations.push({
            site_id: station.site_id,
            brand: station.brand || source.name,
            address: station.address,
            postcode: station.postcode,
            location: {
              latitude: String(station.location.latitude),
              longitude: String(station.location.longitude),
            },
            prices: station.prices || {},
          });
        });
      } catch (error) {
        console.error(`Error fetching ${source.name}:`, error);
      }
    })
  );

  return stations;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.toLowerCase();

  if (!query || query.trim() === "") {
    return NextResponse.json(
      {
        error: "Please provide a city or town name in the `q` query parameter.",
      },
      { status: 400 }
    );
  }

  const stations = await getAllStations();

  const results = stations.filter((station) =>
    station.address.toLowerCase().includes(query)
  );

  return NextResponse.json({ stations: results });
}
