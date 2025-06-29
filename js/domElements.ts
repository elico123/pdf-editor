// js/domElements.ts

export const fileInput: HTMLInputElement | null = document.getElementById('file-input') as HTMLInputElement | null;
export const openPdfBtn: HTMLButtonElement | null = document.getElementById('open-pdf-btn') as HTMLButtonElement | null;
export const savePdfBtn: HTMLButtonElement | null = document.getElementById('save-pdf-btn') as HTMLButtonElement | null; // "Save Editable..."
export const saveFlatPdfBtnEl: HTMLButtonElement | null = document.getElementById('save-flat-pdf-btn') as HTMLButtonElement | null; // "Save for Sharing (Flattened)..."
export const printPdfBtn: HTMLButtonElement | null = document.getElementById('print-pdf-btn') as HTMLButtonElement | null;
export const closePdfBtn: HTMLButtonElement | null = document.getElementById('close-pdf-btn') as HTMLButtonElement | null;
export const menuBtn: HTMLButtonElement | null = document.getElementById('menu-btn') as HTMLButtonElement | null;
export const sidebar: HTMLElement | null = document.getElementById('sidebar');
export const drawerOverlay: HTMLElement | null = document.getElementById('drawer-overlay');
export const viewerContainer: HTMLElement | null = document.getElementById('viewer-container');
export const pageContainer: HTMLElement | null = document.getElementById('page-container');
export const thumbnailsContainer: HTMLElement | null = document.getElementById('thumbnails-container');
export const welcomeMessage: HTMLElement | null = document.getElementById('welcome-message');
export const loaderOverlay: HTMLElement | null = document.getElementById('loader-overlay');
export const loaderText: HTMLElement | null = document.getElementById('loader-text');
export const toolAddTextBtn: HTMLButtonElement | null = document.getElementById('tool-add-text') as HTMLButtonElement | null;
export const toolRedactBtn: HTMLButtonElement | null = document.getElementById('tool-redact') as HTMLButtonElement | null;
export const toolMergeBtn: HTMLButtonElement | null = document.getElementById('tool-merge') as HTMLButtonElement | null; // Added this, was referenced in actionButtons
export const toolSplitBtn: HTMLButtonElement | null = document.getElementById('tool-split') as HTMLButtonElement | null; // Added this, was referenced in actionButtons


// Redaction Toolbar
export const redactionToolbar: HTMLElement | null = document.getElementById('redaction-toolbar');
export const toolbarResizeBtn: HTMLButtonElement | null = document.getElementById('toolbar-resize-btn') as HTMLButtonElement | null;
export const toolbarDeleteBtn: HTMLButtonElement | null = document.getElementById('toolbar-delete-btn') as HTMLButtonElement | null;

// Text Toolbar
export const textToolbar: HTMLElement | null = document.getElementById('text-toolbar');
export const textToolbarResizeBtn: HTMLButtonElement | null = document.getElementById('text-toolbar-resize-btn') as HTMLButtonElement | null;
export const textFontSizeInput: HTMLInputElement | null = document.getElementById('text-font-size') as HTMLInputElement | null;
export const textColorInput: HTMLInputElement | null = document.getElementById('text-color') as HTMLInputElement | null;
export const textToolbarDeleteBtn: HTMLButtonElement | null = document.getElementById('text-toolbar-delete-btn') as HTMLButtonElement | null;

// Debug View Elements
export const debugOverlay: HTMLElement | null = document.getElementById('debug-overlay');
export const debugMessagesContainer: HTMLElement | null = document.getElementById('debug-messages');
export const debugClearBtn: HTMLButtonElement | null = document.getElementById('debug-clear-btn') as HTMLButtonElement | null;
export const debugCloseBtn: HTMLButtonElement | null = document.getElementById('debug-close-btn') as HTMLButtonElement | null;
export const debugCopyBtn = document.getElementById('debug-copy-btn') as HTMLButtonElement | null;
export const toggleDebugBtn: HTMLButtonElement | null = document.getElementById('toggle-debug-btn') as HTMLButtonElement | null;

// Action buttons array (for enabling/disabling) - Note: these are the elements themselves
// This array might be better constructed in app.js after importing these individual elements,
// or app.js can import these and then create its own array. For now, just exporting individuals.
// export const actionButtons = [ // This will be handled in app.js
// savePdfBtn, saveFlatPdfBtnEl, printPdfBtn, closePdfBtn,
// toolMergeBtn, toolSplitBtn, toolAddTextBtn, toolRedactBtn
// ];
