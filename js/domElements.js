// js/domElements.js

export const fileInput = document.getElementById('file-input');
export const openPdfBtn = document.getElementById('open-pdf-btn');
export const savePdfBtn = document.getElementById('save-pdf-btn'); // "Save Editable..."
export const saveFlatPdfBtnEl = document.getElementById('save-flat-pdf-btn'); // "Save for Sharing (Flattened)..."
export const printPdfBtn = document.getElementById('print-pdf-btn');
export const closePdfBtn = document.getElementById('close-pdf-btn');
export const menuBtn = document.getElementById('menu-btn');
export const sidebar = document.getElementById('sidebar');
export const drawerOverlay = document.getElementById('drawer-overlay');
export const viewerContainer = document.getElementById('viewer-container');
export const pageContainer = document.getElementById('page-container');
export const thumbnailsContainer = document.getElementById('thumbnails-container');
export const welcomeMessage = document.getElementById('welcome-message');
export const loaderOverlay = document.getElementById('loader-overlay');
export const loaderText = document.getElementById('loader-text');
export const toolAddTextBtn = document.getElementById('tool-add-text');
export const toolRedactBtn = document.getElementById('tool-redact');
export const toolMergeBtn = document.getElementById('tool-merge'); // Added this, was referenced in actionButtons
export const toolSplitBtn = document.getElementById('tool-split'); // Added this, was referenced in actionButtons


// Redaction Toolbar
export const redactionToolbar = document.getElementById('redaction-toolbar');
export const toolbarResizeBtn = document.getElementById('toolbar-resize-btn');
export const toolbarDeleteBtn = document.getElementById('toolbar-delete-btn');

// Text Toolbar
export const textToolbar = document.getElementById('text-toolbar');
export const textToolbarResizeBtn = document.getElementById('text-toolbar-resize-btn');
export const textFontSizeInput = document.getElementById('text-font-size');
export const textColorInput = document.getElementById('text-color');
export const textToolbarDeleteBtn = document.getElementById('text-toolbar-delete-btn');

// Debug View Elements
export const debugOverlay = document.getElementById('debug-overlay');
export const debugMessagesContainer = document.getElementById('debug-messages');
export const debugClearBtn = document.getElementById('debug-clear-btn');
export const debugCloseBtn = document.getElementById('debug-close-btn');
export const toggleDebugBtn = document.getElementById('toggle-debug-btn');

// Action buttons array (for enabling/disabling) - Note: these are the elements themselves
// This array might be better constructed in app.js after importing these individual elements,
// or app.js can import these and then create its own array. For now, just exporting individuals.
// export const actionButtons = [ // This will be handled in app.js
// savePdfBtn, saveFlatPdfBtnEl, printPdfBtn, closePdfBtn,
// toolMergeBtn, toolSplitBtn, toolAddTextBtn, toolRedactBtn
// ];
