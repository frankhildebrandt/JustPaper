import { describe, expect, it } from "vitest";
import {
  applyForgetRecent,
  applyNew,
  applyOpen,
  applyOpenFolder,
  applyRename,
  applySave,
  createDocumentSession,
  isDirty,
} from "./documentSession";

describe("isDirty", () => {
  it("is clean when the editor matches the last saved text", () => {
    expect(isDirty(createDocumentSession(), "")).toBe(false);
  });

  it("is dirty after the editor text changes", () => {
    expect(isDirty(createDocumentSession(), "hello")).toBe(true);
  });
});

describe("applyNew", () => {
  it("clears the path and snapshot while keeping recents", () => {
    const session = applyNew({
      path: "/notes.md",
      lastSaved: "hello",
      recents: ["/notes.md"],
      projectRoot: "/vault",
    });

    expect(session).toEqual({
      path: null,
      lastSaved: "",
      recents: ["/notes.md"],
      projectRoot: "/vault",
    });
    expect(isDirty(session, "")).toBe(false);
  });
});

describe("applyOpen", () => {
  it("adopts the file and remembers it as most recent", () => {
    const session = applyOpen(
      { path: null, lastSaved: "", recents: ["/old.md"], projectRoot: "/vault" },
      "/notes.md",
      "# Hello",
    );

    expect(session).toEqual({
      path: "/notes.md",
      lastSaved: "# Hello",
      recents: ["/notes.md", "/old.md"],
      projectRoot: "/vault",
    });
    expect(isDirty(session, "# Hello")).toBe(false);
  });
});

describe("applySave", () => {
  it("records the saved path and snapshot", () => {
    const session = applySave(
      { path: null, lastSaved: "", recents: [], projectRoot: null },
      "/notes.md",
      "hello",
    );

    expect(session).toEqual({
      path: "/notes.md",
      lastSaved: "hello",
      recents: ["/notes.md"],
      projectRoot: null,
    });
    expect(isDirty(session, "hello")).toBe(false);
  });

  it("moves Save As to a new path", () => {
    const session = applySave(
      { path: "/old.md", lastSaved: "hello", recents: ["/old.md"], projectRoot: null },
      "/new.md",
      "hello",
    );

    expect(session.path).toBe("/new.md");
    expect(session.recents).toEqual(["/new.md", "/old.md"]);
  });
});

describe("applyForgetRecent", () => {
  it("drops a missing recent without changing the open document", () => {
    const session = applyForgetRecent(
      {
        path: "/notes.md",
        lastSaved: "hello",
        recents: ["/notes.md", "/gone.md"],
        projectRoot: "/vault",
      },
      "/gone.md",
    );

    expect(session).toEqual({
      path: "/notes.md",
      lastSaved: "hello",
      recents: ["/notes.md"],
      projectRoot: "/vault",
    });
  });
});

describe("createDocumentSession", () => {
  it("starts untitled without a project root", () => {
    expect(createDocumentSession()).toEqual({
      path: null,
      lastSaved: "",
      recents: [],
      projectRoot: null,
    });
  });
});

describe("applyOpenFolder", () => {
  it("sets the project root without changing the open document", () => {
    const session = applyOpenFolder(
      {
        path: "/vault/notes.md",
        lastSaved: "hello",
        recents: ["/vault/notes.md"],
        projectRoot: null,
      },
      "/vault",
    );

    expect(session).toEqual({
      path: "/vault/notes.md",
      lastSaved: "hello",
      recents: ["/vault/notes.md"],
      projectRoot: "/vault",
    });
  });
});

describe("applyRename", () => {
  it("moves the open path and recent entry", () => {
    const session = applyRename(
      {
        path: "/vault/Hello.md",
        lastSaved: "hello",
        recents: ["/vault/Hello.md", "/other.md"],
        projectRoot: "/vault",
      },
      "/vault/World.md",
    );

    expect(session).toEqual({
      path: "/vault/World.md",
      lastSaved: "hello",
      recents: ["/vault/World.md", "/other.md"],
      projectRoot: "/vault",
    });
  });
});
