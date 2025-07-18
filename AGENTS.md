# Agent Instructions and Project Information

This project is a web-based PDF editor application.

## Key Features & Design Philosophy:

*   **Mobile UX Optimized:** The primary goal is to provide a smooth and intuitive user experience on mobile devices. Consider this when making UI/UX related changes.
*   **Privacy-Focused:** User privacy is paramount. The application is designed to process PDF documents entirely on the client-side.
*   **No Server Uploads:** Opened PDF documents, and any modifications made to them, are **not** uploaded to any server. All operations occur within the user's browser.

## Development Guidelines:

*   Maintain the client-side processing model for all PDF operations.
*   When adding new features, ensure they are responsive and work well across different screen sizes, prioritizing mobile usability.
*   If any changes could potentially impact user privacy or data handling, they must be carefully reviewed to ensure they align with the privacy-focused nature of this application.
*   When adding comments, don't forget those go to production. Keep only necessary comments for long-term.
*   **Test-Driven Development (TDD):** All new features and bug fixes must be developed following a TDD approach. This means that for any given change, a failing test must be written before the implementation is created.
