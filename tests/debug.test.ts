// tests/debug.test.ts
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

// These will be assigned fresh in beforeEach
let domElements: any; // This will hold the mock object returned by initializeTestEnvironment
let actualDebugModule: any;


// Helper to reset mocks and module state before each test
const initializeTestEnvironment = async (): Promise<any> => { // Return type is the mock elements object
    // Create the mock DOM elements structure for this specific test run.
    const currentTestMockElements = {
        debugOverlay: {
            classList: {
                contains: jest.fn().mockReturnValue(true), // Default to hidden
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
    if (navigator.clipboard && typeof (navigator.clipboard.writeText as jest.Mock).mockReset === 'function') {
        (navigator.clipboard.writeText as jest.Mock).mockReset().mockResolvedValue(undefined);
    }

    // Reset modules to get a fresh import of debug.ts
    jest.resetModules();
    // actualDebugModule will be file-scoped, but assigned here for clarity of sequence
    actualDebugModule = await import('../js/debug');

    // Initialize the debug system with our fresh mock elements for this run
    actualDebugModule.initDebugSystem(currentTestMockElements);

    return currentTestMockElements; // Return the mocks for the test to use
};

// Helper to get a specific event listener from a mock
const getListener = (mockTarget: { addEventListener: jest.Mock } | null | undefined, eventName: string) => {
    if (!mockTarget || !mockTarget.addEventListener || !(mockTarget.addEventListener as jest.Mock).mock) {
        // console.log(`getListener: mockTarget, addEventListener, or .mock property for ${eventName} is undefined/missing. Target:`, mockTarget);
        return undefined;
    }
    // console.log(`getListener: calls for ${eventName} on mockTarget.addEventListener.mock.calls:`, (mockTarget.addEventListener as jest.Mock).mock.calls);
    return (mockTarget.addEventListener as jest.Mock).mock.calls.find(call => call[0] === eventName)?.[1];
};


describe('Debug Module', () => {
    // domElements will be populated by the beforeEach hook
    beforeEach(async () => {
        domElements = await initializeTestEnvironment();
    });

    describe('logDebug Function', () => {
        it('should store messages, and append to view if debug window is open', () => {
            (domElements.debugOverlay.classList.contains as jest.Mock).mockReturnValue(false); // Is open
            if (!domElements.debugMessagesContainer) throw new Error("debugMessagesContainer missing for test");

            actualDebugModule.logDebug('Test message visible');

            expect(domElements.debugMessagesContainer.appendChild).toHaveBeenCalledTimes(1);
            const callHtml = (domElements.debugMessagesContainer.appendChild as jest.Mock).mock.calls[0][0].innerHTML;
            expect(callHtml).toContain('Test message visible');

            const copyListener = getListener(domElements.debugCopyBtn, 'click');
            if (copyListener) copyListener(); // This will log, affecting next check if not careful
            // To check storage more directly, we'd need to export loggedMessages or test via UI interaction
        });

        it('should store messages, and NOT append to view if debug window is closed', () => {
            (domElements.debugOverlay.classList.contains as jest.Mock).mockReturnValue(true); // Is hidden
            if (!domElements.debugMessagesContainer) throw new Error("debugMessagesContainer missing for test");

            actualDebugModule.logDebug('Test message hidden');
            expect(domElements.debugMessagesContainer.appendChild).not.toHaveBeenCalled();

            // Verify it's stored by trying to copy it
            (navigator.clipboard.writeText as jest.Mock).mockClear(); // Clear before copy action
            const copyListener = getListener(domElements.debugCopyBtn, 'click');
            if (copyListener) copyListener();
            expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('Test message hidden'));
        });

        it('should handle different message types correctly when appending (view open)', () => {
            (domElements.debugOverlay.classList.contains as jest.Mock).mockReturnValue(false); // Is open
            if (!domElements.debugMessagesContainer) throw new Error("debugMessagesContainer missing for test");

            actualDebugModule.logDebug('Error test', undefined, 'error');
            expect((domElements.debugMessagesContainer.appendChild as jest.Mock).mock.calls[0][0].innerHTML).toContain('ERROR: Error test');

            actualDebugModule.logDebug('Warn test', undefined, 'warn');
            expect((domElements.debugMessagesContainer.appendChild as jest.Mock).mock.calls[1][0].innerHTML).toContain('WARN: Warn test');

            actualDebugModule.logDebug('Info test', undefined, 'info');
            expect((domElements.debugMessagesContainer.appendChild as jest.Mock).mock.calls[2][0].innerHTML).toContain('INFO: Info test');

            actualDebugModule.logDebug('Log test', undefined, 'log');
            const lastCallHtml = (domElements.debugMessagesContainer.appendChild as jest.Mock).mock.calls[3][0].innerHTML;
            expect(lastCallHtml).not.toMatch(/ERROR:|WARN:|INFO:/);
            expect(lastCallHtml).toContain('Log test');
        });

        it('should include stringified data when data is provided and view is open', () => {
            (domElements.debugOverlay.classList.contains as jest.Mock).mockReturnValue(false); // Is open
            if (!domElements.debugMessagesContainer) throw new Error("debugMessagesContainer missing for test");
            const data = { key: 'value', num: 123 };
            actualDebugModule.logDebug('Data test', data);

            const msgDiv = (domElements.debugMessagesContainer.appendChild as jest.Mock).mock.calls[0][0];
            expect(msgDiv.innerHTML).toContain('Data test');
            const preElement = msgDiv.querySelector('pre');
            expect(preElement).not.toBeNull();
            if (preElement) expect(preElement.textContent).toBe(JSON.stringify(data, null, 2));
        });

        it('should handle unserializable data gracefully when view is open', () => {
            (domElements.debugOverlay.classList.contains as jest.Mock).mockReturnValue(false); // Is open
            if (!domElements.debugMessagesContainer) throw new Error("debugMessagesContainer missing for test");
            const circularData: any = {};
            circularData.self = circularData;
            actualDebugModule.logDebug('Circular data test', circularData);

            const msgDiv = (domElements.debugMessagesContainer.appendChild as jest.Mock).mock.calls[0][0];
            expect(msgDiv.textContent).toContain('[Unserializable data: ');
        });
    });

    describe('Console Overrides', () => {
        beforeEach(() => {
            (domElements.debugOverlay.classList.contains as jest.Mock).mockReturnValue(true); // Keep it hidden for console tests (to test storage)
            (navigator.clipboard.writeText as jest.Mock).mockClear(); // Clear for each console test
        });

        it('console.log should store message with type log', () => {
            console.log('Hello', 'Console');
            const copyListener = getListener(domElements.debugCopyBtn, 'click');
            if (copyListener) copyListener();
            const copiedText = (navigator.clipboard.writeText as jest.Mock).mock.calls[0][0];
            expect(copiedText).toContain('Hello Console');
            expect(copiedText).not.toMatch(/ERROR:|WARN:|INFO:/);
        });

        it('console.error should store message with type error', () => {
            console.error('Console Error', { e: 1 });
            const copyListener = getListener(domElements.debugCopyBtn, 'click');
            if (copyListener) copyListener();
            const copiedText = (navigator.clipboard.writeText as jest.Mock).mock.calls[0][0];
            expect(copiedText).toContain('ERROR: Console Error [object Object]');
        });

        it('console.warn should store message with type warn', () => {
            console.warn('Console Warn');
            const copyListener = getListener(domElements.debugCopyBtn, 'click');
            if (copyListener) copyListener();
            const copiedText = (navigator.clipboard.writeText as jest.Mock).mock.calls[0][0];
            expect(copiedText).toContain('WARN: Console Warn');
        });

        it('console.info should store message with type info', () => {
            console.info('Console Info');
            const copyListener = getListener(domElements.debugCopyBtn, 'click');
            if (copyListener) copyListener();
            const copiedText = (navigator.clipboard.writeText as jest.Mock).mock.calls[0][0];
            expect(copiedText).toContain('INFO: Console Info');
        });
    });

    describe('Toggle Debug Button Listener', () => {
        it('should display all stored messages when debug view is opened', async () => {
            (domElements.debugOverlay.classList.contains as jest.Mock).mockReturnValue(true); // Start hidden
            actualDebugModule.logDebug('Msg 1 before open');
            actualDebugModule.logDebug('Msg 2 before open', { detail: 'yes' });

            (domElements.debugOverlay.classList.toggle as jest.Mock).mockImplementation(() => {
                (domElements.debugOverlay.classList.contains as jest.Mock).mockReturnValue(false); // Simulate it's now open
            });
            if (!domElements.debugMessagesContainer) throw new Error("debugMessagesContainer missing for test");
            (domElements.debugMessagesContainer.appendChild as jest.Mock).mockClear();

            const toggleListener = getListener(domElements.toggleDebugBtn, 'click');
            if (toggleListener) {
                toggleListener();
            } else {
                throw new Error("Toggle listener not found for test");
            }

            expect(domElements.debugMessagesContainer.innerHTML).toBe('');
            expect(domElements.debugMessagesContainer.appendChild).toHaveBeenCalledTimes(3);
            expect((domElements.debugMessagesContainer.appendChild as jest.Mock).mock.calls[0][0].innerHTML).toContain('Msg 1 before open');
            expect((domElements.debugMessagesContainer.appendChild as jest.Mock).mock.calls[1][0].innerHTML).toContain('Msg 2 before open');
            expect((domElements.debugMessagesContainer.appendChild as jest.Mock).mock.calls[1][0].textContent).toContain('yes');
            expect((domElements.debugMessagesContainer.appendChild as jest.Mock).mock.calls[2][0].innerHTML).toContain('Debug view opened.');
        });
    });

    describe('Clear Button Listener', () => {
        it('should clear messages container, empty loggedMessages array, and log action', async () => {
            (domElements.debugOverlay.classList.contains as jest.Mock).mockReturnValue(false); // Assume open
            actualDebugModule.logDebug('Message to be cleared');

            if (!domElements.debugMessagesContainer) throw new Error("debugMessagesContainer missing for test");
            (domElements.debugMessagesContainer.appendChild as jest.Mock).mockClear(); // Clear calls from initial logDebug

            const clearListener = getListener(domElements.debugClearBtn, 'click');
            if (clearListener) {
                clearListener();
            } else {
                throw new Error("Clear listener not found for test");
            }

            expect(domElements.debugMessagesContainer.innerHTML).toBe('');
            // appendChild is called once for "Debug log cleared."
            expect(domElements.debugMessagesContainer.appendChild).toHaveBeenCalledTimes(1);
            expect((domElements.debugMessagesContainer.appendChild as jest.Mock).mock.calls[0][0].innerHTML).toContain('Debug log cleared.');

            (navigator.clipboard.writeText as jest.Mock).mockClear();
            const copyListener = getListener(domElements.debugCopyBtn, 'click');
            if (copyListener) copyListener(); // This will attempt to copy the "Debug log cleared." message
            expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining("Debug log cleared."));
            // Ensure the original message isn't there
            const textCopied = (navigator.clipboard.writeText as jest.Mock).mock.calls[0][0];
            expect(textCopied).not.toContain("Message to be cleared");
        });
    });

    describe('Copy Button Listener and copyDebugLog Function', () => {
        it('should call navigator.clipboard.writeText with formatted log content', async () => {
            (domElements.debugOverlay.classList.contains as jest.Mock).mockReturnValue(true); // Keep hidden (so logDebug doesn't call appendChild)
            actualDebugModule.logDebug('First message for copy');
            actualDebugModule.logDebug('Second message for copy', { data: 'value' }, 'info');

            if (domElements.debugMessagesContainer) (domElements.debugMessagesContainer.appendChild as jest.Mock).mockClear();

            const copyListener = getListener(domElements.debugCopyBtn, 'click');
            if (copyListener) {
                copyListener();
            } else {
                throw new Error("Copy listener not found for test");
            }

            expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
            const copiedText = (navigator.clipboard.writeText as jest.Mock).mock.calls[0][0];
            expect(copiedText).toContain('First message for copy');
            expect(copiedText).toContain('INFO: Second message for copy');
            expect(copiedText).toContain(JSON.stringify({ data: 'value' }, null, 2));

            (navigator.clipboard.writeText as jest.Mock).mockClear();
            (domElements.debugMessagesContainer.appendChild as jest.Mock).mockClear(); // Clear for next logDebug call
            // Use mockImplementation for robustness in CI
            (domElements.debugOverlay.classList.contains as jest.Mock).mockImplementation(() => false); // Open overlay for next log

            if (copyListener) copyListener();
            // appendChild is called for "Log copied to clipboard."
            expect(domElements.debugMessagesContainer.appendChild).toHaveBeenCalledTimes(1);
            expect((domElements.debugMessagesContainer.appendChild as jest.Mock).mock.calls[0][0].innerHTML).toContain('Log copied to clipboard.');
        });

        it('should log "Nothing to copy" if log is empty initially', async () => {
            if (!domElements.debugMessagesContainer) throw new Error("debugMessagesContainer missing for test");
            (domElements.debugMessagesContainer.appendChild as jest.Mock).mockClear();
            (domElements.debugOverlay.classList.contains as jest.Mock).mockReturnValue(false); // Open overlay for logDebug

            const copyListener = getListener(domElements.debugCopyBtn, 'click');
            if (copyListener) {
                copyListener();
            } else {
                throw new Error("Copy listener not found for test");
            }
            expect(navigator.clipboard.writeText).not.toHaveBeenCalled();

            expect(domElements.debugMessagesContainer.appendChild).toHaveBeenCalledTimes(1);
            expect((domElements.debugMessagesContainer.appendChild as jest.Mock).mock.calls[0][0].innerHTML).toContain('Nothing to copy from debug log.');
        });

        it('should log error if clipboard write fails', async () => {
            // Use mockImplementation for robustness in CI
            (domElements.debugOverlay.classList.contains as jest.Mock).mockImplementation(() => false); // Open overlay for logDebug
            (navigator.clipboard.writeText as jest.Mock).mockRejectedValueOnce(new Error('Clipboard error'));

            // This first logDebug is just to populate loggedMessages, its appendChild isn't the focus.
            actualDebugModule.logDebug('Message that will fail to copy');

            (domElements.debugMessagesContainer.appendChild as jest.Mock).mockClear(); // Clear for the specific logDebug call from copyDebugLog

            const copyListener = getListener(domElements.debugCopyBtn, 'click');
            if (copyListener) {
                await copyListener();
            } else {
                throw new Error("Copy listener not found for test");
            }

            expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
            expect(domElements.debugMessagesContainer.appendChild).toHaveBeenCalledTimes(1);
            const loggedError = (domElements.debugMessagesContainer.appendChild as jest.Mock).mock.calls[0][0];
            expect(loggedError.innerHTML).toContain('ERROR: Failed to copy log to clipboard.');
            expect(loggedError.textContent).toContain('Clipboard error');
        });
    });
});

// To make this file a module
export {};
