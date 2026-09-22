# Tasks

## 1. Clipboard Utility & Helper

- [x] 1.1 Implement resilient `copyToClipboard` helper in `src/utils/clipboard.ts` supporting `navigator.clipboard.writeText` with textarea fallback and verify by inspecting unit exports
- [x] 1.2 Create unit tests in `src/utils/clipboard.test.ts` covering clipboard API calls, fallback execution, and error recovery, and verify with `npm run test`

## 2. Chat Message Copy UI & Interaction

- [x] 2.1 Update `src/components/sidebar/JanusAgentPanel.tsx` to render a copy button on all message bubbles (user and agent) with hover reveal, clean positioning, and appropriate title/aria labels
- [x] 2.2 Implement ephemeral feedback state (`copiedMessageId`) in `JanusAgentPanel.tsx` switching the `Copy` icon to a `Check` icon and "Kopiert!" indicator for 2 seconds
- [x] 2.3 Ensure copy action is disabled or hidden for empty placeholder/streaming messages (`text.trim().length === 0`)

## 3. Verification & Quality Assurance

- [x] 3.1 Run test suite via `npm run test` and verify that all test suites pass without regressions
- [x] 3.2 Run production build via `npm run build` and verify clean TypeScript type checking and bundling
