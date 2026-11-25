import { describe, expect, it } from "vitest";
import { formatLayoutSavedAt } from "./layoutTime";

describe("저장한 배치 시간(한국 시간)", () => {
  it("시간대 없는 서버 시간(UTC)에 9시간을 더해 보여 준다", () => {
    expect(formatLayoutSavedAt("2026-11-25T14:47:00")).toBe("11/25 23:47");
    expect(formatLayoutSavedAt("2026-11-25T02:47:12.345678")).toBe("11/25 11:47");
  });

  it("자정을 넘기면 다음 날로 넘어간다", () => {
    expect(formatLayoutSavedAt("2026-11-25T15:00:00")).toBe("11/26 00:00");
    expect(formatLayoutSavedAt("2026-11-25T15:30:00")).toBe("11/26 00:30");
  });

  it("월말·연말을 넘겨도 날짜가 맞다", () => {
    expect(formatLayoutSavedAt("2026-11-30T20:05:00")).toBe("12/1 05:05");
    expect(formatLayoutSavedAt("2026-12-31T16:00:00")).toBe("1/1 01:00");
  });

  it("시간대가 붙어 오면 그 시간대로 읽어 더 더하지 않는다", () => {
    expect(formatLayoutSavedAt("2026-11-25T14:47:00Z")).toBe("11/25 23:47");
    expect(formatLayoutSavedAt("2026-11-25T23:47:00+09:00")).toBe("11/25 23:47");
  });

  it("읽을 수 없는 값이면 빈 문자열", () => {
    expect(formatLayoutSavedAt("")).toBe("");
    expect(formatLayoutSavedAt("not-a-date")).toBe("");
  });
});
