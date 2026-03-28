type EventMap = HTMLElementEventMap & DocumentEventMap;

interface ElementOptions {
  className?: string;
  text?: string;
  attrs?: Record<string, string | number | boolean | null | undefined>;
  dataset?: Record<string, string>;
  children?: Array<Node | null | undefined>;
  on?: Partial<{
    [K in keyof EventMap]: (event: EventMap[K]) => void;
  }>;
}

export function createElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  options: ElementOptions = {},
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tagName);

  if (options.className) {
    element.className = options.className;
  }

  if (options.text !== undefined) {
    element.textContent = options.text;
  }

  for (const [name, value] of Object.entries(options.attrs ?? {})) {
    if (value === null || value === undefined || value === false) {
      continue;
    }

    if (value === true) {
      element.setAttribute(name, '');
      continue;
    }

    element.setAttribute(name, String(value));
  }

  Object.assign(element.dataset, options.dataset);

  for (const child of options.children ?? []) {
    if (child) {
      element.append(child);
    }
  }

  for (const [eventName, handler] of Object.entries(options.on ?? {})) {
    if (handler) {
      element.addEventListener(eventName, handler as EventListener);
    }
  }

  return element;
}
