import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import { TextEncoder, TextDecoder } from 'util';
// parsePdfCustomData will be imported dynamically in beforeEach

// Make TextEncoder/TextDecoder available if not already (for JSDOM env)
if (typeof global.TextEncoder === 'undefined') {
    global.TextEncoder = TextEncoder;
}
if (typeof global.TextDecoder === 'undefined') {
    global.TextDecoder = TextDecoder as any;
}

// Note: jest.mock for '../js/debug.ts' will be moved into beforeEach using jest.doMock

describe('parsePdfCustomData', () => {
    let mockPDFHexStringConstructor: any;
    let mockPDFStringConstructor: any;
    let parsePdfCustomData: any; // To hold the dynamically imported function
    let mockLogDebugFn: jest.Mock; // Declare mock function variable

    beforeEach(async () => {
        jest.resetModules(); // Reset modules before each test to ensure fresh mocks

        // Define the mock function for logDebug
        mockLogDebugFn = jest.fn();

        // Use doMock for '../js/debug.ts' to ensure it's mocked before pdfMetadata imports it
        jest.doMock('../js/debug.ts', () => ({
            __esModule: true,
            logDebug: mockLogDebugFn,
            initDebugSystem: jest.fn(),
        }));

        // Dynamically import here to ensure it gets fresh mocks, using .js extension
        const pdfMetadataModule = await import('../js/pdfMetadata.js');
        parsePdfCustomData = pdfMetadataModule.parsePdfCustomData;

        // These are mock constructors. The instances created by them will be checked by 'instanceof'.
        mockPDFHexStringConstructor = jest.fn().mockImplementation(function (this: any) {
            // 'this' refers to the instance being created by 'new mockPDFHexStringConstructor()'
            // We can add properties to 'this' if needed for other tests, but for instanceof,
            // just being constructed by this mock is key.
        });

        mockPDFStringConstructor = jest.fn().mockImplementation(function (this: any) {
            // Similarly for PDFString
        });
    });

    // Helper to create instances that will pass 'instanceof mockPDFHexStringConstructor'
    const createMockPdfHexStringInstance = (bytes: Uint8Array) => {
        const instance = new mockPDFHexStringConstructor();
        instance.decode = jest.fn(() => bytes);
        return instance;
    };

    // Helper to create instances that will pass 'instanceof mockPDFStringConstructor'
    const createMockPdfStringInstance = (bytes: Uint8Array, simulateBrokenGetBytes = false) => {
        const instance = new mockPDFStringConstructor();
        instance.getBytes = jest.fn(() => {
            if (simulateBrokenGetBytes) throw new Error("Simulated getBytes error");
            return bytes;
        });
        instance.asString = jest.fn(() => new TextDecoder('latin1').decode(bytes));
        return instance;
    };

    test('should return null if customDataValue is null or undefined', () => {
        expect(parsePdfCustomData(null, mockPDFHexStringConstructor, mockPDFStringConstructor)).toBeNull();
        // expect(mockLogDebugFn).toHaveBeenCalledWith("parsePdfCustomData: No custom data value provided.");
        // Clear mock for the second call within the same test, or ensure it's a separate test.
        // mockLogDebugFn.mockClear();
        expect(parsePdfCustomData(undefined, mockPDFHexStringConstructor, mockPDFStringConstructor)).toBeNull();
        // expect(mockLogDebugFn).toHaveBeenCalledWith("parsePdfCustomData: No custom data value provided.");
    });

    test('should correctly parse data from PDFHexString', () => {
        const hebrewText = "בדיקה הקסדצימלית";
        const data = { textObjects: [{ text: hebrewText }], redactionAreas: [] };
        const jsonData = JSON.stringify(data);
        const utf8Bytes = new TextEncoder().encode(jsonData);
        const hexStringInstance = createMockPdfHexStringInstance(utf8Bytes);

        const result = parsePdfCustomData(hexStringInstance, mockPDFHexStringConstructor, mockPDFStringConstructor);
        expect(result).toEqual(data);
        expect(hexStringInstance.decode).toHaveBeenCalled();
        // expect(mockLogDebugFn).toHaveBeenCalledWith(expect.stringContaining("PDFHexString data using UTF-8 via decode()"), expect.anything());
    });

    test('should correctly parse data from PDFString using getBytes', () => {
        const hebrewText = "בדיקת מחרוזת";
        const data = { textObjects: [{ text: hebrewText }], redactionAreas: [] };
        const jsonData = JSON.stringify(data);
        const utf8Bytes = new TextEncoder().encode(jsonData);
        const stringInstance = createMockPdfStringInstance(utf8Bytes);

        const result = parsePdfCustomData(stringInstance, mockPDFHexStringConstructor, mockPDFStringConstructor);
        expect(result).toEqual(data);
        expect(stringInstance.getBytes).toHaveBeenCalled();
        expect(stringInstance.asString).not.toHaveBeenCalled();
        // expect(mockLogDebugFn).toHaveBeenCalledWith(expect.stringContaining("PDFString data using UTF-8 via getBytes()"), expect.anything());
    });

    test('should fallback to asString for PDFString if getBytes fails', () => {
        const text = "Fallback Test";
        const data = { textObjects: [{ text: text }], redactionAreas: [] };
        const jsonData = JSON.stringify(data);
        const utf8Bytes = new TextEncoder().encode(jsonData);

        const latin1DecodedJson = new TextDecoder('latin1').decode(utf8Bytes);

        const stringInstance = createMockPdfStringInstance(utf8Bytes, true);
        stringInstance.asString = jest.fn(() => latin1DecodedJson); // Override asString for this specific instance

        const result = parsePdfCustomData(stringInstance, mockPDFHexStringConstructor, mockPDFStringConstructor);

        const expectedDataAfterFallback = JSON.parse(latin1DecodedJson);

        expect(result).toEqual(expectedDataAfterFallback);
        expect(stringInstance.getBytes).toHaveBeenCalled();
        expect(stringInstance.asString).toHaveBeenCalled();
        // expect(mockLogDebugFn).toHaveBeenCalledWith(expect.stringContaining("Failed to getBytes() from PDFString"), expect.anything());
        // expect(mockLogDebugFn).toHaveBeenCalledWith(expect.stringContaining("Decoded PDFString data using asString() (fallback)"), expect.anything());
    });

    test('should return null for unknown data types', () => {
        const unknownData = {
            someOtherField: "value",
            // constructor: { name: 'UnknownType' } // Not an instance of mocked constructors
        };
        // To make it not an instance of our mocked constructors, just pass a plain object
        expect(parsePdfCustomData(unknownData, mockPDFHexStringConstructor, mockPDFStringConstructor)).toBeNull();
        // expect(mockLogDebugFn).toHaveBeenCalledWith(expect.stringContaining("Custom editor data found, but it was not an instance of PDFHexString or PDFString"), expect.anything());
    });

    test('should return null if JSON parsing fails', () => {
        const invalidJsonBytes = new TextEncoder().encode("this is not json");
        const hexStringInstance = createMockPdfHexStringInstance(invalidJsonBytes);

        expect(parsePdfCustomData(hexStringInstance, mockPDFHexStringConstructor, mockPDFStringConstructor)).toBeNull();
        // expect(mockLogDebugFn).toHaveBeenCalledWith("parsePdfCustomData: Error parsing custom data JSON.", expect.anything());
    });

    test('should return null if parsed JSON data does not have expected structure', () => {
        const incompleteData = { textObjects: [{ text: "test" }] }; // Missing redactionAreas
        const jsonData = JSON.stringify(incompleteData);
        const utf8Bytes = new TextEncoder().encode(jsonData);
        const hexStringInstance = createMockPdfHexStringInstance(utf8Bytes);

        const result = parsePdfCustomData(hexStringInstance, mockPDFHexStringConstructor, mockPDFStringConstructor);
        expect(result).toBeNull();
        // expect(mockLogDebugFn).toHaveBeenCalledWith("parsePdfCustomData: Parsed JSON data does not have the expected structure.", incompleteData);
    });
});
