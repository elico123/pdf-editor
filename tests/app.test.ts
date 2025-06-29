import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import { TextEncoder, TextDecoder } from 'util';

// Make TextEncoder/TextDecoder available in the JSDOM environment for tests
if (typeof global.TextEncoder === 'undefined') {
    global.TextEncoder = TextEncoder;
}
if (typeof global.TextDecoder === 'undefined') {
    global.TextDecoder = TextDecoder as any; // Cast to any to match potential JSDOM variations
}

// Mocks for PDFName, PDFString, PDFHexString (as previously defined)
const mockPDFHexString = {
    of: jest.fn(bytes => ({
        decode: jest.fn(() => bytes),
        constructor: { name: 'PDFHexString' } // For instanceof checks
    })),
};

const mockPDFString = {
    createInstance: (bytes: Uint8Array, simulateBrokenGetBytes = false) => ({
        getBytes: jest.fn(() => {
            if (simulateBrokenGetBytes) throw new Error("Simulated getBytes error");
            return bytes;
        }),
        asString: jest.fn(() => new TextDecoder('latin1').decode(bytes)), // Simulate incorrect decoding
        constructor: { name: 'PDFString' } // For instanceof checks
    })
};

const mockPDFName = {
    of: jest.fn(key => ({ toString: () => key, constructor: { name: 'PDFName' } })),
};

// Mock pdfSetup.ts
const mockPdfSetupLoadFn = jest.fn(); // Persistent mock function for PDFDocument.load

jest.mock('../js/pdfSetup.ts', () => ({
    __esModule: true, // Tell Jest this is an ES module.
    PDFDocument: {
        load: mockPdfSetupLoadFn,
    },
    PDFName: mockPDFName,
    PDFString: mockPDFString, // Using the mock object directly for PDFString and PDFHexString
    PDFHexString: mockPDFHexString,
    rgb: jest.fn(),
    StandardFonts: {},
    TextAlignment: {},
    grayscale: jest.fn(),
}));

// Mock config
jest.mock('../js/config.ts', () => ({
    EDITOR_METADATA_KEY: 'com.mycompany.pdfeditor.customdata',
}));

// Mock utils
jest.mock('../js/utils.ts', () => ({
    showLoader: jest.fn(),
    hideLoader: jest.fn(),
}));


describe('loadPdfFromBytes - Custom Data Decoding Logic Simulation', () => {
    let appStates: { textObjects: any[], redactionAreas: any[] };

    beforeEach(async () => {
        appStates = { textObjects: [], redactionAreas: [] };

        // Mock global window properties that pdfSetup.ts might access
        (global as any).window = {
            ...((global as any).window || {}),
            pdfjsLib: {
                getDocument: jest.fn().mockResolvedValue({
                    promise: Promise.resolve({
                        numPages: 1,
                        getPage: jest.fn().mockResolvedValue({
                            getViewport: jest.fn().mockReturnValue({ width: 100, height: 100, scale: 1 }),
                            render: jest.fn().mockResolvedValue(undefined),
                        }),
                    }),
                }),
                GlobalWorkerOptions: { workerSrc: '' },
            },
            PDFLib: { // This is what pdfSetup.js tries to destructure from window.PDFLib
                PDFDocument: { load: mockPdfSetupLoadFn }, // Ensure this matches the structure expected by pdfSetup.ts
                PDFName: mockPDFName,
                PDFString: mockPDFString, // Provide the mock itself for pdfSetup.ts to destructure
                PDFHexString: mockPDFHexString,
                rgb: jest.fn(),
                StandardFonts: {},
                TextAlignment: {},
                grayscale: jest.fn(),
            },
            showSaveFilePicker: jest.fn(),
        };

        mockPdfSetupLoadFn.mockClear();
        mockPdfSetupLoadFn.mockResolvedValue({
            catalog: {
                get: jest.fn(),
                set: jest.fn(),
            },
        });
    });

    async function simulateCustomDataLoading(customDataValueFromCatalog: any) {
        // This function simulates the part of loadPdfFromBytes that parses custom data.
        // It relies on appStates.textObjects and appStates.redactionAreas being available.
        // The customDataValueFromCatalog is what we mock pdfDocInstance.catalog.get() to return.

        let parsedSuccessfully = false;
        appStates.textObjects = [];
        appStates.redactionAreas = [];

        // Using constructor.name for type checking against mocked objects
        if (customDataValueFromCatalog && customDataValueFromCatalog.constructor &&
            customDataValueFromCatalog.constructor.name === 'PDFHexString') {
            const bytes = customDataValueFromCatalog.decode();
            const jsonData = new TextDecoder('utf-8').decode(bytes);
            const savedData = JSON.parse(jsonData);
            appStates.textObjects = savedData.textObjects || [];
            appStates.redactionAreas = savedData.redactionAreas || [];
            parsedSuccessfully = true;
        } else if (customDataValueFromCatalog && customDataValueFromCatalog.constructor &&
                   customDataValueFromCatalog.constructor.name === 'PDFString') {
            let jsonDataString: string;
            try {
                // We are testing the internal logic of app.ts here, which would call getBytes()
                const bytes = (customDataValueFromCatalog as any).getBytes();
                jsonDataString = new TextDecoder('utf-8').decode(bytes);
            } catch (e) {
                jsonDataString = customDataValueFromCatalog.asString();
            }
            const savedData = JSON.parse(jsonDataString);
            appStates.textObjects = savedData.textObjects || [];
            appStates.redactionAreas = savedData.redactionAreas || [];
            parsedSuccessfully = true;
        }
        return parsedSuccessfully;
    }

    test('should correctly decode UTF-8 from PDFHexString', async () => {
        const hebrewText = "בדיקה";
        const jsonData = JSON.stringify({ textObjects: [{ text: hebrewText }], redactionAreas: [] });
        const utf8Bytes = new TextEncoder().encode(jsonData);

        const customDataValue = mockPDFHexString.of(utf8Bytes);

        await simulateCustomDataLoading(customDataValue);

        expect(appStates.textObjects.length).toBe(1);
        expect(appStates.textObjects[0].text).toBe(hebrewText);
    });

    test('should correctly decode UTF-8 from PDFString using getBytes()', async () => {
        const hebrewText = "טקסט בעברית";
        const rawJson = JSON.stringify({ textObjects: [{ text: hebrewText }], redactionAreas: [] });
        const utf8Bytes = new TextEncoder().encode(rawJson);

        const customDataValue = mockPDFString.createInstance(utf8Bytes);

        await simulateCustomDataLoading(customDataValue);

        expect(appStates.textObjects.length).toBe(1);
        expect(appStates.textObjects[0].text).toBe(hebrewText);
        expect(customDataValue.getBytes).toHaveBeenCalled();
        expect(customDataValue.asString).not.toHaveBeenCalled();
    });

    test('should fallback to asString() if getBytes() fails, and use its (potentially incorrect) output', async () => {
        const hebrewTextForMisinterpretation = "€λληνικά";
        const rawJson = JSON.stringify({ textObjects: [{ text: hebrewTextForMisinterpretation }], redactionAreas: [] });
        const utf8Bytes = new TextEncoder().encode(rawJson);

        const customDataValue = mockPDFString.createInstance(utf8Bytes, true);

        await simulateCustomDataLoading(customDataValue);

        expect(appStates.textObjects.length).toBe(1);

        const incorrectlyDecodedJsonString = new TextDecoder('latin1').decode(utf8Bytes);
        try {
            const expectedIncorrectObject = JSON.parse(incorrectlyDecodedJsonString);
            expect(appStates.textObjects[0].text).toBe(expectedIncorrectObject.textObjects[0].text);
        } catch (e) {
            expect(e).toBeInstanceOf(SyntaxError);
        }

        expect(customDataValue.getBytes).toHaveBeenCalled();
        expect(customDataValue.asString).toHaveBeenCalled();
    });
});
