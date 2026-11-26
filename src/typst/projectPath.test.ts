import { describe, expect, it } from "vitest";
import { typstImageHref } from "./projectPath";

describe("typstImageHref", () => {
  it("keeps a relative image path unchanged", () => {
    expect(typstImageHref("../art/a.png", "/vault")).toBe("../art/a.png");
  });

  it("resolves a leading slash against the project root", () => {
    expect(typstImageHref("/assets/a.png", "/vault/")).toBe(
      "/vault/assets/a.png",
    );
  });

  it("normalizes a Windows project root", () => {
    expect(typstImageHref("/assets/a.png", "C:\\vault")).toBe(
      "C:/vault/assets/a.png",
    );
  });

  it("rejects a root path that escapes the project", () => {
    expect(typstImageHref("/../secret.png", "/vault")).toBeUndefined();
  });

  it("keeps the href when no project root is known", () => {
    expect(typstImageHref("/assets/a.png", undefined)).toBe("/assets/a.png");
  });
});
