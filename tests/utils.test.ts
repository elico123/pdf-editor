// tests/utils.test.mjs
import { describe, test, expect, beforeEach, afterEach, jest, beforeAll } from '@jest/globals';
// NO static imports from ../js/utils.mjs here

// Define types for mock objects
interface MockHTMLElement {
    classList: {
        add: jest.Mock;
        remove: jest.Mock;
    };
    style: Partial<CSSStyleDeclaration>; // Using Partial as we might not mock all style properties
    textContent?: string | null;
}

const mockedLoaderOverlay: MockHTMLElement = {
    classList: {
        add: jest.fn(),
        remove: jest.fn(),
    },
    style: {},
};

const mockedLoaderText: MockHTMLElement = {
    classList: { // Add to satisfy MockHTMLElement, even if not directly used by mockedLoaderText
        add: jest.fn(),
        remove: jest.fn(),
    },
    style: {},
    textContent: '',
};

// Mock the domElements module
// The factory function now returns our predefined mock objects.
// Note: The actual domElements.ts exports HTMLElement | null, but our mocks are simplified.
// This discrepancy is fine for testing the logic of utils.ts as long as the properties utils.ts uses are present.
// jest.mock('../js/domElements.js', () => ({ // Or .ts - let's try .js first
//     loaderOverlay: mockedLoaderOverlay,
//     loaderText: mockedLoaderText,
// }));
// ^^^ No longer needed due to dependency injection in utils.ts functions

// Define a type for the dynamically imported module
// This should reflect the actual exports from js/utils.ts
interface UtilsModule {
    hexToRgb: (hex: string | null | undefined) => ({ r: number; g: number; b: number } | null);
    hasRtl: (s: string) => boolean;
    // Updated signatures for showLoader and hideLoader
    showLoader: (text: string, loaderTextParam?: HTMLElement | null, loaderOverlayParam?: HTMLElement | null) => void;
    hideLoader: (loaderOverlayParam?: HTMLElement | null) => void;
    downloadBlob: (data: Uint8Array, fileName: string) => void;
}


describe('Utility Functions', () => {
    describe('hexToRgb', () => {
        let hexToRgb: UtilsModule['hexToRgb'];

        beforeAll(async () => {
            const utils = await import('../js/utils') as unknown as UtilsModule;
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
        let hasRtl: UtilsModule['hasRtl'];

        beforeAll(async () => {
            const utils = await import('../js/utils') as unknown as UtilsModule;
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
        let showLoader: UtilsModule['showLoader'];
        let hideLoader: UtilsModule['hideLoader'];
        let downloadBlob: UtilsModule['downloadBlob'];

        interface MockAnchorElement {
            href: string;
            download: string;
            style: Partial<CSSStyleDeclaration>;
            click: jest.Mock;
            // appendChild and removeChild are not part of anchor, but of document.body
        }

        interface MockDocumentBody {
            appendChild: jest.Mock;
            removeChild: jest.Mock;
        }

        let mockAnchorElement: MockAnchorElement;
        let mockDocumentBody: MockDocumentBody;

        beforeAll(async () => {
            // Dynamically import the DOM-interacting functions
            const utils = await import('../js/utils') as unknown as UtilsModule;
            showLoader = utils.showLoader;
            hideLoader = utils.hideLoader;
            downloadBlob = utils.downloadBlob;
        });

        beforeEach(() => {
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

            (global.URL.createObjectURL as jest.Mock) = jest.fn(() => 'blob:http://localhost/mock-url');
            global.URL.revokeObjectURL = jest.fn();

            jest.spyOn(document, 'createElement').mockReturnValue(mockAnchorElement as unknown as HTMLAnchorElement);
            Object.defineProperty(document, 'body', { value: mockDocumentBody, configurable: true, writable: true });
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });

        describe('showLoader', () => {
            test('should make loader visible and set text', () => {
                // Pass mocks directly. Cast to `any` or `unknown as HTMLElement | null` as MockHTMLElement is not a true HTMLElement.
                showLoader('Loading...', mockedLoaderText as any, mockedLoaderOverlay as any);
                // Assertions are made on our predefined mock objects
                expect(mockedLoaderOverlay.classList.remove).toHaveBeenCalledWith('hidden');
                expect(mockedLoaderText.textContent).toBe('Loading...');
            });
        });

        describe('hideLoader', () => {
            test('should hide loader', () => {
                // Pass mock directly
                hideLoader(mockedLoaderOverlay as any);
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
