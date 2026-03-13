import '@testing-library/jest-dom/vitest';

if (typeof HTMLElement !== 'undefined') {
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    value: () => {},
    configurable: true
  });

  Object.defineProperty(HTMLElement.prototype, 'getClientRects', {
    value: () => {
      const rect = {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        toJSON: () => ({})
      };

      return {
        0: rect,
        item: () => rect,
        length: 1
      };
    },
    configurable: true
  });
}

if (typeof document !== 'undefined' && typeof document.elementFromPoint !== 'function') {
  Object.defineProperty(document, 'elementFromPoint', {
    value: () => document.body,
    configurable: true
  });
}
