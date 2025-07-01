import { logDebug } from './debug.js';

/**
 * @typedef {object} TextObject
 * @property {string} id
 * @property {number} originalPageNum
 * @property {string} text
 * @property {number} x
 * @property {number} y
 * @property {number} width
 * @property {number} height
 * @property {number} fontSize
 * @property {string} color
 * @property {'ltr' | 'rtl'} direction
 * @property {boolean} autoSize
 */

/**
 * @typedef {object} RedactionArea
 * @property {number} originalPageNum
 * @property {number} x
 * @property {number} y
 * @property {number} width
 * @property {number} height
 */

/**
 * @typedef {object} ParsedCustomData
 * @property {TextObject[]} textObjects
 * @property {RedactionArea[]} redactionAreas
 */

/**
 * Parses custom editor data from a PDF catalog value.
 *
 * @param {any} customDataValue The value retrieved from the PDF catalog.
 * @param {any} PDFHexString The PDFHexString constructor/object from pdf-lib.
 * @param {any} PDFString The PDFString constructor/object from pdf-lib.
 * @returns {ParsedCustomData | null} An object containing textObjects and redactionAreas, or null if parsing fails or data is invalid.
 */
export function parsePdfCustomData(
    customDataValue,
    PDFHexString,
    PDFString
) {
    if (!customDataValue) {
        logDebug("parsePdfCustomData: No custom data value provided.");
        return null;
    }

    /** @type {string | null} */
    let jsonData = null;

    try {
        if (customDataValue instanceof PDFHexString) {
            logDebug("parsePdfCustomData: Found custom editor data as PDFHexString in catalog.");

            // --- START OF FIX ---
            // The .decode() method is unreliable. Instead, get the raw hex string
            // and manually convert it back to bytes. This is a more robust approach.
            const hex = customDataValue.toString().replace(/[<>]/g, '');
            const bytes = new Uint8Array(hex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
            // --- END OF FIX ---

            jsonData = new TextDecoder('utf-8').decode(bytes);
            logDebug("parsePdfCustomData: Decoded PDFHexString data using UTF-8.", { dataLength: jsonData.length });

        } else if (customDataValue instanceof PDFString) {
            logDebug("parsePdfCustomData: Found custom editor data as PDFString in catalog.");
            try {
                const bytes = customDataValue.getBytes();
                jsonData = new TextDecoder('utf-8').decode(bytes);
                logDebug("parsePdfCustomData: Decoded PDFString data using UTF-8 via getBytes().", { dataLength: jsonData.length });
            } catch (e) {
                // OLD:
                // logDebug("parsePdfCustomData: Failed to getBytes() from PDFString, falling back to asString(). Error: " + e.message);
                // jsonData = customDataValue.asString();
                // logDebug("parsePdfCustomData: Decoded PDFString data using asString() (fallback).", { dataLength: jsonData.length });

                // NEW:
                console.error("parsePdfCustomData: Error decoding PDFString as UTF-8. Original error:", e);
                logDebug("parsePdfCustomData: Failed to decode PDFString as UTF-8. Data might be corrupted or not valid UTF-8.", { error: e.message, stack: e.stack });
                jsonData = null; // Ensure jsonData is null if decoding fails
            }
        } else {
            logDebug("parsePdfCustomData: Custom editor data found, but it was not an instance of PDFHexString or PDFString.", { retrievedObjectType: customDataValue.constructor ? customDataValue.constructor.name : typeof customDataValue });
            return null;
        }

        if (jsonData) {
            const savedData = JSON.parse(jsonData);
            logDebug("parsePdfCustomData: Parsed editor data from JSON string:", savedData);

            // --- Start of new code ---
            let relevantTextSample = "No Hebrew text found or savedData.textObjects empty.";
            if (savedData && savedData.textObjects && savedData.textObjects.length > 0) {
                const hebrewTextObject = savedData.textObjects.find(obj => obj && obj.text && /[^\x00-\x7F]/.test(obj.text)); // Simple non-ASCII check
                if (hebrewTextObject) {
                    relevantTextSample = hebrewTextObject.text.substring(0, 50) + (hebrewTextObject.text.length > 50 ? "..." : "");
                } else {
                    relevantTextSample = "No specific Hebrew text found, showing first text object sample: " + (savedData.textObjects[0].text ? savedData.textObjects[0].text.substring(0,50) + (savedData.textObjects[0].text.length > 50 ? "..." : "") : "empty text");
                }
            } else if (savedData && savedData.textObjects) { // textObjects is present but empty
                 relevantTextSample = "savedData.textObjects array is empty.";
            } else { // textObjects property might be missing
                 relevantTextSample = "savedData.textObjects is undefined or null.";
            }
            console.log("Loaded (sample Hebrew text):", relevantTextSample);
            console.log("Loaded (full parsed data):", savedData);
            // --- End of new code ---

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
    } catch (e) {
        console.error("parsePdfCustomData: Error parsing custom data JSON.", e);
        logDebug("parsePdfCustomData: Error parsing custom data JSON.", { error: e.message, stack: e.stack, jsonDataReceived: jsonData ?? 'unavailable (error before assignment or during parsing)' });
        return null;
    }

    return null; // Should not be reached if jsonData was processed or an error thrown/returned null
}
