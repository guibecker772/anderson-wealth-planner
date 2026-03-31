// jest.setup.js
// Add any global test setup here

const { TextDecoder, TextEncoder } = require('util');

if (!global.TextEncoder) {
  global.TextEncoder = TextEncoder;
}

if (!global.TextDecoder) {
  global.TextDecoder = TextDecoder;
}

// Extend expect with custom matchers if needed
// import '@testing-library/jest-dom';
