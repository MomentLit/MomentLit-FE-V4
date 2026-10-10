import { SPACE_CATEGORY_LABELS } from "@/entities/space-category";
import { formatAddress, formatPrice } from "@/widgets/search-page/lib/format";
import type { SpacePin } from "../model";

const PIN_PATH = "M16 0C7.163 0 0 7.163 0 16c0 11.046 16 26 16 26s16-14.954 16-26C32 7.163 24.837 0 16 0z";

function buildPin(selected: boolean): SVGSVGElement {
  const size = selected ? 26 : 20;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size * (42 / 32)));
  svg.setAttribute("viewBox", "0 0 32 42");
  svg.style.display = "block";
  svg.innerHTML = `
    <path d="${PIN_PATH}" fill="${selected ? "var(--lemon)" : "var(--sky)"}" stroke="var(--ink)" stroke-width="1.5"/>
    <circle cx="16" cy="16" r="6.5" fill="#fff"/>
  `;
  return svg;
}

function buildPreviewCard(pin: SpacePin): HTMLDivElement {
  const card = document.createElement("div");
  card.className =
    "pointer-events-none absolute bottom-[calc(100%+10px)] left-1/2 w-[200px] -translate-x-1/2 overflow-hidden rounded-xl border border-line bg-white opacity-0 shadow-lg transition-opacity duration-150";

  const photo = document.createElement("div");
  photo.className = "relative aspect-3/2 w-full overflow-hidden bg-wash";
  if (pin.space.thumbnail_url) {
    const img = document.createElement("img");
    img.src = pin.space.thumbnail_url;
    img.alt = "";
    img.className = "h-full w-full object-cover";
    photo.appendChild(img);
  }
  card.appendChild(photo);

  const body = document.createElement("div");
  body.className = "flex flex-col gap-0.5 px-3 py-2.5";

  const category = document.createElement("span");
  category.className = "font-mono text-[0.6rem] uppercase tracking-[0.12em] text-soft";
  category.textContent = SPACE_CATEGORY_LABELS[pin.space.category];
  body.appendChild(category);

  const name = document.createElement("span");
  name.className = "line-clamp-1 text-sm font-bold tracking-tight text-ink";
  name.textContent = pin.space.name;
  body.appendChild(name);

  const address = document.createElement("span");
  address.className = "line-clamp-1 text-xs text-soft";
  address.textContent = formatAddress(pin.space.address);
  body.appendChild(address);

  const price = document.createElement("span");
  price.className = "mt-0.5 text-xs font-bold text-ink";
  price.textContent = formatPrice(pin.space.price_per_hour, pin.space.usage_unit);
  body.appendChild(price);

  card.appendChild(body);
  return card;
}

/** 핀 모양 마커 + 호버 시 뜨는 공간 미리보기 카드. Kakao CustomOverlay content로 그대로 꽂아 쓴다. */
export function buildMarkerContent(pin: SpacePin, selected: boolean, onSelect: () => void): HTMLDivElement {
  const wrapper = document.createElement("div");
  wrapper.style.cssText = "position:relative;display:flex;flex-direction:column;align-items:center;cursor:pointer;";
  wrapper.appendChild(buildPin(selected));

  if (selected) {
    const label = document.createElement("span");
    label.textContent = pin.space.name;
    label.style.cssText =
      "margin-top:2px;padding:2px 6px;background:#fff;border:1px solid var(--ink);border-radius:4px;font:bold 12px sans-serif;color:var(--ink);white-space:nowrap;";
    wrapper.appendChild(label);
  }

  const preview = buildPreviewCard(pin);
  wrapper.appendChild(preview);
  wrapper.addEventListener("mouseenter", () => {
    preview.style.opacity = "1";
    wrapper.style.zIndex = "50";
  });
  wrapper.addEventListener("mouseleave", () => {
    preview.style.opacity = "0";
    wrapper.style.zIndex = "";
  });
  wrapper.addEventListener("click", onSelect);

  return wrapper;
}
