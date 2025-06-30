// js/pdfSetup.js

// It's better to import types from 'pdf-lib' if you install it as a dependency.
// For now, assuming global PDFLib and pdfjsLib.

// Setup for PDF.js worker
if (window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js`;
} else {
    console.error("pdfjsLib or GlobalWorkerOptions is not defined. Ensure PDF.js library is loaded.");
}

// Destructure and export PDFLib objects
/** @type {any} */
let PDFDocument,
    /** @type {any} */
    rgb,
    /** @type {any} */
    StandardFonts,
    /** @type {any} */
    TextAlignment,
    /** @type {any} */
    PDFName,
    /** @type {any} */
    PDFString,
    /** @type {any} */
    PDFHexString,
    /** @type {any} */
    grayscale;

if (window.PDFLib) {
    ({ PDFDocument, rgb, StandardFonts, TextAlignment, PDFName, PDFString, PDFHexString, grayscale } = window.PDFLib);
} else {
    console.error("PDFLib is not defined. Ensure pdf-lib library is loaded. PDF editing features may fail.");
    // Provide dummy objects or throw error to prevent further execution if critical
    // For now, they will remain undefined if PDFLib is not loaded.
}

export {
    PDFDocument, // Consider renaming to avoid conflict if PDFDocument type is also imported from 'pdf-lib'
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
