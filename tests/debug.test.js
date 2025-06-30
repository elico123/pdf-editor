// tests/debug.test.js
import { jest } from '@jest/globals';

// No auto-mocking or jest.mock for domElements. Dependency Injection will be used.

// Mock navigator.clipboard
Object.defineProperty(navigator, 'clipboard', {
    value: {
        writeText: jest.fn().mockResolvedValue(undefined),
    },
    writable: true,
    configurable: true,
});

/** @typedef {import('../js/debug.js').DebugElements} DebugElements */

// These will be assigned fresh in beforeEach

/**
 * @typedef {object} TestSpecificMockedDomElements
 * @property {MockHTMLElement} debugOverlay
 * @property {MockHTMLMessagesContainer} debugMessagesContainer
 * @property {MockHTMLButtonElement} debugClearBtn
 * @property {MockHTMLButtonElement} debugCloseBtn
 * @property {MockHTMLButtonElement} debugCopyBtn
 * @property {MockHTMLButtonElement} toggleDebugBtn
 */

/**
 * @typedef {Omit<HTMLElement, 'classList'> & { classList: { contains: jest.Mock<() => boolean>, toggle: jest.Mock<() => void>, add: jest.Mock<() => void> } }} MockHTMLElement
 */

/**
 * @typedef {Omit<HTMLElement, 'appendChild' | 'innerHTML' | 'scrollTop' | 'scrollHeight'> & {
 *    innerHTML: string,
 *    appendChild: jest.Mock<(newChild: Node) => Node>,
 *    scrollTop: number,
 *    scrollHeight: number
 * }} MockHTMLMessagesContainer
 */

/**
 * @typedef {Omit<HTMLButtonElement, 'addEventListener'> & { addEventListener: jest.Mock }} MockHTMLButtonElement
 */


/** @type {TestSpecificMockedDomElements} */
let domElements;
/** @type {typeof import('../js/debug.js')} */
let actualDebugModule;


// Helper to reset mocks and module state before each test
/** @returns {Promise<TestSpecificMockedDomElements>} */
const initializeTestEnvironment = async () => {
    // Create the mock DOM elements structure for this specific test run.
    /** @type {TestSpecificMockedDomElements} */
    const currentTestMockElements = {
        debugOverlay: {
            classList: {
                contains: jest.fn().mockReturnValue(true),
                toggle: jest.fn(),
                add: jest.fn(),
            }
        },
        debugMessagesContainer: {
            innerHTML: '',
            appendChild: jest.fn(),
            scrollTop: 0,
            scrollHeight: 0,
        },
        debugClearBtn: { addEventListener: jest.fn() },
        debugCloseBtn: { addEventListener: jest.fn() },
        debugCopyBtn: { addEventListener: jest.fn() },
        toggleDebugBtn: { addEventListener: jest.fn() },
    };

    // Reset clipboard mock (global)
    if (navigator.clipboard && typeof navigator.clipboard.writeText.mockReset === 'function') {
        navigator.clipboard.writeText.mockReset().mockResolvedValue(undefined);
    }

    // Reset modules to get a fresh import of debug.js
    jest.resetModules();
    actualDebugModule = await import('../js/debug.js');

    // Initialize the debug system with our fresh mock elements for this run
    actualDebugModule.initDebugSystem(/** @type {DebugElements} */ (currentTestMockElements));

    return currentTestMockElements;
};

// Helper to get a specific event listener from a mock
/**
 * @param {{ addEventListener: jest.Mock } | null | undefined} mockTarget
 * @param {string} eventName
 * @returns {Function | undefined}
 */
const getListener = (mockTarget, eventName) => {
    if (!mockTarget || !mockTarget.addEventListener || !mockTarget.addEventListener.mock) {
        return undefined;
    }
    return mockTarget.addEventListener.mock.calls.find(call => call[0] === eventName)?.[1];
};


describe('Debug Module', () => {
    beforeEach(async () => {
        domElements = await initializeTestEnvironment();
    });

    describe('logDebug Function', () => {
        it('should store messages, and append to view if debug window is open', () => {
            domElements.debugOverlay.classList.contains.mockReturnValue(false); // Is open
            if (!domElements.debugMessagesContainer) throw new Error("debugMessagesContainer missing for test");

            actualDebugModule.logDebug('Test message visible');

            expect(domElements.debugMessagesContainer.appendChild).toHaveBeenCalledTimes(1);
            const appendedNode = domElements.debugMessagesContainer.appendChild.mock.calls[0][0];
            expect(appendedNode.innerHTML).toContain('Test message visible');

            const copyListener = getListener(domElements.debugCopyBtn, 'click');
            if (typeof copyListener === 'function') copyListener();
        });

        it('should store messages, and NOT append to view if debug window is closed', () => {
            domElements.debugOverlay.classList.contains.mockReturnValue(true); // Is hidden
            if (!domElements.debugMessagesContainer) throw new Error("debugMessagesContainer missing for test");

            actualDebugModule.logDebug('Test message hidden');
            expect(domElements.debugMessagesContainer.appendChild).not.toHaveBeenCalled();

            navigator.clipboard.writeText.mockClear();
            const copyListener = getListener(domElements.debugCopyBtn, 'click');
            if (typeof copyListener === 'function') copyListener();
            expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('Test message hidden'));
        });

        it('should handle different message types correctly when appending (view open)', () => {
            domElements.debugOverlay.classList.contains.mockReturnValue(false); // Is open
            if (!domElements.debugMessagesContainer) throw new Error("debugMessagesContainer missing for test");

            actualDebugModule.logDebug('Error test', undefined, 'error');
            expect(domElements.debugMessagesContainer.appendChild.mock.calls[0][0].innerHTML).toContain('ERROR: Error test');

            actualDebugModule.logDebug('Warn test', undefined, 'warn');
            expect(domElements.debugMessagesContainer.appendChild.mock.calls[1][0].innerHTML).toContain('WARN: Warn test');

            actualDebugModule.logDebug('Info test', undefined, 'info');
            expect(domElements.debugMessagesContainer.appendChild.mock.calls[2][0].innerHTML).toContain('INFO: Info test');

            actualDebugModule.logDebug('Log test', undefined, 'log');
            const lastAppendedNode = domElements.debugMessagesContainer.appendChild.mock.calls[3][0];
            expect(lastAppendedNode.innerHTML).not.toMatch(/ERROR:|WARN:|INFO:/);
            expect(lastAppendedNode.innerHTML).toContain('Log test');
        });

        it('should include stringified data when data is provided and view is open', () => {
            domElements.debugOverlay.classList.contains.mockReturnValue(false); // Is open
            if (!domElements.debugMessagesContainer) throw new Error("debugMessagesContainer missing for test");
            const data = { key: 'value', num: 123 };
            actualDebugModule.logDebug('Data test', data);

            const msgDiv = domElements.debugMessagesContainer.appendChild.mock.calls[0][0];
            expect(msgDiv.innerHTML).toContain('Data test');
            const preElement = msgDiv.querySelector('pre');
            expect(preElement).not.toBeNull();
            if (preElement) expect(preElement.textContent).toBe(JSON.stringify(data, null, 2));
        });

        it('should handle unserializable data gracefully when view is open', () => {
            domElements.debugOverlay.classList.contains.mockReturnValue(false); // Is open
            if (!domElements.debugMessagesContainer) throw new Error("debugMessagesContainer missing for test");
            const circularData = {};
            circularData.self = circularData;
            actualDebugModule.logDebug('Circular data test', circularData);

            const msgDiv = domElements.debugMessagesContainer.appendChild.mock.calls[0][0];
            expect(msgDiv.textContent).toContain('[Unserializable data: ');
        });
    });

    describe('Console Overrides', () => {
        beforeEach(() => {
            domElements.debugOverlay.classList.contains.mockReturnValue(true);
            navigator.clipboard.writeText.mockClear();
        });

        it('console.log should store message with type log', () => {
            console.log('Hello', 'Console');
            const copyListener = getListener(domElements.debugCopyBtn, 'click');
            if (typeof copyListener === 'function') copyListener();
            const copiedText = navigator.clipboard.writeText.mock.calls[0][0];
            expect(copiedText).toContain('Hello Console');
            expect(copiedText).not.toMatch(/ERROR:|WARN:|INFO:/);
        });

        it('console.error should store message with type error', () => {
            console.error('Console Error', { e: 1 });
            const copyListener = getListener(domElements.debugCopyBtn, 'click');
            if (typeof copyListener === 'function') copyListener();
            const copiedText = navigator.clipboard.writeText.mock.calls[0][0];
            expect(copiedText).toContain('ERROR: Console Error [object Object]');
        });

        it('console.warn should store message with type warn', () => {
            console.warn('Console Warn');
            const copyListener = getListener(domElements.debugCopyBtn, 'click');
            if (typeof copyListener === 'function') copyListener();
            const copiedText = navigator.clipboard.writeText.mock.calls[0][0];
            expect(copiedText).toContain('WARN: Console Warn');
        });

        it('console.info should store message with type info', () => {
            console.info('Console Info');
            const copyListener = getListener(domElements.debugCopyBtn, 'click');
            if (typeof copyListener === 'function') copyListener();
            const copiedText = navigator.clipboard.writeText.mock.calls[0][0];
            expect(copiedText).toContain('INFO: Console Info');
        });
    });

    describe('Toggle Debug Button Listener', () => {
        it('should display all stored messages when debug view is opened', async () => {
            domElements.debugOverlay.classList.contains.mockReturnValue(true); // Start hidden
            actualDebugModule.logDebug('Msg 1 before open');
            actualDebugModule.logDebug('Msg 2 before open', { detail: 'yes' });

            domElements.debugOverlay.classList.toggle.mockImplementation(() => {
                domElements.debugOverlay.classList.contains.mockReturnValue(false); // Simulate it's now open
            });
            if (!domElements.debugMessagesContainer) throw new Error("debugMessagesContainer missing for test");
            domElements.debugMessagesContainer.appendChild.mockClear();

            const toggleListener = getListener(domElements.toggleDebugBtn, 'click');
            if (typeof toggleListener === 'function') {
                toggleListener();
            } else {
                throw new Error("Toggle listener not found for test");
            }

            expect(domElements.debugMessagesContainer.innerHTML).toBe('');
            expect(domElements.debugMessagesContainer.appendChild).toHaveBeenCalledTimes(3);
            expect(domElements.debugMessagesContainer.appendChild.mock.calls[0][0].innerHTML).toContain('Msg 1 before open');
            expect(domElements.debugMessagesContainer.appendChild.mock.calls[1][0].innerHTML).toContain('Msg 2 before open');
            expect(domElements.debugMessagesContainer.appendChild.mock.calls[1][0].textContent).toContain('yes');
            expect(domElements.debugMessagesContainer.appendChild.mock.calls[2][0].innerHTML).toContain('Debug view opened.');
        });
    });

    describe('Clear Button Listener', () => {
        it('should clear messages container, empty loggedMessages array, and log action', async () => {
            domElements.debugOverlay.classList.contains.mockReturnValue(false); // Assume open
            actualDebugModule.logDebug('Message to be cleared');

            if (!domElements.debugMessagesContainer) throw new Error("debugMessagesContainer missing for test");
            domElements.debugMessagesContainer.appendChild.mockClear();

            const clearListener = getListener(domElements.debugClearBtn, 'click');
            if (typeof clearListener === 'function') {
                clearListener();
            } else {
                throw new Error("Clear listener not found for test");
            }

            expect(domElements.debugMessagesContainer.innerHTML).toBe('');
            expect(domElements.debugMessagesContainer.appendChild).toHaveBeenCalledTimes(1);
            expect(domElements.debugMessagesContainer.appendChild.mock.calls[0][0].innerHTML).toContain('Debug log cleared.');

            navigator.clipboard.writeText.mockClear();
            const listenerCandidate = getListener(domElements.debugCopyBtn, 'click');
            if (typeof listenerCandidate === 'function') {
                const copyListener = listenerCandidate;
                copyListener();
            }
            expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining("Debug log cleared."));
            const textCopied = navigator.clipboard.writeText.mock.calls[0][0];
            expect(textCopied).not.toContain("Message to be cleared");
        });
    });

    describe('Copy Button Listener and copyDebugLog Function', () => {
        it('should log "Nothing to copy" if log is empty initially', async () => {
            if (!domElements.debugMessagesContainer) throw new Error("debugMessagesContainer missing for test");
            domElements.debugMessagesContainer.appendChild.mockClear();
            domElements.debugOverlay.classList.contains.mockReturnValue(false); // Open overlay for logDebug

            const copyListener = getListener(domElements.debugCopyBtn, 'click');
            if (typeof copyListener === 'function') {
                copyListener();
            } else {
                throw new Error("Copy listener not found for test");
            }
            expect(navigator.clipboard.writeText).not.toHaveBeenCalled();

            expect(domElements.debugMessagesContainer.appendChild).toHaveBeenCalledTimes(1);
            expect(domElements.debugMessagesContainer.appendChild.mock.calls[0][0].innerHTML).toContain('Nothing to copy from debug log.');
        });
    });
});
