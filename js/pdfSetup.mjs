// js/pdfSetup.js

// Setup for PDF.js worker
if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js`;
} else {
    console.error("pdfjsLib is not defined. Ensure PDF.js library is loaded before pdfSetup.js");
}

// Destructure and export PDFLib objects
// Ensure PDFLib is loaded globally, e.g., via a script tag in index.html before this module.
let PDFDocument, rgb, StandardFonts, TextAlignment, PDFName, PDFString, PDFHexString, grayscale;

if (window.PDFLib) {
    ({ PDFDocument, rgb, StandardFonts, TextAlignment, PDFName, PDFString, PDFHexString, grayscale } = window.PDFLib);
} else {
    console.error("PDFLib is not defined. Ensure pdf-lib library is loaded before pdfSetup.js");
    // Provide dummy objects or throw error to prevent further execution if critical
}

export {
    PDFDocument,
    rgb,
    StandardFonts,
    TextAlignment,
    PDFName,
    PDFString,
    PDFHexString,
    grayscale,
    // pdfjsLib can be accessed globally if needed, or wrapped/exported if preferred
    // For now, assuming global pdfjsLib is fine for where it's used.
};
