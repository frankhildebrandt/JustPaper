import { EditorView, WidgetType } from "@codemirror/view";
import { toggleTodoCheck } from "./parseTodo";
import { isPrimaryClick } from "./todoToggle";

/** Accessible name of a task checkbox; its state comes from `aria-checked`. */
export const TODO_BOX_LABEL = "Aufgabe erledigt";

/**
 * Renders a soft line break (`\` / two trailing spaces) as a real break.
 */
export class LinebreakWidget extends WidgetType {
  eq(): boolean {
    return true;
  }

  toDOM(): HTMLElement {
    const breakEl = document.createElement("br");
    breakEl.className = "md-linebreak";
    return breakEl;
  }
}

/**
 * Renders a replacement glyph for hidden source text (e.g. a Typst symbol).
 */
export class GlyphWidget extends WidgetType {
  constructor(readonly glyph: string) {
    super();
  }

  eq(other: GlyphWidget): boolean {
    return this.glyph === other.glyph;
  }

  toDOM(): HTMLElement {
    const el = document.createElement("span");
    el.className = "md-glyph";
    el.textContent = this.glyph;
    return el;
  }
}

/**
 * Renders a task box. A primary click toggles it only while the editor is
 * editable (Edit surface); in the read-only View surface it is display-only.
 */
export class TodoWidget extends WidgetType {
  constructor(
    readonly checked: boolean,
    readonly interactive: boolean,
  ) {
    super();
  }

  eq(other: TodoWidget): boolean {
    return (
      this.checked === other.checked && this.interactive === other.interactive
    );
  }

  toDOM(view: EditorView): HTMLElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = this.checked ? "md-todo-box is-checked" : "md-todo-box";
    button.setAttribute("role", "checkbox");
    button.setAttribute("aria-checked", this.checked ? "true" : "false");
    button.setAttribute("aria-label", TODO_BOX_LABEL);
    if (!this.interactive) {
      button.setAttribute("aria-readonly", "true");
    }
    button.innerHTML =
      '<svg class="md-todo-tick" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.2 6.2 4.8 8.8 9.8 3.2"/></svg>';
    button.addEventListener("mousedown", (event) => {
      if (!isPrimaryClick(event) || view.state.readOnly) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      toggleTodoAt(view, view.posAtDOM(button));
    });
    return button;
  }

  ignoreEvent(event: Event): boolean {
    return event.type !== "mousedown" && event.type !== "click";
  }
}

/**
 * Renders an image; if it fails to load, the widget's own frame swaps the
 * image for the alt-text fallback so the widget root stays in place.
 */
export class ImageWidget extends WidgetType {
  constructor(
    readonly src: string | undefined,
    readonly alt: string,
  ) {
    super();
  }

  eq(other: ImageWidget): boolean {
    return this.src === other.src && this.alt === other.alt;
  }

  toDOM(): HTMLElement {
    if (!this.src) {
      return imageFallback(this.alt);
    }
    const frame = document.createElement("span");
    frame.className = "md-image-frame";
    const img = document.createElement("img");
    img.className = "md-image-widget";
    img.alt = this.alt;
    img.src = this.src;
    img.addEventListener("error", () => {
      frame.classList.add("is-broken");
      frame.replaceChildren(imageFallback(this.alt));
    });
    frame.append(img);
    return frame;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

function toggleTodoAt(view: EditorView, pos: number): void {
  const next = toggleTodoCheck(view.state.doc.toString(), pos);
  if (!next) {
    return;
  }
  view.dispatch({
    changes: { from: next.from, to: next.to, insert: next.insert },
  });
}

function imageFallback(alt: string): HTMLElement {
  const fallback = document.createElement("span");
  fallback.className = "md-image-fallback";
  fallback.textContent = alt || "Bild";
  return fallback;
}
