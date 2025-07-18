// js/pdfSetup.js
import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';
// CHANGE: Use direct named imports from pdf-lib
import {
    PDFDocument,
    rgb,
    StandardFonts,
    TextAlignment,
    PDFName,
    PDFString,
    PDFHexString,
    grayscale,
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

// CHANGE: Directly export the named imports
export {
    PDFDocument,
    rgb,
    StandardFonts,
    TextAlignment,
    PDFName,
    PDFString,
    PDFHexString,
    grayscale,
};
