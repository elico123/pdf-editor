// js/app.js
// js/app.js
import { EDITOR_METADATA_KEY } from './config.js';
import * as dom from './domElements.js';
import * as utils from './utils.js';
import { logDebug, initDebugSystem } from './debug.js';
import { pdfjsLib, PDFDocument, rgb, StandardFonts, TextAlignment, PDFName, PDFString, PDFHexString, grayscale } from './pdfSetup.js';
import { parsePdfCustomData } from './pdfMetadata.js'; // Import the new function
import Sortable from 'sortablejs';
import fontkit from '@pdf-lib/fontkit';

// Removed TypeScript type placeholders

// --- State variable for fontkit registration ---
let fontkitRegistered = false;


document.addEventListener('DOMContentLoaded', () => {
    // Initialize the debug system with necessary DOM elements
    initDebugSystem({
        debugOverlay: dom.debugOverlay,
        debugMessagesContainer: dom.debugMessagesContainer,
        debugClearBtn: dom.debugClearBtn,
        debugCloseBtn: dom.debugCloseBtn,
        debugCopyBtn: dom.debugCopyBtn,
        toggleDebugBtn: dom.toggleDebugBtn,
    });
    logDebug("Debug system initialized via app.js");

    // Function to load and display the application version
    async function loadAndDisplayVersion() {
        const versionElement = document.getElementById('app-version');
        if (!versionElement) {
            console.error("Version element #app-version not found.");
            return;
        }

        try {
            // Path is relative to index.html where app.js is loaded
            const response = await fetch('dist/version.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const versionInfo = await response.json();
            if (versionInfo && versionInfo.version) {
                versionElement.textContent = `Build: ${versionInfo.version}`;
                logDebug(`App version loaded: ${versionInfo.version}`);
            } else {
                throw new Error("Version data is invalid or missing.");
            }
        } catch (error) {
            console.error("Failed to load or display version:", error);
            logDebug("Failed to load or display version:", { error: error.message });
            versionElement.textContent = 'Build: N/A';
        }
    }

    // Load and display the version
    loadAndDisplayVersion();

    // --- Helper function for fontkit registration ---
    function registerFontkitOnce(doc) {
        if (fontkitRegistered) {
            logDebug("registerFontkitOnce: Already registered.");
            return;
        }
        if (doc && fontkit) {
            try {
                doc.registerFontkit(fontkit);
                logDebug("Successfully registered fontkit with PDFLib.");
                fontkitRegistered = true;
            } catch (error) {
                console.error("Error registering fontkit with PDFLib:", error);
                logDebug("Error registering fontkit with PDFLib (original or custom):", { error: error.message, stack: error.stack });
            }
        } else {
            console.error("PDFLib's PDFDocument or fontkit (from import) not available for registration.");
            logDebug("PDFLib's PDFDocument or fontkit (from import) not available for registration.");
        }
    }

    // --- State Variables ---
    let pdfDoc = null;
    let pdfBytes = null;
    let pageOrder = [];
    let activeTool = null;
    /** @type {Array<import('./app').RedactionArea>} */
    let redactionAreas = [];
    /** @type {Array<import('./app').TextObject>} */
    let textObjects = [];
    let selectedRedactionBox = null;
    let selectedTextBox = null;

    const actionButtons = [
        dom.savePdfBtn, dom.saveFlatPdfBtnEl, dom.printPdfBtn, dom.closePdfBtn,
        dom.toolMergeBtn, dom.toolSplitBtn, dom.toolAddTextBtn, dom.toolRedactBtn
    ];

    // --- Core App Logic ---
    /** @param {boolean} enabled */
    const updateActionButtonsState = (enabled) => actionButtons.forEach(b => { if (b) b.disabled = !enabled; });
    updateActionButtonsState(false);

    const openDrawer = () => {
        if (dom.sidebar && dom.drawerOverlay) {
            dom.sidebar.classList.add('open');
            dom.drawerOverlay.classList.remove('hidden');
        }
    };
    const closeDrawer = () => {
        if (dom.sidebar && dom.drawerOverlay) {
            dom.sidebar.classList.remove('open');
            dom.drawerOverlay.classList.add('hidden');
        }
    };

    if (dom.menuBtn) {
        dom.menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (pdfDoc && dom.sidebar) {
                dom.sidebar.classList.contains('open') ? closeDrawer() : openDrawer();
            }
        });
    }
    if (dom.drawerOverlay) {
        dom.drawerOverlay.addEventListener('click', closeDrawer);
    }

    const closePdf = () => {
        pdfDoc = null; pdfBytes = null; pageOrder = []; redactionAreas = []; textObjects = []; activeTool = null;
        if (dom.pageContainer) dom.pageContainer.innerHTML = '';
        if (dom.thumbnailsContainer) dom.thumbnailsContainer.innerHTML = '';
        if (dom.welcomeMessage) dom.welcomeMessage.classList.remove('hidden');
        if (dom.fileInput) dom.fileInput.value = ''; // HTMLInputElement
        updateActionButtonsState(false);
        if (dom.openPdfBtn) dom.openPdfBtn.classList.remove('hidden');
        if (dom.menuBtn) dom.menuBtn.classList.add('hidden');
        closeDrawer();
        selectRedactionBox(null);
        selectTextBox(null);
        logDebug("closePdf: PDF closed and state reset.");
    };

    /** @param {File} file
     *  @returns {Promise<void>}
     */
    const loadPdf = async (file) => {
        utils.showLoader('Loading PDF...');
        logDebug("loadPdf: Loading file", { name: file.name, size: file.size });
        try {
            pdfBytes = new Uint8Array(await file.arrayBuffer());
            await loadPdfFromBytes(pdfBytes);
            if (dom.welcomeMessage) dom.welcomeMessage.classList.add('hidden');
            if (dom.openPdfBtn) dom.openPdfBtn.classList.add('hidden');
            if (dom.menuBtn) dom.menuBtn.classList.remove('hidden');
        } catch (error) {
            console.error("Error loading PDF:", error);
            logDebug("loadPdf: Error loading PDF", { error: error.message, stack: error.stack });
            alert(`Error loading PDF: ${error.message}`);
            closePdf(); // Reset UI
        } finally {
            utils.hideLoader();
        }
    };

    /** @param {Uint8Array} bytes
     * @returns {Promise<void>}
     */
    const loadPdfFromBytes = async (bytes) => {
         utils.showLoader('Rendering PDF...');
         pdfBytes = bytes;
         const pdfDocInstance = await PDFDocument.load(bytes, { ignoreEncryption: true }); // pdf-lib instance
         pdfDoc = await pdfjsLib.getDocument({ data: bytes }).promise; // pdf.js instance

         textObjects = [];
         redactionAreas = [];
         logDebug("loadPdfFromBytes: Initialized/reset textObjects and redactionAreas.");

         try {
            logDebug("Attempting to load editor data from custom catalog entry with key: " + EDITOR_METADATA_KEY);
            const customDataKey = PDFName.of(EDITOR_METADATA_KEY);
            const catalog = pdfDocInstance.catalog;
            const customDataValue = catalog.get(customDataKey);

            if (customDataValue) {
                logDebug("loadPdfFromBytes: Attempting to parse custom data from catalog.", { key: EDITOR_METADATA_KEY });
                const parsedData = parsePdfCustomData(customDataValue, PDFHexString, PDFString);
                if (parsedData) {
                    textObjects = parsedData.textObjects;
                    redactionAreas = parsedData.redactionAreas;
                    logDebug("loadPdfFromBytes: Successfully parsed and loaded custom editor data.", { textObjectsCount: textObjects.length, redactionAreasCount: redactionAreas.length });
                } else {
                    logDebug("loadPdfFromBytes: Failed to parse custom editor data or data was invalid/empty.");
                }
            } else {
                logDebug("loadPdfFromBytes: No custom editor data found in catalog with key: " + EDITOR_METADATA_KEY);
            }
         } catch (e) {
             console.error("loadPdfFromBytes: Error processing custom catalog entry:", e);
             logDebug("loadPdfFromBytes: Error processing custom catalog entry. textObjects and redactionAreas remain empty.", { error: e.message, stack: e.stack });
         }

        pageOrder = Array.from({ length: pdfDoc.numPages }, (_, i) => i + 1);
         await renderAllPages();
         await renderThumbnails();
         updateActionButtonsState(true);
         utils.hideLoader();
    };

    let sortableThumbnails = null; // Keep a reference to Sortable instance

    /** @returns {Promise<void>} */
    const renderAllPages = async () => {
        if (!dom.pageContainer || !dom.viewerContainer || !pdfDoc) return;
        dom.pageContainer.innerHTML = '';
        logDebug("renderAllPages: Starting. Page order count: " + pageOrder.length);
        for (const pageNum of pageOrder) {
            const page = await pdfDoc.getPage(pageNum);
            const scale = (dom.viewerContainer.clientWidth / page.getViewport({ scale: 1.0 }).width) * 0.95;
            const viewport = page.getViewport({ scale });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height; canvas.width = viewport.width;
            canvas.dataset.pageNum = String(pageNum);
            logDebug(`renderAllPages: Rendering page ${pageNum} with scale ${scale}`);
            if (context) {
                await page.render({ canvasContext: context, viewport }).promise;
            }

            const pageDiv = document.createElement('div');
            pageDiv.className = 'relative';
            pageDiv.appendChild(canvas);
            dom.pageContainer.appendChild(pageDiv);
        }
        await renderRedactionBoxes();
        await renderTextObjects();
        dom.viewerContainer.scrollTop = 0;
        logDebug("renderAllPages: Completed.");
    };

    /** @returns {Promise<void>} */
    const renderThumbnails = async () => {
        if (!dom.thumbnailsContainer || !pdfDoc) return;
        dom.thumbnailsContainer.innerHTML = '';
        logDebug("renderThumbnails: Starting. Page order count: " + pageOrder.length);
        for (let i = 0; i < pageOrder.length; i++) {
            const pageNum = pageOrder[i];
            const page = await pdfDoc.getPage(pageNum);
            const viewport = page.getViewport({ scale: 0.3 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height; canvas.width = viewport.width;
            if (context) {
                await page.render({ canvasContext: context, viewport }).promise;
            }
            const thumbItem = document.createElement('div');
            thumbItem.className = 'thumbnail-item p-1 rounded-md cursor-pointer relative';
            thumbItem.dataset.originalIndex = String(pageNum);
            const pageNumberLabel = document.createElement('span');
            pageNumberLabel.textContent = String(i + 1);
            pageNumberLabel.className = 'absolute top-1 left-1 bg-blue-500 text-white text-xs font-bold px-1.5 py-0.5 rounded';
            thumbItem.append(canvas, pageNumberLabel);
            dom.thumbnailsContainer.appendChild(thumbItem);
        }

        if (sortableThumbnails) {
            sortableThumbnails.destroy();
        }
        if (dom.thumbnailsContainer) {
            sortableThumbnails = new Sortable(dom.thumbnailsContainer, {
                animation: 150,
                ghostClass: 'sortable-ghost',
                onEnd: async (evt) => {
                    if (evt.oldIndex === undefined || evt.newIndex === undefined) return;
                    const movedItem = pageOrder.splice(evt.oldIndex, 1)[0];
                    pageOrder.splice(evt.newIndex, 0, movedItem);
                    logDebug("Thumbnails reordered", { oldIndex: evt.oldIndex, newIndex: evt.newIndex, newOrder: pageOrder });
                    // Re-render pages in new order and update thumbnail labels
                    await renderAllPages();
                    await renderThumbnails(); // To update numbers
                }
            });
        }
        logDebug("renderThumbnails: Completed and Sortable initialized/re-initialized.");
    };

    if (dom.openPdfBtn) dom.openPdfBtn.addEventListener('click', () => dom.fileInput?.click());
    if (dom.closePdfBtn) dom.closePdfBtn.addEventListener('click', closePdf);
    if (dom.fileInput) {
        dom.fileInput.addEventListener('change', (e) => {
            const target = /** @type {HTMLInputElement} */ (e.target);
            if (target.files && target.files.length > 0) {
                loadPdf(target.files[0]);
            }
        });
    }


    if (dom.savePdfBtn) { // "Save Editable..."
        dom.savePdfBtn.addEventListener('click', () => {
            if (!pdfDoc) return;
            performStandardSave();
        });
    }

    if (dom.saveFlatPdfBtnEl) { // "Save for Sharing (Flattened)..."
         dom.saveFlatPdfBtnEl.addEventListener('click', () => {
            if (!pdfDoc) return;
            performFlattenedSave();
        });
    }

    /** @returns {Promise<void>} */
    const performStandardSave = async () => {
        utils.showLoader('Saving Editable PDF...');
        logDebug("performStandardSave: Starting editable save.");
        try {
            if (!pdfBytes) {
                throw new Error("PDF data is not available.");
            }

            const finalDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
            registerFontkitOnce(finalDoc); // Ensure fontkit is registered

            const dataToStore = JSON.stringify({ textObjects, redactionAreas });
            const customDataKey = PDFName.of(EDITOR_METADATA_KEY);

            // --- Start of new code ---
            let relevantTextSample = "No Hebrew text found or textObjects empty.";
            if (textObjects && textObjects.length > 0) {
                const hebrewTextObject = textObjects.find(obj => obj && obj.text && (utils.hasRtl ? utils.hasRtl(obj.text) : /[^\x00-\x7F]/.test(obj.text)));
                if (hebrewTextObject) {
                    relevantTextSample = hebrewTextObject.text.substring(0, 50) + (hebrewTextObject.text.length > 50 ? "..." : "");
                } else {
                    relevantTextSample = "No specific Hebrew text found, showing first text object sample: " + (textObjects[0].text ? textObjects[0].text.substring(0,50) + (textObjects[0].text.length > 50 ? "..." : "") : "empty text");
                }
            } else {
                relevantTextSample = "textObjects array is empty.";
            }
            console.log("Saving (sample Hebrew text):", relevantTextSample);
            console.log("Saving (full data to be encoded):", dataToStore);
            // --- End of new code ---

            const utf8Bytes = new TextEncoder().encode(dataToStore);

            // --- Start of new code ---
            console.log("Encoded (UTF-8 bytes):", utf8Bytes);
            // --- End of new code ---

            // Manually convert the Uint8Array to a hexadecimal string
            const hex = Array.from(utf8Bytes).map(b => b.toString(16).padStart(2, '0')).join('');

            const customDataValue = PDFHexString.of(hex);

            finalDoc.catalog.set(customDataKey, customDataValue);
            logDebug("performStandardSave: Set custom data (UTF-8 as PDFHexString) in PDF catalog.", { key: customDataKey.toString(), dataLength: hex.length });

            const finalPdfBytes = await finalDoc.save();
            const originalFileName = (dom.fileInput?.files?.[0]?.name || 'document.pdf').replace(/\.pdf$/i, '');
            const suggestedName = `${originalFileName}-editable.pdf`;

            if (window.showSaveFilePicker) {
                try {
                    const handle = await window.showSaveFilePicker({
                        suggestedName,
                        types: [{ description: 'PDF Files', accept: { 'application/pdf': ['.pdf'] } }],
                    });
                    const writable = await handle.createWritable();
                    await writable.write(finalPdfBytes);
                    await writable.close();
                    logDebug("performStandardSave: File saved via showSaveFilePicker.");
                } catch (err) {
                    if (err.name !== 'AbortError') {
                        console.error('Error saving with showSaveFilePicker:', err);
                        logDebug("performStandardSave: Error with showSaveFilePicker, falling back.", {error: err.message});
                        utils.downloadBlob(finalPdfBytes, suggestedName);
                    } else {
                        logDebug("performStandardSave: Save As dialog cancelled by user.");
                    }
                }
            } else {
                logDebug("performStandardSave: Falling back to downloadBlob for saving.");
                utils.downloadBlob(finalPdfBytes, suggestedName);
            }
        } catch (error) {
            console.error("Failed to save PDF:", error);
            logDebug("performStandardSave: ERROR during save process", { error: error.message, stack: error.stack });
        } finally {
            utils.hideLoader();
        }
    };

    /** @returns {Promise<void>} */
    const performFlattenedSave = async () => {
        utils.showLoader('Saving Flattened PDF...');
        logDebug("performFlattenedSave: Starting flattened save.");
        try {
            if (!pdfBytes || !pdfDoc) {
                throw new Error("PDF data is not available for flattened save.");
            }

            const finalDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
            registerFontkitOnce(finalDoc);
            const helveticaFont = await finalDoc.embedFont(StandardFonts.Helvetica);

            // BEGIN: Added code for Hebrew font loading
            let hebrewFont = null;
            try {
                const fontUrl = 'fonts/OpenSansHebrew-Regular.ttf';
                logDebug(`performFlattenedSave: Fetching Hebrew font from ${fontUrl}`);
                const fontBytes = await fetch(fontUrl).then(res => {
                    if (!res.ok) {
                        throw new Error(`Failed to fetch font: ${res.status} ${res.statusText}`);
                    }
                    return res.arrayBuffer();
                });
                hebrewFont = await finalDoc.embedFont(fontBytes);
                logDebug("performFlattenedSave: Hebrew font embedded successfully.");
            } catch (fontError) {
                console.error("Error loading Hebrew font:", fontError);
                logDebug("performFlattenedSave: Error loading Hebrew font", { error: fontError.message, stack: fontError.stack });
                // Optional: Fallback to helvetica or re-throw, for now, it will just use helvetica if hebrewFont is null
            }
            // END: Added code for Hebrew font loading

            // BEGIN: Added containsHebrew helper function
            const containsHebrew = (text) => {
                if (!text) return false;
                // Basic check for Hebrew Unicode block (U+0590 to U+05FF)
                return /[֐-׿]/.test(text);
            };
            // END: Added containsHebrew helper function

            const customDataKey = PDFName.of(EDITOR_METADATA_KEY);
            if (finalDoc.catalog.has(customDataKey)) {
                finalDoc.catalog.delete(customDataKey);
                logDebug("performFlattenedSave: Removed existing editor metadata for flattened save.");
            }

            logDebug("performFlattenedSave: Applying textObjects to PDF content. Count: " + textObjects.length);
            for (const textObj of textObjects) {
                const pageIndex = pageOrder.indexOf(textObj.originalPageNum);
                if (pageIndex === -1) {
                    logDebug(`Skipping textObj for flattened save, pageIndex not found for originalPageNum: ${textObj.originalPageNum}`);
                    continue;
                }

                const page = finalDoc.getPage(pageIndex);
                const { height: pageHeight } = page.getSize();
                const color = utils.hexToRgb(textObj.color);

                const x = textObj.x;
                const y = textObj.y;
                const fontSize = textObj.fontSize;
                const width = textObj.width;

                if ([x, y, fontSize, width].some(v => typeof v !== 'number' || isNaN(v)) || !color) {
                    console.error("Invalid text object property for flattening, skipping:", textObj);
                    logDebug("performFlattenedSave: Invalid text object property, skipping.", textObj);
                    continue;
                }
                logDebug(`performFlattenedSave: Drawing text on page ${pageIndex}`, {text: textObj.text, x,y,fontSize,width});
                page.drawText(textObj.text, {
                    x: x,
                    y: pageHeight - y - fontSize,
                    font: containsHebrew(textObj.text) && hebrewFont ? hebrewFont : helveticaFont,
                    size: fontSize,
                    color: rgb(color.r / 255, color.g / 255, color.b / 255),
                    maxWidth: width,
                    textAlign: textObj.direction === 'rtl' ? TextAlignment.Right : TextAlignment.Left,
                });
            }

            logDebug("performFlattenedSave: Applying redactionAreas to PDF content. Count: " + redactionAreas.length);
            for (const area of redactionAreas) {
                const pageIndex = pageOrder.indexOf(area.originalPageNum);
                 if (pageIndex === -1) {
                    logDebug(`Skipping redactionArea for flattened save, pageIndex not found for originalPageNum: ${area.originalPageNum}`);
                    continue;
                }
                const page = finalDoc.getPage(pageIndex);
                const { height: pageHeight } = page.getSize();

                const x = area.x;
                const y = area.y;
                const width = area.width;
                const height = area.height;

                if ([x, y, width, height].some(v => typeof v !== 'number' || isNaN(v))) {
                    console.error("Invalid redaction area property for flattening, skipping:", area);
                    logDebug("performFlattenedSave: Invalid redaction area property, skipping.", area);
                    continue;
                }
                logDebug(`performFlattenedSave: Drawing redaction on page ${pageIndex}`, {x,y,width,height});
                page.drawRectangle({
                    x: x,
                    y: pageHeight - y - height,
                    width: width,
                    height: height,
                    color: rgb(0, 0, 0),
                });
            }

            const finalPdfBytes = await finalDoc.save();
            const originalFileName = (dom.fileInput?.files?.[0]?.name || 'document.pdf').replace(/\.pdf$/i, '');
            const suggestedName = `${originalFileName}-shared.pdf`;

            if (window.showSaveFilePicker) {
                try {
                    const handle = await window.showSaveFilePicker({
                        suggestedName,
                        types: [{ description: 'PDF Files', accept: { 'application/pdf': ['.pdf'] } }],
                    });
                    const writable = await handle.createWritable();
                    await writable.write(finalPdfBytes);
                    await writable.close();
                    logDebug("performFlattenedSave: File saved via showSaveFilePicker.");
                } catch (err) {
                    if (err.name !== 'AbortError') {
                        console.error('Error saving flattened PDF with showSaveFilePicker:', err);
                        logDebug("performFlattenedSave: Error with showSaveFilePicker, falling back.", {error: err.message});
                        utils.downloadBlob(finalPdfBytes, suggestedName);
                    } else {
                        logDebug("performFlattenedSave: Save As dialog cancelled by user.");
                    }
                }
            } else {
                logDebug("performFlattenedSave: Falling back to downloadBlob for saving.");
                utils.downloadBlob(finalPdfBytes, suggestedName);
            }
        } catch (error) {
            console.error("Failed to save flattened PDF:", error);
            logDebug("performFlattenedSave: ERROR during save process", { error: error.message, stack: error.stack });
        } finally {
            utils.hideLoader();
        }
    };

    // --- OBJECT RENDERING & SELECTION ---
    /** @returns {Promise<void>} */
    const renderRedactionBoxes = async () => {
        if (!dom.pageContainer || !pdfDoc) return;
        document.querySelectorAll('.redaction-box').forEach(box => box.remove());
        logDebug("renderRedactionBoxes. Count: " + redactionAreas.length, redactionAreas);
        for (const [index, area] of redactionAreas.entries()) {
            const pageDiv = /** @type {HTMLElement | null} */ (dom.pageContainer.querySelector(`canvas[data-page-num="${area.originalPageNum}"]`)?.parentElement);
            if (!pageDiv) continue;
            const canvas = pageDiv.querySelector('canvas');
            if (!canvas) continue;
            const page = await pdfDoc.getPage(area.originalPageNum);
            const scale = canvas.width / page.getViewport({scale: 1.0}).width;
            const box = document.createElement('div');
            box.className = 'redaction-box';
            box.dataset.redactionIndex = String(index);
            box.style.left = `${area.x * scale}px`;
            box.style.top = `${area.y * scale}px`;
            box.style.width = `${area.width * scale}px`;
            box.style.height = `${area.height * scale}px`;
            pageDiv.appendChild(box);
        }
    };
    /** @param {HTMLTextAreaElement} textarea
     * @returns {Promise<void>}
     */
    async function updateTextBoxSize(textarea) {
        if (!textarea || !textarea.parentElement || !(textarea.parentElement instanceof HTMLDivElement) || !pdfDoc) return;
        const box = /** @type {HTMLDivElement} */ (textarea.parentElement);
        if (!box.dataset.textIndex) return;
        const textIndex = parseInt(box.dataset.textIndex, 10);
        if (isNaN(textIndex) || !textObjects[textIndex]) return;

        const textObj = textObjects[textIndex];
        const canvas = textarea.closest('.relative')?.querySelector('canvas');
        if (!canvas) return;
        const page = await pdfDoc.getPage(textObj.originalPageNum);
        const scale = canvas.width / page.getViewport({ scale: 1.0 }).width;

        if (textObj.autoSize) {
            const oldWidthPx = box.offsetWidth;
            textarea.style.width = '1px';
            const newWidthPx = textarea.scrollWidth + 4;
            textarea.style.width = '100%';
            const widthDifference = newWidthPx - oldWidthPx;

            if (textObj.direction === 'rtl' && widthDifference > 0) {
                const currentLeftPx = parseFloat(box.style.left || '0');
                const newLeftPx = currentLeftPx - widthDifference;
                box.style.left = `${newLeftPx}px`;
                textObj.x = newLeftPx / scale;
            }
            box.style.width = `${newWidthPx}px`;
            textObj.width = newWidthPx / scale;
        }

        textarea.style.height = 'auto';
        const newHeightPx = textarea.scrollHeight;
        textarea.style.height = `${newHeightPx}px`;
        box.style.height = `${newHeightPx}px`;
        textObj.height = newHeightPx / scale;
    }

    /** @returns {Promise<void>} */
    const renderTextObjects = async () => {
        if (!dom.pageContainer || !pdfDoc) return;
        logDebug("Starting renderTextObjects. Current textObjects count: " + textObjects.length, textObjects);
        document.querySelectorAll('.text-box').forEach(box => box.remove());
        for (const [index, textObj] of textObjects.entries()) {
            logDebug(`Rendering textObj at index ${index}`, textObj);
            const pageDiv = /** @type {HTMLElement | null} */ (dom.pageContainer.querySelector(`canvas[data-page-num="${textObj.originalPageNum}"]`)?.parentElement);
            if (!pageDiv) {
                logDebug(`Skipping textObj ${index}: Page div not found for pageNum ${textObj.originalPageNum}`);
                continue;
            }
            const canvas = pageDiv.querySelector('canvas');
            if (!canvas) {
                logDebug(`Skipping textObj ${index}: Canvas not found in pageDiv for pageNum ${textObj.originalPageNum}`);
                continue;
            }
            const page = await pdfDoc.getPage(textObj.originalPageNum);
            const scale = canvas.width / page.getViewport({scale: 1.0}).width;
            logDebug(`TextObj ${index}: Scale calculated as ${scale}`);

            const box = document.createElement('div');
            box.className = 'text-box';
            box.classList.toggle('auto-size', textObj.autoSize);

            box.dataset.textIndex = String(index);
            box.style.left = `${textObj.x * scale}px`;
            box.style.top = `${textObj.y * scale}px`;
            box.style.width = `${textObj.width * scale}px`;

            const textarea = document.createElement('textarea');
            textarea.value = textObj.text;
            textarea.style.fontSize = `${textObj.fontSize * scale}px`;
            textarea.style.color = textObj.color;

            textarea.addEventListener('input', async () => {
                const text = textarea.value;
                const currentTextObj = textObjects[index];
                if (!currentTextObj) return;
                currentTextObj.text = text;

                if (utils.hasRtl(text)) {
                    textarea.dir = 'rtl';
                    textarea.style.textAlign = 'right';
                    currentTextObj.direction = 'rtl';
                } else {
                    textarea.dir = 'ltr';
                    textarea.style.textAlign = 'left';
                    currentTextObj.direction = 'ltr';
                }
                await updateTextBoxSize(textarea);
            });

            if (textObj.direction === 'rtl') {
                textarea.dir = 'rtl';
                textarea.style.textAlign = 'right';
            } else {
                textarea.dir = 'ltr';
                textarea.style.textAlign = 'left';
            }

            box.appendChild(textarea);
            pageDiv.appendChild(box);

            await Promise.resolve();
            await updateTextBoxSize(textarea);
        }
    };
    /** @param {HTMLDivElement | null} boxElement
     * @param {boolean} [internalCall=false]
     */
    const selectRedactionBox = (boxElement, internalCall = false) => {
        if (selectedRedactionBox) {
            selectedRedactionBox.classList.remove('selected', 'resize-mode');
            Array.from(selectedRedactionBox.children).forEach(child => child.remove());
        }
        if (!internalCall) selectTextBox(null, true);

        if (boxElement) {
            selectedRedactionBox = boxElement;
            selectedRedactionBox.classList.add('selected');
            if (dom.redactionToolbar) dom.redactionToolbar.classList.add('visible');
        } else {
            selectedRedactionBox = null;
            if (dom.redactionToolbar) dom.redactionToolbar.classList.remove('visible');
        }
    };
    /** @param {HTMLDivElement | null} boxElement
     * @param {boolean} [internalCall=false]
     */
    const selectTextBox = (boxElement, internalCall = false) => {
        if (selectedTextBox) {
            selectedTextBox.classList.remove('selected', 'resize-mode');
            Array.from(selectedTextBox.querySelectorAll('.resize-handle')).forEach(h => h.remove());
        }
        if (!internalCall) selectRedactionBox(null, true);

        if (boxElement && boxElement.dataset.textIndex !== undefined) {
            selectedTextBox = boxElement;
            selectedTextBox.classList.add('selected');
            logDebug("selectTextBox: Box selected", { className: boxElement.className, dataset: boxElement.dataset });

            const textObjIndex = parseInt(boxElement.dataset.textIndex, 10);
            const textObj = textObjects[textObjIndex];
            logDebug(`selectTextBox: Attempting to get textObj at index ${textObjIndex}`, { retrievedObj: textObj });

            if (textObj) {
                logDebug("selectTextBox: textObj found. Current properties:", JSON.parse(JSON.stringify(textObj)));
                let defaulted = false;
                if (typeof textObj.fontSize !== 'number') { textObj.fontSize = 12; defaulted = true; logDebug("Defaulted fontSize"); }
                if (typeof textObj.color !== 'string') { textObj.color = '#000000'; defaulted = true; logDebug("Defaulted color"); }
                if (typeof textObj.text !== 'string') { textObj.text = ''; defaulted = true; logDebug("Defaulted text"); }
                if (typeof textObj.autoSize !== 'boolean') { textObj.autoSize = true; defaulted = true; logDebug("Defaulted autoSize"); }

                if(defaulted) {
                    logDebug("selectTextBox: textObj after defaulting:", JSON.parse(JSON.stringify(textObj)));
                }

                if (dom.textFontSizeInput) dom.textFontSizeInput.value = String(textObj.fontSize);
                if (dom.textColorInput) dom.textColorInput.value = textObj.color;

                textObjects[textObjIndex] = textObj;

                selectedTextBox.classList.toggle('auto-size', textObj.autoSize);
                selectedTextBox.classList.toggle('resize-mode', !textObj.autoSize);
                if (!textObj.autoSize) {
                    Array.from(selectedTextBox.querySelectorAll('.resize-handle')).forEach(h => h.remove());
                    ['nw', 'ne', 'sw', 'se'].forEach(pos => {
                        const handle = document.createElement('div');
                        handle.className = `resize-handle ${pos}`;
                        selectedTextBox?.appendChild(handle);
                    });
                } else {
                     Array.from(selectedTextBox.querySelectorAll('.resize-handle')).forEach(h => h.remove());
                }
            } else {
                console.error(`Text object at index ${textObjIndex} not found.`);
                logDebug(`selectTextBox: ERROR - Text object at index ${textObjIndex} not found.`);
                if (dom.textFontSizeInput) dom.textFontSizeInput.value = "12";
                if (dom.textColorInput) dom.textColorInput.value = '#000000';
            }

            if (dom.textToolbar) dom.textToolbar.classList.add('visible');
            const textarea = boxElement.querySelector('textarea');
            if (textarea) {
                textarea.focus();
            } else {
                console.error("Textarea not found in selected text box.");
                logDebug("selectTextBox: ERROR - Textarea not found in selected text box.");
            }
        } else {
            selectedTextBox = null;
            if (dom.textToolbar) dom.textToolbar.classList.remove('visible');
        }
    };

    // --- TOOLBAR EVENT LISTENERS ---
    if (dom.toolbarResizeBtn) {
        dom.toolbarResizeBtn.addEventListener('click', () => {
            if (!selectedRedactionBox) return;
            selectedRedactionBox.classList.toggle('resize-mode');
            if (selectedRedactionBox.classList.contains('resize-mode')) {
                 ['nw', 'ne', 'sw', 'se'].forEach(pos => {
                    const handle = document.createElement('div');
                    handle.className = `resize-handle ${pos}`;
                    if (selectedRedactionBox) selectedRedactionBox.appendChild(handle);
                });
            } else {
                Array.from(selectedRedactionBox.querySelectorAll('.resize-handle')).forEach(h => h.remove());
            }
        });
    }

    if (dom.textToolbarResizeBtn) {
        dom.textToolbarResizeBtn.addEventListener('click', async () => {
            if (!selectedTextBox || !selectedTextBox.dataset || !selectedTextBox.dataset.textIndex) return;
            const textObj = textObjects[parseInt(selectedTextBox.dataset.textIndex, 10)];
            if (!textObj) return;

            textObj.autoSize = !textObj.autoSize;
            selectedTextBox.classList.toggle('auto-size', textObj.autoSize);
            selectedTextBox.classList.toggle('resize-mode', !textObj.autoSize);

            if (!textObj.autoSize) {
                 ['nw', 'ne', 'sw', 'se'].forEach(pos => {
                    const handle = document.createElement('div');
                    handle.className = `resize-handle ${pos}`;
                    if (selectedTextBox) selectedTextBox.appendChild(handle);
                });
            } else {
                Array.from(selectedTextBox.querySelectorAll('.resize-handle')).forEach(h => h.remove());
            }
            const textarea = selectedTextBox.querySelector('textarea');
            if (textarea) await updateTextBoxSize(textarea);
        });
    }

    if (dom.toolbarDeleteBtn) {
        dom.toolbarDeleteBtn.addEventListener('click', async () => {
            if (!selectedRedactionBox || !selectedRedactionBox.dataset || !selectedRedactionBox.dataset.redactionIndex) return;
            const index = parseInt(selectedRedactionBox.dataset.redactionIndex, 10);
            if (isNaN(index)) return;
            redactionAreas.splice(index, 1);
            selectRedactionBox(null);
            await renderRedactionBoxes();
        });
    }

    if (dom.textFontSizeInput) {
        dom.textFontSizeInput.addEventListener('input', async (e) => {
            if (!selectedTextBox || !selectedTextBox.dataset || !selectedTextBox.dataset.textIndex) return;
            const target = /** @type {HTMLInputElement} */ (e.target);
            const index = parseInt(selectedTextBox.dataset.textIndex, 10);
            const newSize = parseInt(target.value, 10);
            if (isNaN(newSize) || !textObjects[index]) return;

            textObjects[index].fontSize = newSize;
            const textarea = selectedTextBox.querySelector('textarea');
            const canvas = selectedTextBox.closest('.relative')?.querySelector('canvas');
            if (textarea && canvas && pdfDoc && selectedTextBox) {
                const page = await pdfDoc.getPage(textObjects[index].originalPageNum);
                const scale = canvas.width / page.getViewport({scale: 1.0}).width;
                textarea.style.fontSize = `${newSize * scale}px`;
                await updateTextBoxSize(textarea);
            }
        });
    }

    if (dom.textColorInput) {
        dom.textColorInput.addEventListener('input', (e) => {
            if (!selectedTextBox || !selectedTextBox.dataset || !selectedTextBox.dataset.textIndex) return;
            const target = /** @type {HTMLInputElement} */ (e.target);
            const index = parseInt(selectedTextBox.dataset.textIndex, 10);
            const newColor = target.value;
            if (textObjects[index] && selectedTextBox) {
                textObjects[index].color = newColor;
                const textarea = selectedTextBox.querySelector('textarea');
                if (textarea) textarea.style.color = newColor;
            }
        });
    }

    if (dom.textToolbarDeleteBtn) {
        dom.textToolbarDeleteBtn.addEventListener('click', async () => {
            if (!selectedTextBox || !selectedTextBox.dataset || !selectedTextBox.dataset.textIndex) return;
            const index = parseInt(selectedTextBox.dataset.textIndex, 10);
            if (isNaN(index)) return;
            textObjects.splice(index, 1);
            selectTextBox(null);
            await renderTextObjects();
        });
    }

    // --- INTERACTION LOGIC ---
    /** @type {InteractionState} */
    let interactionState = { type: null, startX: 0, startY: 0, startLeft: 0, startTop: 0, startWidth: 0, startHeight: 0, handle: null };

    const interactionTarget = dom.pageContainer || document;

    interactionTarget.addEventListener('mousedown', /** @type {EventListener} */ (handleInteractionStart));
    document.addEventListener('mousemove', /** @type {EventListener} */ (handleInteractionMove));
    document.addEventListener('mouseup', /** @type {EventListener} */ (handleInteractionEnd));
    interactionTarget.addEventListener('touchstart', /** @type {EventListener} */ (handleInteractionStart), { passive: false });
    document.addEventListener('touchmove', /** @type {EventListener} */ (handleInteractionMove), { passive: false });
    document.addEventListener('touchend', /** @type {EventListener} */ (handleInteractionEnd));
    /** @param {MouseEvent | TouchEvent} e
     * @returns {Promise<void>}
     */
    async function handleInteractionStart(e) {
        const touch = e.changedTouches ? e.changedTouches[0] : e;
        const target = /** @type {HTMLElement} */ (e.target);
        logDebug("handleInteractionStart: Fired", { target: target.tagName + (target.className ? '.' + target.className : ''), clientX: touch.clientX, clientY: touch.clientY });

        const closestResizeHandle = target.closest('.resize-handle');
        const closestRedactionBox = target.closest('.redaction-box');
        const closestTextBox = target.closest('.text-box');

        if (closestResizeHandle) {
            e.stopPropagation();
            interactionState.type = 'resize';
            interactionState.handle = closestResizeHandle.classList[1];
            logDebug("Interaction type: resize", { handle: interactionState.handle });
        } else if (closestRedactionBox) {
            e.stopPropagation();
            interactionState.type = 'move';
            logDebug("Interaction type: move (redaction box)");
            selectRedactionBox(/** @type {HTMLDivElement} */ (closestRedactionBox));
        } else if (closestTextBox) {
            e.stopPropagation();
            interactionState.type = 'move';
            logDebug("Interaction type: move (text box)");
            selectTextBox(/** @type {HTMLDivElement} */ (closestTextBox));
        } else if (target.matches('canvas')) {
            logDebug("Interaction target: canvas", { activeTool });
            if (activeTool === 'redact') {
                interactionState.type = 'create-redaction';
                selectRedactionBox(null);
            } else if (activeTool === 'add-text') {
                interactionState.type = 'create-text';
                selectTextBox(null);
            } else {
                interactionState.type = null;
                selectRedactionBox(null);
                selectTextBox(null);
            }
        } else {
            logDebug("Interaction: No specific target, potentially deselecting.");
            if (!target.closest('#redaction-toolbar') && !target.closest('#text-toolbar') && !target.closest('#debug-overlay')) {
               selectRedactionBox(null);
               selectTextBox(null);
            }
            interactionState.type = null;
            return;
        }

        interactionState.startX = touch.clientX;
        interactionState.startY = touch.clientY;
        const selectedBox = selectedRedactionBox || selectedTextBox;
        if (selectedBox) {
            interactionState.startLeft = selectedBox.offsetLeft;
            interactionState.startTop = selectedBox.offsetTop;
            interactionState.startWidth = selectedBox.offsetWidth;
            interactionState.startHeight = selectedBox.offsetHeight;
            logDebug("Interaction state initialized for selected box", { type: interactionState.type, startX: interactionState.startX, startY: interactionState.startY, startW: interactionState.startWidth, startH: interactionState.startHeight });
        } else if (interactionState.type && interactionState.type.startsWith('create')) {
            logDebug("Interaction state initialized for create operation", { type: interactionState.type, startX: interactionState.startX, startY: interactionState.startY });
        }
    }
    /** @param {MouseEvent | TouchEvent} e
     * @returns {Promise<void>}
     */
    async function handleInteractionMove(e) {
        if (!interactionState.type || (interactionState.type !== 'move' && interactionState.type !== 'resize')) return;
        e.preventDefault();
        const touch = e.changedTouches ? e.changedTouches[0] : e;
        const dx = touch.clientX - interactionState.startX;
        const dy = touch.clientY - interactionState.startY;
        const selectedBox = selectedRedactionBox || selectedTextBox;
        if (!selectedBox) {
            return;
        }

        if (interactionState.type === 'move') {
            selectedBox.style.left = `${interactionState.startLeft + dx}px`;
            selectedBox.style.top = `${interactionState.startTop + dy}px`;
        } else if (interactionState.type === 'resize' && interactionState.handle) {
            const { handle, startLeft, startTop, startWidth, startHeight } = interactionState;
            let newWidth = startWidth;
            let newHeight = startHeight;
            let newLeft = startLeft;
            let newTop = startTop;

            if (handle.includes('e')) newWidth = startWidth + dx;
            if (handle.includes('w')) { newWidth = startWidth - dx; newLeft = startLeft + dx; }
            if (handle.includes('s')) newHeight = startHeight + dy;
            if (handle.includes('n')) { newHeight = startHeight - dy; newTop = startTop + dy; }

            selectedBox.style.width = `${Math.max(10, newWidth)}px`;
            selectedBox.style.height = `${Math.max(10, newHeight)}px`;
            if (handle.includes('w')) selectedBox.style.left = `${newLeft}px`;
            if (handle.includes('n')) selectedBox.style.top = `${newTop}px`;

            if (selectedTextBox) {
                const textarea = selectedTextBox.querySelector('textarea');
                if (textarea) await updateTextBoxSize(textarea);
            }
        }
    }
    /** @param {MouseEvent | TouchEvent} e
     * @returns {Promise<void>}
     */
    async function handleInteractionEnd(e) {
        if (!interactionState.type) return;
        logDebug("handleInteractionEnd: Fired", { type: interactionState.type });

        const selectedBox = selectedRedactionBox || selectedTextBox;
        const eventTargetCanvas = /** @type {HTMLCanvasElement | null} */ (e.target.closest('canvas'));
        const canvas = selectedBox ? selectedBox.closest('.relative')?.querySelector('canvas') : eventTargetCanvas;

        if (!canvas || !pdfDoc || !canvas.dataset.pageNum) {
            logDebug("handleInteractionEnd: No canvas found, pdfDoc not loaded, or pageNum missing. Aborting.", {selectedBoxExists: !!selectedBox, eventTarget: e.target.tagName, pdfDocExists: !!pdfDoc});
            interactionState.type = null;
            return;
        }

        const pageNum = parseInt(canvas.dataset.pageNum, 10);
        if (isNaN(pageNum)) {
             logDebug("handleInteractionEnd: Invalid pageNum on canvas. Aborting.", { pageNumString: canvas.dataset.pageNum });
             interactionState.type = null;
             return;
        }
        logDebug("handleInteractionEnd: Operating on canvas for pageNum: " + pageNum);
        const page = await pdfDoc.getPage(pageNum);
        const scale = canvas.width / page.getViewport({scale: 1.0}).width;
        const canvasRect = canvas.getBoundingClientRect();

        if (interactionState.type === 'move' || interactionState.type === 'resize') {
            if (!selectedBox) { interactionState.type = null; return; }
            if (selectedTextBox) {
                const textarea = selectedTextBox.querySelector('textarea');
                if (textarea) await updateTextBoxSize(textarea);
            }
            const rect = selectedBox.getBoundingClientRect();
            const x = (rect.left - canvasRect.left) / scale;
            const y = (rect.top - canvasRect.top) / scale;
            const width = rect.width / scale;
            const height = rect.height / scale;

            if (selectedRedactionBox && selectedRedactionBox.dataset.redactionIndex) {
                const index = parseInt(selectedRedactionBox.dataset.redactionIndex, 10);
                if (redactionAreas[index]) redactionAreas[index] = { ...redactionAreas[index], x, y, width, height };
                logDebug("handleInteractionEnd: Updated redactionArea", { index, newRect: redactionAreas[index] });
            } else if (selectedTextBox && selectedTextBox.dataset.textIndex) {
                const index = parseInt(selectedTextBox.dataset.textIndex, 10);
                if (textObjects[index]) textObjects[index] = { ...textObjects[index], x, y, width, height };
                logDebug("handleInteractionEnd: Updated textObject", { index, newRect: textObjects[index] });
            }
        } else if (interactionState.type === 'create-redaction') {
            const touch = e.changedTouches ? e.changedTouches[0] : e;
            logDebug("handleInteractionEnd: Creating redaction", {startX: interactionState.startX, currentX: touch.clientX, canvasLeft: canvasRect.left, scale});
            const x1 = (interactionState.startX - canvasRect.left) / scale;
            const y1 = (interactionState.startY - canvasRect.top) / scale;
            const x2 = (touch.clientX - canvasRect.left) / scale;
            const y2 = (touch.clientY - canvasRect.top) / scale;

            if (Math.abs(x1 - x2) > 5 && Math.abs(y1 - y2) > 5) {
                 redactionAreas.push({
                    originalPageNum: pageNum,
                    x: Math.min(x1, x2),
                    y: Math.min(y1, y2),
                    width: Math.abs(x1 - x2),
                    height: Math.abs(y1 - y2)
                });
                logDebug("handleInteractionEnd: New redactionArea pushed", { newArea: redactionAreas[redactionAreas.length-1] });
                await renderRedactionBoxes();
            }
            resetTool();
        } else if (interactionState.type === 'create-text') {
            const touch = e.changedTouches ? e.changedTouches[0] : e;
            const x = (touch.clientX - canvasRect.left) / scale;
            const y = (touch.clientY - canvasRect.top) / scale;
            logDebug("handleInteractionEnd: Creating text", { x, y, scale });

            const newTextObj = {
                id: crypto.randomUUID(),
                originalPageNum: pageNum,
                text: 'New Text',
                x, y,
                width: 100 / scale,
                height: 20 / scale,
                fontSize: 12,
                color: '#000000',
                direction: 'ltr',
                autoSize: true,
            };
            textObjects.push(newTextObj);
            logDebug("handleInteractionEnd: New textObject pushed", { newTextObj });
            await renderTextObjects();
            const newBox = /** @type {HTMLDivElement | null} */ (dom.pageContainer?.querySelector(`.text-box[data-text-index="${textObjects.length - 1}"]`));
            if (newBox) {
                logDebug("handleInteractionEnd: Selecting newly created text box.");
                selectTextBox(newBox);
            } else {
                logDebug("handleInteractionEnd: ERROR - Newly created text box not found in DOM for selection.");
            }
            resetTool();
        }

        logDebug("handleInteractionEnd: Resetting interactionState.type to null");
        interactionState.type = null;
    }

    const resetTool = () => {
        logDebug("resetTool: Resetting activeTool: " + activeTool);
        activeTool = null;
        if (dom.pageContainer) dom.pageContainer.style.cursor = 'default';
    };
    /** @param {string} toolName
     * @param {string} message
     * @returns {boolean}
     */
    const activateTool = (toolName, message) => {
        activeTool = toolName;
        logDebug("activateTool: Activated " + toolName);
        alert(message);
        closeDrawer();
        return true;
    };
    if (dom.toolAddTextBtn) dom.toolAddTextBtn.addEventListener('click', () => activateTool('add-text', 'Tap on a page to add a new text box.'));
    if (dom.toolRedactBtn) dom.toolRedactBtn.addEventListener('click', () => activateTool('redact', 'Tap and drag on a page to create a redaction area. Tap existing areas to manage them.'));

    // --- PRINT FUNCTIONALITY ---
    const handlePrintPdf = async () => {
        logDebug("handlePrintPdf: Initiated.");
        if (!pdfBytes) {
            alert("No PDF loaded to print.");
            logDebug("handlePrintPdf: Aborted - No PDF loaded.");
            return;
        }

        utils.showLoader('Preparing PDF for printing...');

        try {
            const printDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
            registerFontkitOnce(printDoc);
            const helveticaFont = await printDoc.embedFont(StandardFonts.Helvetica);
            let hebrewFont = null;
            try {
                const fontUrl = 'fonts/OpenSansHebrew-Regular.ttf';
                logDebug(`handlePrintPdf: Fetching Hebrew font from ${fontUrl}`);
                const fontBytesResponse = await fetch(fontUrl);
                if (!fontBytesResponse.ok) {
                    throw new Error(`Failed to fetch font: ${fontBytesResponse.status} ${fontBytesResponse.statusText}`);
                }
                const hebrewFontBytes = await fontBytesResponse.arrayBuffer();
                hebrewFont = await printDoc.embedFont(hebrewFontBytes);
                logDebug("handlePrintPdf: Hebrew font embedded successfully.");
            } catch (fontError) {
                console.error("Error loading Hebrew font for printing:", fontError);
                logDebug("handlePrintPdf: Error loading Hebrew font", { error: fontError.message, stack: fontError.stack });
                // Continue without Hebrew font, will fallback to Helvetica
            }

            const containsHebrew = (text) => {
                if (!text) return false;
                return /[֐-׿]/.test(text); // Basic check for Hebrew Unicode block
            };

            logDebug("handlePrintPdf: Applying textObjects. Count: " + textObjects.length);
            for (const textObj of textObjects) {
                const pageIndex = pageOrder.indexOf(textObj.originalPageNum);
                if (pageIndex === -1) {
                    logDebug(`Skipping textObj for print, pageIndex not found for originalPageNum: ${textObj.originalPageNum}`);
                    continue;
                }
                const page = printDoc.getPage(pageIndex);
                const { height: pageHeight } = page.getSize();
                const color = utils.hexToRgb(textObj.color);

                if (!color || typeof textObj.x !== 'number' || typeof textObj.y !== 'number' || typeof textObj.fontSize !== 'number' || typeof textObj.width !== 'number') {
                    console.error("Invalid text object property for printing, skipping:", textObj);
                    logDebug("handlePrintPdf: Invalid text object property, skipping.", textObj);
                    continue;
                }

                page.drawText(textObj.text, {
                    x: textObj.x,
                    y: pageHeight - textObj.y - textObj.fontSize, // PDF origin is bottom-left
                    font: containsHebrew(textObj.text) && hebrewFont ? hebrewFont : helveticaFont,
                    size: textObj.fontSize,
                    color: rgb(color.r / 255, color.g / 255, color.b / 255),
                    maxWidth: textObj.width,
                    textAlign: textObj.direction === 'rtl' ? TextAlignment.Right : TextAlignment.Left,
                });
            }

            logDebug("handlePrintPdf: Applying redactionAreas. Count: " + redactionAreas.length);
            for (const area of redactionAreas) {
                const pageIndex = pageOrder.indexOf(area.originalPageNum);
                if (pageIndex === -1) {
                    logDebug(`Skipping redactionArea for print, pageIndex not found for originalPageNum: ${area.originalPageNum}`);
                    continue;
                }
                const page = printDoc.getPage(pageIndex);
                const { height: pageHeight } = page.getSize();

                if (typeof area.x !== 'number' || typeof area.y !== 'number' || typeof area.width !== 'number' || typeof area.height !== 'number') {
                    console.error("Invalid redaction area property for printing, skipping:", area);
                    logDebug("handlePrintPdf: Invalid redaction area property, skipping.", area);
                    continue;
                }

                page.drawRectangle({
                    x: area.x,
                    y: pageHeight - area.y - area.height, // PDF origin is bottom-left
                    width: area.width,
                    height: area.height,
                    color: rgb(0, 0, 0), // Black for redaction
                });
            }

            const printPdfBytes = await printDoc.save();
            const blob = new Blob([printPdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);

            // Open the PDF in a new tab. This is more reliable than the iframe method.
            window.open(url);
            // Clean up the object URL after a short delay to allow the new tab to open.
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            logDebug('handlePrintPdf: PDF opened in new tab for printing.');

        } catch (error) {
            console.error("Error preparing PDF for print:", error);
            logDebug("handlePrintPdf: Error preparing PDF", { error: error.message, stack: error.stack });
            alert('An error occurred while preparing the PDF for printing. Please try again.');
        } finally {
            utils.hideLoader();
            logDebug("handlePrintPdf: Process finished, loader hidden.");
        }
    };

    if (dom.printPdfBtn) {
        dom.printPdfBtn.addEventListener('click', handlePrintPdf);
    }

    logDebug("Application initialized and event listeners attached.");
});

/**
 * @typedef {object} RedactionArea
 * @property {number} originalPageNum
 * @property {number} x
 * @property {number} y
 * @property {number} width
 * @property {number} height
 */

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
 * @typedef {object} InteractionState
 * @property {'resize' | 'move' | 'create-redaction' | 'create-text' | null} type
 * @property {number} startX
 * @property {number} startY
 * @property {number} startLeft
 * @property {number} startTop
 * @property {number} startWidth
 * @property {number} startHeight
 * @property {string | null} handle
 */
