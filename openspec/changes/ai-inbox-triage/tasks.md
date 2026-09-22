# Tasks

## 1. AI Triage Classification Service

- [x] 1.1 Implement `AiTriageService` in `src/services/triage/aiTriageService.ts` with structured JSON prompt, robust parsing, and path sanitization using `vaultService.getTriagePayload()` and `llmService`
- [x] 1.2 Create comprehensive unit tests in `src/services/triage/aiTriageService.test.ts` covering recommendation parsing, resilient markdown block extraction, and graceful failure handling

## 2. Default AI Integration in TriageModal

- [x] 2.1 Update `TriageModal.tsx` to automatically invoke `AiTriageService` on mount as the default view, displaying an animated analysis state
- [x] 2.2 Render AI recommendation details (suggested path, mode badge, reasoning), pre-populate destination input, and allow inline adjustment
- [x] 2.3 Provide one-click filing and `Enter` shortcut submission, alongside a manual override toggle and graceful error fallback when AI is unavailable

## 3. Verification

- [x] 3.1 Run test suite via `npm run test` and verify all tests pass
- [x] 3.2 Run production build via `npm run build` and ensure clean type checking and asset bundling
