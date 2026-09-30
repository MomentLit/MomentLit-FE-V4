import type { NextRequest } from "next/server";

type GeocodeResponse = {
  response?: {
    status?: string;
    result?: { point?: { x?: string; y?: string } };
  };
};

export async function GET(request: NextRequest) {
  const key = process.env.NEXT_PUBLIC_VWORLD_API_KEY;
  if (!key) return Response.json({ message: "지도 연결 설정이 필요합니다." }, { status: 503 });
  const address = request.nextUrl.searchParams.get("address")?.trim();
  if (!address || address.length > 300) return Response.json({ message: "주소를 확인해 주세요." }, { status: 400 });
  try {
    for (const type of ["ROAD", "PARCEL"]) {
      const query = new URLSearchParams({
        service: "address", request: "getcoord", version: "2.0", crs: "EPSG:4326",
        address, format: "json", type, key,
        domain: process.env.NEXT_PUBLIC_VWORLD_DOMAIN || request.nextUrl.origin,
      });
      const upstream = await fetch(`https://api.vworld.kr/req/address?${query}`, {
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(8000)]),
        cache: "no-store",
      });
      if (!upstream.ok) throw new Error("Geocoding request failed");
      const data = await upstream.json() as GeocodeResponse;
      if (data.response?.status === "NOT_FOUND") continue;
      const point = data.response?.result?.point;
      const longitude = Number(point?.x);
      const latitude = Number(point?.y);
      if (data.response?.status !== "OK" || !Number.isFinite(longitude) || !Number.isFinite(latitude) ||
          longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
        throw new Error("Invalid geocoding response");
      }
      return Response.json({ longitude, latitude });
    }
    return Response.json({ message: "주소의 위치를 찾지 못했어요." }, { status: 404 });
  } catch {
    return Response.json({ message: "위치 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요." }, { status: 502 });
  }
}
