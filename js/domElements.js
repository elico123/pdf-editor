// js/domElements.js

/** @type {HTMLInputElement | null} */
export const fileInput = document.getElementById('file-input');
/** @type {HTMLButtonElement | null} */
export const openPdfBtn = document.getElementById('open-pdf-btn');
/** @type {HTMLButtonElement | null} */
export const savePdfBtn = document.getElementById('save-pdf-btn'); // "Save Editable..."
/** @type {HTMLButtonElement | null} */
export const saveFlatPdfBtnEl = document.getElementById('save-flat-pdf-btn'); // "Save for Sharing (Flattened)..."
/** @type {HTMLButtonElement | null} */
export const printPdfBtn = document.getElementById('print-pdf-btn');
/** @type {HTMLButtonElement | null} */
export const closePdfBtn = document.getElementById('close-pdf-btn');
/** @type {HTMLButtonElement | null} */
export const menuBtn = document.getElementById('menu-btn');
/** @type {HTMLElement | null} */
export const sidebar = document.getElementById('sidebar');
/** @type {HTMLElement | null} */
export const drawerOverlay = document.getElementById('drawer-overlay');
/** @type {HTMLElement | null} */
export const viewerContainer = document.getElementById('viewer-container');
/** @type {HTMLElement | null} */
export const pageContainer = document.getElementById('page-container');
/** @type {HTMLElement | null} */
export const thumbnailsContainer = document.getElementById('thumbnails-container');
/** @type {HTMLElement | null} */
export const welcomeMessage = document.getElementById('welcome-message');
/** @type {HTMLElement | null} */
export const loaderOverlay = document.getElementById('loader-overlay');
/** @type {HTMLElement | null} */
export const loaderText = document.getElementById('loader-text');
/** @type {HTMLButtonElement | null} */
export const toolAddTextBtn = document.getElementById('tool-add-text');
/** @type {HTMLButtonElement | null} */
export const toolRedactBtn = document.getElementById('tool-redact');
/** @type {HTMLButtonElement | null} */
export const toolMergeBtn = document.getElementById('tool-merge'); // Added this, was referenced in actionButtons
/** @type {HTMLButtonElement | null} */
export const toolSplitBtn = document.getElementById('tool-split'); // Added this, was referenced in actionButtons


// Redaction Toolbar
/** @type {HTMLElement | null} */
export const redactionToolbar = document.getElementById('redaction-toolbar');
/** @type {HTMLButtonElement | null} */
export const toolbarResizeBtn = document.getElementById('toolbar-resize-btn');
/** @type {HTMLButtonElement | null} */
export const toolbarDeleteBtn = document.getElementById('toolbar-delete-btn');
/** @type {HTMLInputElement | null} */
export const toolbarColorBtn = document.getElementById('toolbar-color-btn');

// Text Toolbar
/** @type {HTMLElement | null} */
export const textToolbar = document.getElementById('text-toolbar');
/** @type {HTMLButtonElement | null} */
export const textToolbarResizeBtn = document.getElementById('text-toolbar-resize-btn');
/** @type {HTMLInputElement | null} */
export const textFontSizeInput = document.getElementById('text-font-size');
/** @type {HTMLInputElement | null} */
export const textColorInput = document.getElementById('text-color');
/** @type {HTMLButtonElement | null} */
export const textToolbarDeleteBtn = document.getElementById('text-toolbar-delete-btn');

// Debug View Elements
/** @type {HTMLElement | null} */
export const debugOverlay = document.getElementById('debug-overlay');
/** @type {HTMLElement | null} */
export const debugMessagesContainer = document.getElementById('debug-messages');
/** @type {HTMLButtonElement | null} */
export const debugClearBtn = document.getElementById('debug-clear-btn');
/** @type {HTMLButtonElement | null} */
export const debugCloseBtn = document.getElementById('debug-close-btn');
/** @type {HTMLButtonElement | null} */
export const debugCopyBtn = document.getElementById('debug-copy-btn');
/** @type {HTMLButtonElement | null} */
export const toggleDebugBtn = document.getElementById('toggle-debug-btn');

// Action buttons array (for enabling/disabling) - Note: these are the elements themselves
// This array might be better constructed in app.js after importing these individual elements,
// or app.js can import these and then create its own array. For now, just exporting individuals.
// export const actionButtons = [ // This will be handled in app.js
// savePdfBtn, saveFlatPdfBtnEl, printPdfBtn, closePdfBtn,
// toolMergeBtn, toolSplitBtn, toolAddTextBtn, toolRedactBtn
// ];
