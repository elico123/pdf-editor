// tests/utils.test.mjs
import { describe, test, expect, beforeEach, afterEach, jest, beforeAll } from '@jest/globals';
// NO static imports from ../js/utils.mjs here

// Define the mock objects that will be provided by the mocked domElements.mjs
const mockedLoaderOverlay = {
    classList: {
        add: jest.fn(),
        remove: jest.fn(),
    },
    style: {},
};

const mockedLoaderText = {
    textContent: '',
};

// No longer mocking domElements.mjs globally as we will inject dependencies.

describe('Utility Functions', () => {
    describe('hexToRgb', () => {
        let hexToRgb;

        beforeAll(async () => {
            const utils = await import('../js/utils.mjs');
            hexToRgb = utils.hexToRgb;
        });

        test('should convert valid hex color (with #) to RGB object', () => {
            expect(hexToRgb('#FF0000')).toEqual({ r: 255, g: 0, b: 0 });
            expect(hexToRgb('#00FF00')).toEqual({ r: 0, g: 255, b: 0 });
            expect(hexToRgb('#0000FF')).toEqual({ r: 0, g: 0, b: 255 });
            expect(hexToRgb('#ABC')).toEqual({ r: 170, g: 187, b: 204 }); // Short hex
        });

        test('should convert valid hex color (without #) to RGB object', () => {
            expect(hexToRgb('FF0000')).toEqual({ r: 255, g: 0, b: 0 });
            expect(hexToRgb('00ff00')).toEqual({ r: 0, g: 255, b: 0 }); // Lowercase
        });

        test('should return null for invalid hex color strings', () => {
            expect(hexToRgb('#F00F')).toBeNull(); // Invalid length
            expect(hexToRgb('12345')).toBeNull();  // Invalid length
            expect(hexToRgb('#GGHHII')).toBeNull(); // Invalid characters
            expect(hexToRgb('NotAHex')).toBeNull();
            expect(hexToRgb('')).toBeNull();
            expect(hexToRgb(null)).toBeNull();
            expect(hexToRgb(undefined)).toBeNull();
        });

        test('should handle mixed case hex codes', () => {
            expect(hexToRgb('#fF00aA')).toEqual({ r: 255, g: 0, b: 170 });
        });
    });

    describe('hasRtl', () => {
        let hasRtl;

        beforeAll(async () => {
            const utils = await import('../js/utils.mjs');
            hasRtl = utils.hasRtl;
        });

        test('should return true for strings containing Hebrew characters', () => {
            expect(hasRtl('שלום עולם')).toBe(true);
            expect(hasRtl('Hello שלום World')).toBe(true);
        });

        test('should return true for strings containing Arabic characters', () => {
            expect(hasRtl('مرحبا بالعالم')).toBe(true);
            expect(hasRtl('Hello مرحبا World')).toBe(true);
        });

        test('should return false for strings with only LTR characters', () => {
            expect(hasRtl('Hello World')).toBe(false);
            expect(hasRtl('12345')).toBe(false);
            expect(hasRtl('!@#$%^')).toBe(false);
        });

        test('should return false for an empty string', () => {
            expect(hasRtl('')).toBe(false);
        });

        test('should handle mixed LTR and RTL characters correctly', () => {
            expect(hasRtl('English text with عربي in the middle.')).toBe(true);
            expect(hasRtl('עברית then English.')).toBe(true);
        });
    });

    describe('DOM-interacting Utilities', () => {
        let showLoader, hideLoader, downloadBlob;
        let mockAnchorElement;
        let mockDocumentBody;

        // Import utils once for this suite. No complex mocking needed here anymore for these.
        beforeAll(async () => {
            const utilsModule = await import('../js/utils.mjs');
            showLoader = utilsModule.showLoader;
            hideLoader = utilsModule.hideLoader;
            downloadBlob = utilsModule.downloadBlob;
        });

        beforeEach(() => { // No longer async, no special module resets or re-imports needed here for domElements
            // Reset our predefined mock objects before each test
            mockedLoaderOverlay.classList.add.mockClear();
            mockedLoaderOverlay.classList.remove.mockClear();
            mockedLoaderText.textContent = '';

            // Mock for downloadBlob
            mockAnchorElement = {
                href: '',
                download: '',
                style: { display: '' },
                click: jest.fn(),
            };
            mockDocumentBody = {
                appendChild: jest.fn(),
                removeChild: jest.fn(),
            };

            global.URL.createObjectURL = jest.fn(() => 'blob:http://localhost/mock-url');
            global.URL.revokeObjectURL = jest.fn();

            jest.spyOn(document, 'createElement').mockReturnValue(mockAnchorElement);
            Object.defineProperty(document, 'body', { value: mockDocumentBody, configurable: true, writable: true });
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });

        describe('showLoader', () => {
            test('should make loader visible and set text', () => {
                // Now passing mocks directly
                showLoader('Loading...', mockedLoaderText, mockedLoaderOverlay);
                // Assertions are made on our predefined mock objects
                expect(mockedLoaderOverlay.classList.remove).toHaveBeenCalledWith('hidden');
                expect(mockedLoaderText.textContent).toBe('Loading...');
            });
        });

        describe('hideLoader', () => {
            test('should hide loader', () => {
                // Now passing mock directly
                hideLoader(mockedLoaderOverlay);
                expect(mockedLoaderOverlay.classList.add).toHaveBeenCalledWith('hidden');
            });
        });

        describe('downloadBlob', () => {
            test('should trigger download of a blob', () => {
                const fakeData = new Uint8Array([1, 2, 3]);
                const fileName = 'test.pdf';

                downloadBlob(fakeData, fileName);

                expect(global.URL.createObjectURL).toHaveBeenCalled();
                expect(mockAnchorElement.href).toBe('blob:http://localhost/mock-url');
                expect(mockAnchorElement.download).toBe(fileName);
                expect(mockDocumentBody.appendChild).toHaveBeenCalledWith(mockAnchorElement);
                expect(mockAnchorElement.click).toHaveBeenCalled();
                expect(mockDocumentBody.removeChild).toHaveBeenCalledWith(mockAnchorElement);
                expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:http://localhost/mock-url');
            });
        });
    });
});
