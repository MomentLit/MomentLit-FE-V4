import type { NextRequest } from "next/server";

type GeocodeResponse = {
  response?: {
    status?: string;
    error?: { code?: string };
    result?: { point?: { x?: string; y?: string } };
  };
};

export async function GET(request: NextRequest) {
  const key = process.env.NEXT_PUBLIC_VWORLD_API_KEY;
  if (!key) return Response.json({ message: "지도 연결 설정이 필요합니다." }, { status: 503 });
  const address = request.nextUrl.searchParams.get("address")?.trim();
  if (!address || address.length > 300) return Response.json({ message: "주소를 확인해 주세요." }, { status: 400 });
  const domain = process.env.VWORLD_DOMAIN || process.env.NEXT_PUBLIC_VWORLD_DOMAIN || request.nextUrl.origin;
  const domainSource = process.env.VWORLD_DOMAIN ? "VWORLD_DOMAIN"
    : process.env.NEXT_PUBLIC_VWORLD_DOMAIN ? "NEXT_PUBLIC_VWORLD_DOMAIN" : "request origin";
  let diagnostic: Record<string, string | number | undefined> = { domainSource };
  try {
    for (const type of ["ROAD", "PARCEL"]) {
      const query = new URLSearchParams({
        service: "address", request: "getcoord", version: "2.0", crs: "EPSG:4326",
        address, format: "json", type, key,
        domain,
      });
      diagnostic = { domainSource, type, stage: "fetch" };
      const upstream = await fetch(`https://api.vworld.kr/req/address?${query}`, {
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(8000)]),
        cache: "no-store",
      });
      diagnostic = { domainSource, type, httpStatus: upstream.status, contentType: upstream.headers.get("content-type") ?? undefined };
      if (!upstream.ok) throw new Error("Geocoding request failed");
      const data = await upstream.json() as GeocodeResponse;
      diagnostic = { ...diagnostic, vworldStatus: data.response?.status, vworldErrorCode: data.response?.error?.code };
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
  } catch (error) {
    const cause = error instanceof Error ? error.cause : undefined;
    const causeCode = cause && typeof cause === "object" && "code" in cause && typeof cause.code === "string"
      ? cause.code : undefined;
    const nestedCodes = cause instanceof AggregateError
      ? cause.errors.flatMap((item: unknown) => item && typeof item === "object" && "code" in item && typeof item.code === "string" ? [item.code] : [])
      : [];
    console.error("VWorld geocoding failed", {
      ...diagnostic,
      errorName: error instanceof Error ? error.name : "unknown",
      errorMessage: error instanceof Error && error.message === "fetch failed" ? error.message : undefined,
      causeName: cause instanceof Error ? cause.name : undefined,
      causeCode,
      nestedCodes: nestedCodes.length ? nestedCodes : undefined,
    });
    return Response.json({ message: "위치 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요." }, { status: 502 });
  }
}
