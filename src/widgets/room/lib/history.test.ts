import { describe, expect, it } from "vitest";
import { applyHistory, createHistory, HISTORY_LIMIT, redoHistory, undoHistory } from "./history";

describe("history", () => {
  it("되돌리면 바꾸기 전 값으로, 다시 실행하면 바꾼 값으로 돌아간다", () => {
    let history = createHistory([1]);
    history = applyHistory(history, [1, 2], true);
    history = applyHistory(history, [1, 2, 3], true);
    history = undoHistory(history);
    expect(history.present).toEqual([1, 2]);
    history = undoHistory(history);
    expect(history.present).toEqual([1]);
    history = redoHistory(history);
    expect(history.present).toEqual([1, 2]);
  });

  it("기록하지 않은 변경은 앞 단계에 합쳐진다(끌기 한 번 = 되돌리기 한 번)", () => {
    let history = createHistory("a");
    history = applyHistory(history, "b", true);
    history = applyHistory(history, "c", false);
    history = applyHistory(history, "d", false);
    expect(undoHistory(history).present).toBe("a");
  });

  it("새로 바꾸면 다시 실행 기록은 버린다", () => {
    let history = createHistory(0);
    history = applyHistory(history, 1, true);
    history = undoHistory(history);
    history = applyHistory(history, 2, true);
    expect(redoHistory(history)).toBe(history);
  });

  it("값이 그대로면 기록하지 않고, 기록이 없으면 되돌리지 않는다", () => {
    const history = createHistory("x");
    expect(applyHistory(history, "x", true)).toBe(history);
    expect(undoHistory(history)).toBe(history);
  });

  it(`기록은 ${HISTORY_LIMIT}개까지만 남긴다`, () => {
    let history = createHistory(0);
    for (let i = 1; i <= HISTORY_LIMIT + 10; i++) history = applyHistory(history, i, true);
    expect(history.past).toHaveLength(HISTORY_LIMIT);
    expect(history.past[0]).toBe(10);
  });
});
