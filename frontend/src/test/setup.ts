import '@testing-library/jest-dom';

// Provide basic canvas 2d context mock for jsdom (used by JsBarcode text measuring)
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = function (contextType: string) {
    if (contextType === '2d') {
      return {
        measureText: (text: string) => ({ width: text.length * 10 }),
        clearRect: () => {},
        fillRect: () => {},
        fillText: () => {},
      } as unknown as CanvasRenderingContext2D;
    }
    return null;
  } as any;
}
