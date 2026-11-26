import { EditorState } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ImageWidget, TODO_BOX_LABEL, TodoWidget } from "./inlineWidgets";

type Listener = (event: unknown) => void;

/**
 * Just enough of an element for widget DOM tests without a DOM library.
 */
class FakeElement {
  className = "";
  textContent = "";
  innerHTML = "";
  type = "";
  alt = "";
  src = "";
  children: FakeElement[] = [];
  attributes = new Map<string, string>();
  listeners = new Map<string, Listener[]>();
  classList = {
    add: (name: string) => {
      this.className = `${this.className} ${name}`.trim();
    },
  };

  constructor(readonly tagName: string) {}

  append(...nodes: FakeElement[]): void {
    this.children.push(...nodes);
  }

  replaceChildren(...nodes: FakeElement[]): void {
    this.children = nodes;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  addEventListener(type: string, listener: Listener): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  fire(type: string, event: unknown = {}): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

beforeEach(() => {
  vi.stubGlobal("document", {
    createElement: (tag: string) => new FakeElement(tag),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ImageWidget", () => {
  it("keeps its root and swaps the image for the alt text on load errors", () => {
    const root = new ImageWidget("missing.png", "Diagramm").toDOM() as unknown as FakeElement;
    const img = root.children[0];

    img.fire("error");

    expect(root.className).toBe("md-image-frame is-broken");
    expect(root.children).toHaveLength(1);
    expect(root.children[0].className).toBe("md-image-fallback");
    expect(root.children[0].textContent).toBe("Diagramm");
  });
});

describe("TodoWidget", () => {
  function fakeView(readOnly: boolean) {
    const state = EditorState.create({
      doc: "- [ ] milk",
      extensions: [EditorState.readOnly.of(readOnly)],
    });
    return {
      state,
      posAtDOM: () => 2,
      dispatch: vi.fn(),
    };
  }

  function mousedown(overrides: Partial<MouseEvent> = {}) {
    return {
      button: 0,
      ctrlKey: false,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      ...overrides,
    };
  }

  it("uses one German label for both states", () => {
    const view = fakeView(false) as unknown as EditorView;
    const open = new TodoWidget(false, true).toDOM(view) as unknown as FakeElement;
    const done = new TodoWidget(true, true).toDOM(view) as unknown as FakeElement;
    expect(open.attributes.get("aria-label")).toBe(TODO_BOX_LABEL);
    expect(done.attributes.get("aria-label")).toBe(TODO_BOX_LABEL);
    expect(done.attributes.get("aria-checked")).toBe("true");
  });

  it("toggles on a primary click in the editable surface", () => {
    const view = fakeView(false);
    const box = new TodoWidget(false, true).toDOM(
      view as unknown as EditorView,
    ) as unknown as FakeElement;

    box.fire("mousedown", mousedown());

    expect(view.dispatch).toHaveBeenCalledWith({
      changes: { from: 3, to: 4, insert: "x" },
    });
  });

  it("does not toggle on secondary clicks", () => {
    const view = fakeView(false);
    const box = new TodoWidget(false, true).toDOM(
      view as unknown as EditorView,
    ) as unknown as FakeElement;

    box.fire("mousedown", mousedown({ button: 2 }));

    expect(view.dispatch).not.toHaveBeenCalled();
  });

  it("does not mutate the document in the read-only View surface", () => {
    const view = fakeView(true);
    const box = new TodoWidget(false, false).toDOM(
      view as unknown as EditorView,
    ) as unknown as FakeElement;

    box.fire("mousedown", mousedown());

    expect(view.dispatch).not.toHaveBeenCalled();
    expect(box.attributes.get("aria-readonly")).toBe("true");
  });
});
