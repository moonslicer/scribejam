import '@testing-library/jest-dom/vitest';

if (typeof HTMLElement !== 'undefined') {
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    value: () => {},
    configurable: true
  });
}
