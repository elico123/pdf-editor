import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import { TextEncoder, TextDecoder } from 'util';
// parsePdfCustomData will be imported dynamically in beforeEach

// Make TextEncoder/TextDecoder available if not already (for JSDOM env)
if (typeof global.TextEncoder === 'undefined') {
    global.TextEncoder = TextEncoder;
}
if (typeof global.TextDecoder === 'undefined') {
    global.TextDecoder = TextDecoder;
}

// Note: jest.mock for '../js/debug.js' will be moved into beforeEach using jest.doMock

describe('parsePdfCustomData', () => {
    let mockPDFHexStringConstructor;
    let mockPDFStringConstructor;
    let parsePdfCustomData; // To hold the dynamically imported function
    /** @type {jest.Mock} */
    let mockLogDebugFn; // Declare mock function variable

    beforeEach(async () => {
        jest.resetModules(); // Reset modules before each test to ensure fresh mocks

        // Define the mock function for logDebug
        mockLogDebugFn = jest.fn();

        // Use doMock for '../js/debug.js' to ensure it's mocked before pdfMetadata imports it
        jest.doMock('../js/debug.js', () => ({
            __esModule: true,
            logDebug: mockLogDebugFn,
            initDebugSystem: jest.fn(),
        }));

        // Dynamically import here to ensure it gets fresh mocks
        const pdfMetadataModule = await import('../js/pdfMetadata.js');
        parsePdfCustomData = pdfMetadataModule.parsePdfCustomData;

        mockPDFHexStringConstructor = jest.fn().mockImplementation(function () {
            // 'this' refers to the instance being created by 'new mockPDFHexStringConstructor()'
        });

        mockPDFStringConstructor = jest.fn().mockImplementation(function () {
            // Similarly for PDFString
        });
    });

    /**
     * @param {string} hexString The hex string (e.g., "0123456789abcdef")
     * @returns {object}
     */
    const createMockPdfHexStringInstance = (hexString) => {
        const instance = new mockPDFHexStringConstructor();
        // Store the raw hex string, and simulate the <...> format if not present.
        const formattedHexString = hexString.startsWith('<') ? hexString : `<${hexString}>`;
        instance.toString = jest.fn(() => formattedHexString);
        // The decode method is no longer directly called by parsePdfCustomData,
        // but if other parts of the code (outside the SUT) were to use it,
        // we can still mock its expected behavior based on the hex.
        instance.decode = jest.fn(() => {
            const cleanHex = formattedHexString.replace(/[<>]/g, '');
            const bytes = new Uint8Array(cleanHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
            return bytes;
        });
        return instance;
    };

    /**
     * @param {Uint8Array} bytes
     * @param {boolean} [simulateBrokenGetBytes=false]
     * @returns {object}
     */
    const createMockPdfStringInstance = (bytes, simulateBrokenGetBytes = false) => {
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
        expect(parsePdfCustomData(undefined, mockPDFHexStringConstructor, mockPDFStringConstructor)).toBeNull();
    });

    test('should correctly parse data from PDFHexString', () => {
        const hebrewText = "בדיקה הקסדצימלית";
        const data = { textObjects: [{ text: hebrewText }], redactionAreas: [] };
        const jsonData = JSON.stringify(data);
        const utf8Bytes = new TextEncoder().encode(jsonData);
        // Convert bytes to a hex string for the mock
        const hexString = Array.from(utf8Bytes).map(b => b.toString(16).padStart(2, '0')).join('');
        const hexStringInstance = createMockPdfHexStringInstance(hexString);

        const result = parsePdfCustomData(hexStringInstance, mockPDFHexStringConstructor, mockPDFStringConstructor);
        expect(result).toEqual(data);
        expect(hexStringInstance.toString).toHaveBeenCalled();
        // expect(hexStringInstance.decode).not.toHaveBeenCalled(); // decode is no longer called by parsePdfCustomData
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
    });

    test('should return null if getBytes fails for PDFString', () => {
        const text = "Fallback Test";
        const data = { textObjects: [{ text: text }], redactionAreas: [] };
        const jsonData = JSON.stringify(data);
        const utf8Bytes = new TextEncoder().encode(jsonData);

        // const latin1DecodedJson = new TextDecoder('latin1').decode(utf8Bytes); // No longer needed

        const stringInstance = createMockPdfStringInstance(utf8Bytes, true);
        // stringInstance.asString = jest.fn(() => latin1DecodedJson); // No longer needed

        const result = parsePdfCustomData(stringInstance, mockPDFHexStringConstructor, mockPDFStringConstructor);

        // const expectedDataAfterFallback = JSON.parse(latin1DecodedJson); // No longer needed

        expect(result).toBeNull(); // Expect null now
        expect(stringInstance.getBytes).toHaveBeenCalled();
        expect(stringInstance.asString).not.toHaveBeenCalled(); // Verify asString is NOT called
    });

    test('should return null for unknown data types', () => {
        const unknownData = {
            someOtherField: "value",
        };
        expect(parsePdfCustomData(unknownData, mockPDFHexStringConstructor, mockPDFStringConstructor)).toBeNull();
    });

    test('should return null if JSON parsing fails', () => {
        const invalidJsonBytes = new TextEncoder().encode("this is not json");
        // Convert bytes to a hex string for the mock
        const hexString = Array.from(invalidJsonBytes).map(b => b.toString(16).padStart(2, '0')).join('');
        const hexStringInstance = createMockPdfHexStringInstance(hexString);

        expect(parsePdfCustomData(hexStringInstance, mockPDFHexStringConstructor, mockPDFStringConstructor)).toBeNull();
    });

    test('should return null if parsed JSON data does not have expected structure', () => {
        const incompleteData = { textObjects: [{ text: "test" }] }; // Missing redactionAreas
        const jsonData = JSON.stringify(incompleteData);
        const utf8Bytes = new TextEncoder().encode(jsonData);
        // Convert bytes to a hex string for the mock
        const hexString = Array.from(utf8Bytes).map(b => b.toString(16).padStart(2, '0')).join('');
        const hexStringInstance = createMockPdfHexStringInstance(hexString);

        const result = parsePdfCustomData(hexStringInstance, mockPDFHexStringConstructor, mockPDFStringConstructor);
        expect(result).toBeNull();
    });
});
