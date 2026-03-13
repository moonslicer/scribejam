import '@testing-library/jest-dom/vitest';

Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
  value: () => {},
  configurable: true
});
