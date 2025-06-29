import { logDebug } from './debug.ts';

// Define interfaces for the structure of the data we expect to parse
// These might be already defined in app.ts or a types file, if so, import them.
// For now, defining them here for clarity.
interface TextObject {
    id: string;
    originalPageNum: number;
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
    fontSize: number;
    color: string;
    direction: 'ltr' | 'rtl';
    autoSize: boolean;
}

interface RedactionArea {
    originalPageNum: number;
    x: number;
    y: number;
    width: number;
    height: number;
}

interface ParsedCustomData {
    textObjects: TextObject[];
    redactionAreas: RedactionArea[];
}

/**
 * Parses custom editor data from a PDF catalog value.
 *
 * @param customDataValue The value retrieved from the PDF catalog.
 * @param PDFHexString The PDFHexString constructor/object from pdf-lib.
 * @param PDFString The PDFString constructor/object from pdf-lib.
 * @returns An object containing textObjects and redactionAreas, or null if parsing fails or data is invalid.
 */
export function parsePdfCustomData(
    customDataValue: any,
    PDFHexString: any,
    PDFString: any
): ParsedCustomData | null {
    if (!customDataValue) {
        logDebug("parsePdfCustomData: No custom data value provided.");
        return null;
    }

    let jsonData: string | null = null;

    try {
        if (customDataValue instanceof PDFHexString) {
            logDebug("parsePdfCustomData: Found custom editor data as PDFHexString in catalog.");
            const bytes = customDataValue.decode(); // Should return Uint8Array
            jsonData = new TextDecoder('utf-8').decode(bytes);
            logDebug("parsePdfCustomData: Decoded PDFHexString data using UTF-8 via decode().", { dataLength: jsonData.length });
        } else if (customDataValue instanceof PDFString) {
            logDebug("parsePdfCustomData: Found custom editor data as PDFString in catalog.");
            try {
                const bytes = (customDataValue as any).getBytes();
                jsonData = new TextDecoder('utf-8').decode(bytes);
                logDebug("parsePdfCustomData: Decoded PDFString data using UTF-8 via getBytes().", { dataLength: jsonData.length });
            } catch (e) {
                logDebug("parsePdfCustomData: Failed to getBytes() from PDFString, falling back to asString(). Error: " + (e as Error).message);
                jsonData = customDataValue.asString();
                logDebug("parsePdfCustomData: Decoded PDFString data using asString() (fallback).", { dataLength: jsonData.length });
            }
        } else {
            logDebug("parsePdfCustomData: Custom editor data found, but it was not an instance of PDFHexString or PDFString.", { retrievedObjectType: customDataValue.constructor ? customDataValue.constructor.name : typeof customDataValue });
            return null;
        }

        if (jsonData) {
            const savedData = JSON.parse(jsonData);
            logDebug("parsePdfCustomData: Parsed editor data from JSON string:", savedData);
            // Basic validation of expected structure
            if (typeof savedData === 'object' && savedData !== null && Array.isArray(savedData.textObjects) && Array.isArray(savedData.redactionAreas)) {
                return {
                    textObjects: savedData.textObjects,
                    redactionAreas: savedData.redactionAreas,
                };
            } else {
                logDebug("parsePdfCustomData: Parsed JSON data does not have the expected structure.", savedData);
                return null;
            }
        }
    } catch (e: any) {
        console.error("parsePdfCustomData: Error parsing custom data JSON.", e);
        logDebug("parsePdfCustomData: Error parsing custom data JSON.", { error: e.message, stack: e.stack, jsonDataReceived: jsonData ?? 'unavailable (error before assignment or during parsing)' });
        return null;
    }

    return null; // Should not be reached if jsonData was processed or an error thrown/returned null
}
