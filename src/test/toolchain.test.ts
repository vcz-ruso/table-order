import { describe, expect, it } from "vitest";
import fc from "fast-check";

// 개발환경(테스트 툴체인) 동작 확인용 sanity 테스트.
// 실제 기능 테스트는 이후 설계 문서를 기반으로 추가됩니다.
describe("toolchain sanity", () => {
  it("vitest 가 동작한다", () => {
    expect(1 + 1).toBe(2);
  });

  it("fast-check(PBT) 가 동작한다", () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (a, b) => {
        expect(a + b).toBe(b + a);
      }),
    );
  });
});
