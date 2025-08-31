export function setDomHiddenUntilFound(dom: HTMLElement): void {
  // @ts-expect-error - 'until-found' is a valid value for the hidden attribute in some browsers
  // but not yet in TypeScript's DOM types
  dom.hidden = "until-found"
}

// Extend HTMLElement to include onbeforematch
declare global {
  interface HTMLElement {
    onbeforematch: (() => void) | null;
  }
}

export function domOnBeforeMatch(dom: HTMLElement, callback: () => void): void {
  dom.onbeforematch = callback
}
