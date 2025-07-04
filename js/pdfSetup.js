// js/pdfSetup.js
import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';

import {
    PDFDocument as PDFLibDocument, // Renamed to avoid conflict with pdf.js's PDFDocument type if it were used
    rgb,
    StandardFonts,
    TextAlignment,
    PDFName,
    PDFString,
    PDFHexString,
    grayscale
} from 'pdf-lib';

// Setup for PDF.js worker
if (pdfjsLib && pdfjsLib.GlobalWorkerOptions) {
    // The worker is copied to the 'dist' folder by the build script
    pdfjsLib.GlobalWorkerOptions.workerSrc = './pdf.worker.mjs';
} else {
    console.error("pdfjsLib or GlobalWorkerOptions is not defined. This should not happen with direct imports.");
}

// Export the pdfjsLib itself to be used by app.js
export { pdfjsLib };

// Export PDFLib objects (already imported and destructured)
export {
    PDFLibDocument as PDFDocument, // Export with the original intended name for use in app.js
    rgb,
    StandardFonts,
    TextAlignment,
    PDFName,
    PDFString,
    PDFHexString,
    grayscale,
};

// For window.showSaveFilePicker, it's typically checked for existence before use:
// if (window.showSaveFilePicker) { /* ... */ }
// JSDoc for window properties can be done in a central d.ts or by casting window to any
// For the purpose of this conversion, direct usage with existence checks is standard for JS.
