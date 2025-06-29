// js/app.ts
// js/app.ts
import { EDITOR_METADATA_KEY } from './config.ts';
import * as dom from './domElements.ts';
import * as utils from './utils.ts';
import { logDebug, initDebugSystem } from './debug.ts'; // Import initDebugSystem
import * as pdfLibCore from './pdfSetup.ts';

// Explicitly type PDFDocumentConstructors from pdf-lib
// This helps in typing pdfDocInstance correctly later.
// Note: This assumes pdfSetup.ts will export these types or the module itself.
// For now, let's use `any` as a placeholder if direct types are complex to import immediately.
type PDFDocument = any; // Placeholder for actual PDFDocument type from pdf-lib
type PDFPage = any;     // Placeholder for actual PDFPage type from pdf-lib
type PDFJSDocument = any; // Placeholder for pdfjsLib.PDFDocumentProxy
type PDFJSPage = any;     // Placeholder for pdfjsLib.PDFPageProxy

interface RedactionArea {
    originalPageNum: number;
    x: number;
    y: number;
    width: number;
    height: number;
}

interface TextObject {
    id: string;
    originalPageNum: number;
    text: string;
    x: number;
    y: number;
    width: number;
    height: number; // Height might also be needed if text wraps or for bounding box
    fontSize: number;
    color: string;
    direction: 'ltr' | 'rtl';
    autoSize: boolean;
}

// Removed declare global for Window here; it's expected to be in pdfSetup.ts or a dedicated .d.ts file.
// If pdfjsLib and showSaveFilePicker are needed globally and not typed elsewhere,
// they would need a consolidated global declaration. For now, assuming pdfSetup.ts handles PDFLib/pdfjsLib globals.

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
    logDebug("Debug system initialized via app.ts");


    // Re-alias pdfLibCore objects for convenience if needed, or use pdfLibCore.PDFDocument etc.
    // These will need types from the imported module. For now, some might be `any`.
    const { PDFDocument, rgb, StandardFonts, TextAlignment, PDFName, PDFString, PDFHexString, grayscale }: any = pdfLibCore;

    // --- State Variables ---
    let pdfDoc: PDFJSDocument | null = null;
    let pdfBytes: Uint8Array | null = null;
    let pageOrder: number[] = [];
    let activeTool: string | null = null;
    let redactionAreas: RedactionArea[] = [];
    let textObjects: TextObject[] = [];
    let selectedRedactionBox: HTMLDivElement | null = null;
    let selectedTextBox: HTMLDivElement | null = null;

    const actionButtons: (HTMLButtonElement | null)[] = [
        dom.savePdfBtn, dom.saveFlatPdfBtnEl, dom.printPdfBtn, dom.closePdfBtn,
        dom.toolMergeBtn, dom.toolSplitBtn, dom.toolAddTextBtn, dom.toolRedactBtn
    ];

    // --- Core App Logic ---
    const updateActionButtonsState = (enabled: boolean): void => actionButtons.forEach(b => { if (b) b.disabled = !enabled; });
    updateActionButtonsState(false);

    const openDrawer = (): void => {
        if (dom.sidebar && dom.drawerOverlay) {
            dom.sidebar.classList.add('open');
            dom.drawerOverlay.classList.remove('hidden');
        }
    };
    const closeDrawer = (): void => {
        if (dom.sidebar && dom.drawerOverlay) {
            dom.sidebar.classList.remove('open');
            dom.drawerOverlay.classList.add('hidden');
        }
    };

    if (dom.menuBtn) {
        dom.menuBtn.addEventListener('click', (e: MouseEvent) => {
            e.stopPropagation();
            if (pdfDoc && dom.sidebar) {
                dom.sidebar.classList.contains('open') ? closeDrawer() : openDrawer();
            }
        });
    }
    if (dom.drawerOverlay) {
        dom.drawerOverlay.addEventListener('click', closeDrawer);
    }

    const closePdf = (): void => {
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

    const loadPdf = async (file: File): Promise<void> => {
        utils.showLoader('Loading PDF...');
        logDebug("loadPdf: Loading file", { name: file.name, size: file.size });
        try {
            pdfBytes = new Uint8Array(await file.arrayBuffer());
            await loadPdfFromBytes(pdfBytes);
            if (dom.welcomeMessage) dom.welcomeMessage.classList.add('hidden');
            if (dom.openPdfBtn) dom.openPdfBtn.classList.add('hidden');
            if (dom.menuBtn) dom.menuBtn.classList.remove('hidden');
        } catch (error: any) {
            console.error("Error loading PDF:", error);
            logDebug("loadPdf: Error loading PDF", { error: error.message, stack: error.stack });
            alert(`Error loading PDF: ${error.message}`);
            closePdf(); // Reset UI
        } finally {
            utils.hideLoader();
        }
    };

    const loadPdfFromBytes = async (bytes: Uint8Array): Promise<void> => {
         utils.showLoader('Rendering PDF...');
         pdfBytes = bytes; // Assuming pdfBytes is already Uint8Array | null
         const pdfDocInstance: PDFDocument = await PDFDocument.load(bytes, { ignoreEncryption: true }); // pdf-lib instance
         pdfDoc = await window.pdfjsLib.getDocument({ data: bytes }).promise; // pdf.js instance

         textObjects = [];
         redactionAreas = [];
         logDebug("loadPdfFromBytes: Initialized/reset textObjects and redactionAreas.");

         try {
            logDebug("Attempting to load editor data from custom catalog entry with key: " + EDITOR_METADATA_KEY);
            const customDataKey = PDFName.of(EDITOR_METADATA_KEY);
            const catalog = pdfDocInstance.catalog;
            const customDataValue = catalog.get(customDataKey);
            let jsonData: string | null = null;

            if (customDataValue instanceof PDFHexString) {
                logDebug("Found custom editor data as PDFHexString in catalog.");
                const bytes = customDataValue.decode(); // Should return Uint8Array
                jsonData = new TextDecoder('utf-8').decode(bytes);
                logDebug("Decoded PDFHexString data using UTF-8.", { dataLength: jsonData.length });
            } else if (customDataValue instanceof PDFString) {
                logDebug("Found custom editor data as PDFString in catalog (possibly older format).");
                jsonData = customDataValue.asString(); // This might be PDFDocEncoding or UTF-16BE
                logDebug("Decoded PDFString data.", { dataLength: jsonData.length });
            }

            if (jsonData) {
                const savedData = JSON.parse(jsonData);
                logDebug("Parsed editor data from catalog:", savedData);
                textObjects = savedData.textObjects || [];
                redactionAreas = savedData.redactionAreas || [];
                logDebug("Loaded textObjects count: " + textObjects.length);
                logDebug("Loaded redactionAreas count: " + redactionAreas.length);
            } else {
                logDebug("No custom editor data found in catalog or not a recognized string/hexstring type.", { retrievedObjectType: customDataValue ? customDataValue.constructor.name : 'undefined' });
            }
         } catch (e: any) { // Explicitly type 'e' as any
             console.error("Failed to load or parse editor data from custom catalog entry:", e);
             logDebug("Error loading/parsing from custom catalog entry. textObjects and redactionAreas remain empty.", { error: e.message, stack: e.stack });
         }

        pageOrder = Array.from({ length: pdfDoc.numPages }, (_, i) => i + 1);
         await renderAllPages();
         await renderThumbnails();
         updateActionButtonsState(true);
         utils.hideLoader();
    };

    const renderAllPages = async (): Promise<void> => {
        if (!dom.pageContainer || !dom.viewerContainer || !pdfDoc) return;
        dom.pageContainer.innerHTML = '';
        logDebug("renderAllPages: Starting. Page order count: " + pageOrder.length);
        for (const pageNum of pageOrder) {
            const page: PDFJSPage = await pdfDoc.getPage(pageNum);
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

    const renderThumbnails = async (): Promise<void> => {
        if (!dom.thumbnailsContainer || !pdfDoc) return;
        dom.thumbnailsContainer.innerHTML = '';
        logDebug("renderThumbnails: Starting. Page order count: " + pageOrder.length);
        for (let i = 0; i < pageOrder.length; i++) {
            const pageNum = pageOrder[i];
            const page: PDFJSPage = await pdfDoc.getPage(pageNum);
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
        logDebug("renderThumbnails: Completed.");
    };

    if (dom.openPdfBtn) dom.openPdfBtn.addEventListener('click', () => dom.fileInput?.click());
    if (dom.closePdfBtn) dom.closePdfBtn.addEventListener('click', closePdf);
    if (dom.fileInput) {
        dom.fileInput.addEventListener('change', (e: Event) => {
            const target = e.target as HTMLInputElement;
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

    const performStandardSave = async (): Promise<void> => {
        utils.showLoader('Saving Editable PDF...');
        logDebug("performStandardSave: Starting editable save.");
        try {
            if (!pdfBytes) {
                throw new Error("PDF data is not available.");
            }

            const finalDoc: PDFDocument = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

            const dataToStore = JSON.stringify({ textObjects, redactionAreas });
            const customDataKey = PDFName.of(EDITOR_METADATA_KEY);

            // Encode the JSON string to UTF-8 bytes
            const utf8Bytes = new TextEncoder().encode(dataToStore);
            // Store as a PDFHexString
            const customDataValue = PDFHexString.of(utf8Bytes);

            finalDoc.catalog.set(customDataKey, customDataValue);
            logDebug("performStandardSave: Set custom data (UTF-8 as PDFHexString) in PDF catalog.", { key: customDataKey.toString(), dataLength: utf8Bytes.length });

            const finalPdfBytes: Uint8Array = await finalDoc.save();
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
                } catch (err: any) {
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
        } catch (error: any) {
            console.error("Failed to save PDF:", error);
            logDebug("performStandardSave: ERROR during save process", { error: error.message, stack: error.stack });
        } finally {
            utils.hideLoader();
        }
    };

    const performFlattenedSave = async (): Promise<void> => {
        utils.showLoader('Saving Flattened PDF...');
        logDebug("performFlattenedSave: Starting flattened save.");
        try {
            if (!pdfBytes || !pdfDoc) {
                throw new Error("PDF data is not available for flattened save.");
            }

            const finalDoc: PDFDocument = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
            const helveticaFont = await finalDoc.embedFont(StandardFonts.Helvetica);

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

                const page: PDFPage = finalDoc.getPage(pageIndex);
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
                    font: helveticaFont,
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
                const page: PDFPage = finalDoc.getPage(pageIndex);
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

            const finalPdfBytes: Uint8Array = await finalDoc.save();
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
                } catch (err: any) {
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
        } catch (error: any) {
            console.error("Failed to save flattened PDF:", error);
            logDebug("performFlattenedSave: ERROR during save process", { error: error.message, stack: error.stack });
        } finally {
            utils.hideLoader();
        }
    };

    // --- OBJECT RENDERING & SELECTION ---
    const renderRedactionBoxes = async (): Promise<void> => {
        if (!dom.pageContainer || !pdfDoc) return;
        document.querySelectorAll('.redaction-box').forEach(box => box.remove());
        logDebug("renderRedactionBoxes. Count: " + redactionAreas.length, redactionAreas);
        for (const [index, area] of redactionAreas.entries()) {
            const pageDiv = dom.pageContainer.querySelector(`canvas[data-page-num="${area.originalPageNum}"]`)?.parentElement as HTMLElement | null;
            if (!pageDiv) continue;
            const canvas = pageDiv.querySelector('canvas');
            if (!canvas) continue;
            const page: PDFJSPage = await pdfDoc.getPage(area.originalPageNum);
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

    async function updateTextBoxSize(textarea: HTMLTextAreaElement): Promise<void> {
        if (!textarea || !textarea.parentElement || !(textarea.parentElement instanceof HTMLDivElement) || !pdfDoc) return;
        const box = textarea.parentElement as HTMLDivElement; // Assert box is HTMLDivElement
        if (!box.dataset.textIndex) return;
        const textIndex = parseInt(box.dataset.textIndex, 10);
        if (isNaN(textIndex) || !textObjects[textIndex]) return;

        const textObj = textObjects[textIndex];
        const canvas = textarea.closest('.relative')?.querySelector('canvas');
        if (!canvas) return;
        const page: PDFJSPage = await pdfDoc.getPage(textObj.originalPageNum);
        const scale = canvas.width / page.getViewport({ scale: 1.0 }).width;

        if (textObj.autoSize) {
            const oldWidthPx = box.offsetWidth;
            textarea.style.width = '1px'; // Temporarily shrink to measure scrollWidth
            const newWidthPx = textarea.scrollWidth + 4; // Add some padding
            textarea.style.width = '100%'; // Restore for layout
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

        textarea.style.height = 'auto'; // Temporarily shrink to measure scrollHeight
        const newHeightPx = textarea.scrollHeight;
        textarea.style.height = `${newHeightPx}px`; // Set to new scrollHeight
        box.style.height = `${newHeightPx}px`;
        textObj.height = newHeightPx / scale;
    }

    const renderTextObjects = async (): Promise<void> => {
        if (!dom.pageContainer || !pdfDoc) return;
        logDebug("Starting renderTextObjects. Current textObjects count: " + textObjects.length, textObjects);
        document.querySelectorAll('.text-box').forEach(box => box.remove());
        for (const [index, textObj] of textObjects.entries()) {
            logDebug(`Rendering textObj at index ${index}`, textObj);
            const pageDiv = dom.pageContainer.querySelector(`canvas[data-page-num="${textObj.originalPageNum}"]`)?.parentElement as HTMLElement | null;
            if (!pageDiv) {
                logDebug(`Skipping textObj ${index}: Page div not found for pageNum ${textObj.originalPageNum}`);
                continue;
            }
            const canvas = pageDiv.querySelector('canvas');
            if (!canvas) {
                logDebug(`Skipping textObj ${index}: Canvas not found in pageDiv for pageNum ${textObj.originalPageNum}`);
                continue;
            }
            const page: PDFJSPage = await pdfDoc.getPage(textObj.originalPageNum);
            const scale = canvas.width / page.getViewport({scale: 1.0}).width;
            logDebug(`TextObj ${index}: Scale calculated as ${scale}`);

            const box = document.createElement('div');
            box.className = 'text-box';
            box.classList.toggle('auto-size', textObj.autoSize);

            box.dataset.textIndex = String(index);
            box.style.left = `${textObj.x * scale}px`;
            box.style.top = `${textObj.y * scale}px`;
            box.style.width = `${textObj.width * scale}px`;
            // Height will be set by updateTextBoxSize

            const textarea = document.createElement('textarea');
            textarea.value = textObj.text;
            textarea.style.fontSize = `${textObj.fontSize * scale}px`;
            textarea.style.color = textObj.color;

            textarea.addEventListener('input', async () => {
                const text = textarea.value;
                const currentTextObj = textObjects[index];
                if (!currentTextObj) return; // Should not happen if index is valid
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

            await Promise.resolve(); // Allow DOM to update
            await updateTextBoxSize(textarea);
        }
    };

    const selectRedactionBox = (boxElement: HTMLDivElement | null, internalCall: boolean = false): void => {
        if (selectedRedactionBox) {
            selectedRedactionBox.classList.remove('selected', 'resize-mode');
            Array.from(selectedRedactionBox.children).forEach(child => child.remove()); // Remove handles
        }
        if (!internalCall) selectTextBox(null, true); // Deselect other type

        if (boxElement) {
            selectedRedactionBox = boxElement;
            selectedRedactionBox.classList.add('selected');
            if (dom.redactionToolbar) dom.redactionToolbar.classList.add('visible');
        } else {
            selectedRedactionBox = null;
            if (dom.redactionToolbar) dom.redactionToolbar.classList.remove('visible');
        }
    };

    const selectTextBox = (boxElement: HTMLDivElement | null, internalCall: boolean = false): void => {
        if (selectedTextBox) {
            selectedTextBox.classList.remove('selected', 'resize-mode');
            Array.from(selectedTextBox.querySelectorAll('.resize-handle')).forEach(h => h.remove());
        }
        if (!internalCall) selectRedactionBox(null, true); // Deselect other type

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
                // Ensure properties exist and are of correct type before assigning
                if (typeof textObj.fontSize !== 'number') { textObj.fontSize = 12; defaulted = true; logDebug("Defaulted fontSize"); }
                if (typeof textObj.color !== 'string') { textObj.color = '#000000'; defaulted = true; logDebug("Defaulted color"); }
                if (typeof textObj.text !== 'string') { textObj.text = ''; defaulted = true; logDebug("Defaulted text"); }
                if (typeof textObj.autoSize !== 'boolean') { textObj.autoSize = true; defaulted = true; logDebug("Defaulted autoSize"); }

                if(defaulted) {
                    logDebug("selectTextBox: textObj after defaulting:", JSON.parse(JSON.stringify(textObj)));
                }

                if (dom.textFontSizeInput) dom.textFontSizeInput.value = String(textObj.fontSize);
                if (dom.textColorInput) dom.textColorInput.value = textObj.color;

                textObjects[textObjIndex] = textObj; // Ensure this is updated if defaulted

                selectedTextBox.classList.toggle('auto-size', textObj.autoSize);
                selectedTextBox.classList.toggle('resize-mode', !textObj.autoSize);
                if (!textObj.autoSize) {
                    Array.from(selectedTextBox.querySelectorAll('.resize-handle')).forEach(h => h.remove());
                    ['nw', 'ne', 'sw', 'se'].forEach(pos => {
                        const handle = document.createElement('div');
                        handle.className = `resize-handle ${pos}`;
                        selectedTextBox?.appendChild(handle); // Check selectedTextBox is not null
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
    // --- TOOLBAR EVENT LISTENERS ---
    if (dom.toolbarResizeBtn) { // Redaction resize
        dom.toolbarResizeBtn.addEventListener('click', () => {
            if (!selectedRedactionBox) return;
            selectedRedactionBox.classList.toggle('resize-mode');
            if (selectedRedactionBox.classList.contains('resize-mode')) {
                 ['nw', 'ne', 'sw', 'se'].forEach(pos => {
                    const handle = document.createElement('div');
                    handle.className = `resize-handle ${pos}`;
                    if (selectedRedactionBox) selectedRedactionBox.appendChild(handle); // Null check
                });
            } else {
                Array.from(selectedRedactionBox.querySelectorAll('.resize-handle')).forEach(h => h.remove());
            }
        });
    }

    if (dom.textToolbarResizeBtn) { // Textbox resize/autosize toggle
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
                    if (selectedTextBox) selectedTextBox.appendChild(handle); // Null check
                });
            } else {
                Array.from(selectedTextBox.querySelectorAll('.resize-handle')).forEach(h => h.remove());
            }
            const textarea = selectedTextBox.querySelector('textarea');
            if (textarea) await updateTextBoxSize(textarea);
        });
    }

    if (dom.toolbarDeleteBtn) { // Redaction delete
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
        dom.textFontSizeInput.addEventListener('input', async (e: Event) => {
            if (!selectedTextBox || !selectedTextBox.dataset || !selectedTextBox.dataset.textIndex) return;
            const target = e.target as HTMLInputElement;
            const index = parseInt(selectedTextBox.dataset.textIndex, 10);
            const newSize = parseInt(target.value, 10);
            if (isNaN(newSize) || !textObjects[index]) return;

            textObjects[index].fontSize = newSize;
            const textarea = selectedTextBox.querySelector('textarea');
            const canvas = selectedTextBox.closest('.relative')?.querySelector('canvas');
            if (textarea && canvas && pdfDoc && selectedTextBox) { // Added null check for selectedTextBox
                const page: PDFJSPage = await pdfDoc.getPage(textObjects[index].originalPageNum);
                const scale = canvas.width / page.getViewport({scale: 1.0}).width;
                textarea.style.fontSize = `${newSize * scale}px`;
                await updateTextBoxSize(textarea);
            }
        });
    }

    if (dom.textColorInput) {
        dom.textColorInput.addEventListener('input', (e: Event) => {
            if (!selectedTextBox || !selectedTextBox.dataset || !selectedTextBox.dataset.textIndex) return;
            const target = e.target as HTMLInputElement;
            const index = parseInt(selectedTextBox.dataset.textIndex, 10);
            const newColor = target.value;
            if (textObjects[index] && selectedTextBox) { // Added null check for selectedTextBox
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
    interface InteractionState {
        type: 'resize' | 'move' | 'create-redaction' | 'create-text' | null;
        startX: number;
        startY: number;
        startLeft: number;
        startTop: number;
        startWidth: number;
        startHeight: number;
        handle: string | null; // e.g., 'nw', 'ne', 'sw', 'se'
    }
    let interactionState: InteractionState = { type: null, startX: 0, startY: 0, startLeft: 0, startTop: 0, startWidth: 0, startHeight: 0, handle: null };

    const interactionTarget: HTMLElement | Document = dom.pageContainer || document;

    // Ensure EventListener casts are applied
    interactionTarget.addEventListener('mousedown', handleInteractionStart as unknown as EventListener);
    document.addEventListener('mousemove', handleInteractionMove as unknown as EventListener);
    document.addEventListener('mouseup', handleInteractionEnd as unknown as EventListener);
    interactionTarget.addEventListener('touchstart', handleInteractionStart as unknown as EventListener, { passive: false });
    document.addEventListener('touchmove', handleInteractionMove as unknown as EventListener, { passive: false });
    document.addEventListener('touchend', handleInteractionEnd as unknown as EventListener);

    async function handleInteractionStart(e: MouseEvent | TouchEvent): Promise<void> {
        const touch = (e as TouchEvent).changedTouches ? (e as TouchEvent).changedTouches[0] : (e as MouseEvent);
        const target = e.target as HTMLElement;
        logDebug("handleInteractionStart: Fired", { target: target.tagName + (target.className ? '.' + target.className : ''), clientX: touch.clientX, clientY: touch.clientY });

        const closestResizeHandle = target.closest('.resize-handle') as HTMLElement | null;
        const closestRedactionBox = target.closest('.redaction-box') as HTMLDivElement | null;
        const closestTextBox = target.closest('.text-box') as HTMLDivElement | null;

        if (closestResizeHandle) {
            e.stopPropagation();
            interactionState.type = 'resize';
            interactionState.handle = closestResizeHandle.classList[1]; // Assumes second class is 'nw', 'ne', etc.
            logDebug("Interaction type: resize", { handle: interactionState.handle });
        } else if (closestRedactionBox) {
            e.stopPropagation();
            interactionState.type = 'move';
            logDebug("Interaction type: move (redaction box)");
            selectRedactionBox(closestRedactionBox);
        } else if (closestTextBox) {
            e.stopPropagation();
            interactionState.type = 'move';
            logDebug("Interaction type: move (text box)");
            selectTextBox(closestTextBox);
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

    async function handleInteractionMove(e: MouseEvent | TouchEvent): Promise<void> {
        if (!interactionState.type || (interactionState.type !== 'move' && interactionState.type !== 'resize')) return; // Only move/resize uses mousemove
        e.preventDefault();
        const touch = (e as TouchEvent).changedTouches ? (e as TouchEvent).changedTouches[0] : (e as MouseEvent);
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

            selectedBox.style.width = `${Math.max(10, newWidth)}px`; // Min width 10px
            selectedBox.style.height = `${Math.max(10, newHeight)}px`; // Min height 10px
            if (handle.includes('w')) selectedBox.style.left = `${newLeft}px`;
            if (handle.includes('n')) selectedBox.style.top = `${newTop}px`;

            if (selectedTextBox) {
                const textarea = selectedTextBox.querySelector('textarea');
                if (textarea) await updateTextBoxSize(textarea);
            }
        }
    }

    async function handleInteractionEnd(e: MouseEvent | TouchEvent): Promise<void> {
        if (!interactionState.type) return;
        logDebug("handleInteractionEnd: Fired", { type: interactionState.type });

        const selectedBox = selectedRedactionBox || selectedTextBox;
        const eventTargetCanvas = (e.target as HTMLElement).closest('canvas');
        const canvas = selectedBox ? selectedBox.closest('.relative')?.querySelector('canvas') : eventTargetCanvas;

        if (!canvas || !pdfDoc || !canvas.dataset.pageNum) {
            logDebug("handleInteractionEnd: No canvas found, pdfDoc not loaded, or pageNum missing. Aborting.", {selectedBoxExists: !!selectedBox, eventTarget: (e.target as HTMLElement).tagName, pdfDocExists: !!pdfDoc});
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
        const page: PDFJSPage = await pdfDoc.getPage(pageNum);
        const scale = canvas.width / page.getViewport({scale: 1.0}).width;
        const canvasRect = canvas.getBoundingClientRect();

        if (interactionState.type === 'move' || interactionState.type === 'resize') {
            if (!selectedBox) { interactionState.type = null; return; } // Should not happen if type is move/resize
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
            const touch = (e as TouchEvent).changedTouches ? (e as TouchEvent).changedTouches[0] : (e as MouseEvent);
            logDebug("handleInteractionEnd: Creating redaction", {startX: interactionState.startX, currentX: touch.clientX, canvasLeft: canvasRect.left, scale});
            const x1 = (interactionState.startX - canvasRect.left) / scale;
            const y1 = (interactionState.startY - canvasRect.top) / scale;
            const x2 = (touch.clientX - canvasRect.left) / scale;
            const y2 = (touch.clientY - canvasRect.top) / scale;

            if (Math.abs(x1 - x2) > 5 && Math.abs(y1 - y2) > 5) { // Min size check
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
            const touch = (e as TouchEvent).changedTouches ? (e as TouchEvent).changedTouches[0] : (e as MouseEvent);
            const x = (touch.clientX - canvasRect.left) / scale;
            const y = (touch.clientY - canvasRect.top) / scale;
            logDebug("handleInteractionEnd: Creating text", { x, y, scale });

            const newTextObj: TextObject = {
                id: crypto.randomUUID(),
                originalPageNum: pageNum,
                text: 'New Text',
                x, y,
                width: 100 / scale, // Default width in PDF units
                height: 20 / scale, // Default height in PDF units
                fontSize: 12, // Default font size in PDF points
                color: '#000000',
                direction: 'ltr',
                autoSize: true,
            };
            textObjects.push(newTextObj);
            logDebug("handleInteractionEnd: New textObject pushed", { newTextObj });
            await renderTextObjects();
            const newBox = dom.pageContainer?.querySelector(`.text-box[data-text-index="${textObjects.length - 1}"]`) as HTMLDivElement | null;
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

    const resetTool = (): void => {
        logDebug("resetTool: Resetting activeTool: " + activeTool);
        activeTool = null;
        if (dom.pageContainer) dom.pageContainer.style.cursor = 'default';
    };
    const activateTool = (toolName: string, message: string): boolean => {
        activeTool = toolName;
        logDebug("activateTool: Activated " + toolName);
        alert(message);
        closeDrawer();
        return true;
    };
    if (dom.toolAddTextBtn) dom.toolAddTextBtn.addEventListener('click', () => activateTool('add-text', 'Tap on a page to add a new text box.'));
    if (dom.toolRedactBtn) dom.toolRedactBtn.addEventListener('click', () => activateTool('redact', 'Tap and drag on a page to create a redaction area. Tap existing areas to manage them.'));

    // Initialize Service Worker
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/service-worker.js')
                .then(reg => console.log('SW registered.', reg))
                .catch(err => console.log('SW reg failed: ', err));
        });
    }
    logDebug("Application initialized and event listeners attached.");
});
