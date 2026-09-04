import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const CI_WORKFLOWS = [
  ".github/workflows/ci.yml",
  ".github/workflows/release.yml",
];

function readWorkflow(path: string): string {
  return readFileSync(path, "utf8").replace(/\r\n?/g, "\n");
}

describe("workflow security", () => {
  it("pins every remote action to an immutable commit", () => {
    for (const path of CI_WORKFLOWS) {
      const workflow = readWorkflow(path);
      const uses = [...workflow.matchAll(/\buses:\s*([^@\s]+)@([^\s#]+)/g)];
      expect(uses.length, `${path} should contain actions`).toBeGreaterThan(0);
      for (const match of uses) {
        expect(match[2], `${path}: ${match[0]}`).toMatch(/^[0-9a-f]{40}$/);
      }
    }
  });

  it("validates the source before any release matrix job", () => {
    const workflow = readWorkflow(".github/workflows/release.yml");
    expect(workflow).toContain("validate-release:");
    expect(workflow).toMatch(/publish-tauri:\n\s+needs: validate-release/);
    expect(workflow).toContain(
      '[[ "$GITHUB_REF_NAME" =~ ^v[0-9]+\\.[0-9]+\\.[0-9]+$ ]]',
    );
    expect(workflow).toContain('test "$GITHUB_REF_NAME" = "v$version"');
    expect(workflow).toContain('test "$version" = "$cargo_lock_version"');
    expect(workflow).toContain(
      'git merge-base --is-ancestor "$release_sha" origin/main',
    );
    expect(workflow).toContain(
      "ref: ${{ needs.validate-release.outputs.sha }}",
    );
  });
});
