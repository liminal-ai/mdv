import { JSDOM } from 'jsdom';

export function createDOM(html?: string): JSDOM {
  return new JSDOM(html ?? '<!DOCTYPE html><html><body><div id="app"></div></body></html>', {
    url: 'http://localhost:3000',
    pretendToBeVisual: true,
  });
}

export function querySelector<T extends Element>(dom: JSDOM, selector: string): T {
  const el = dom.window.document.querySelector<T>(selector);
  if (!el) throw new Error(`Element not found: ${selector}`);
  return el;
}
