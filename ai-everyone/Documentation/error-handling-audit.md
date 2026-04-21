# Error Handling Audit (Gemini + Firebase + Auth)

Last updated: April 21, 2026

## Scope

This audit covers user-facing error handling for:

- Firebase Authentication (email/password + Google popup sign-in flows)
- Gemini API errors surfaced through chat and Bloom AI
- Generic network/server/API failures that affect the same user journeys

## Official References Reviewed

- Gemini API troubleshooting (backend status codes and fixes):  
  https://ai.google.dev/gemini-api/docs/troubleshooting
- Gemini API rate limits (RPM/TPM/RPD behavior, 429 context):  
  https://ai.google.dev/gemini-api/docs/rate-limits
- Firebase Web password auth guide (error handling + sign-in behavior):  
  https://firebase.google.com/docs/auth/web/password-auth
- Firebase JS Auth reference (`AuthErrorCodes` set):  
  https://firebase.google.com/docs/reference/js/auth#autherrorcodes

## Error Coverage Matrix

### Gemini API status mapping

- `INVALID_ARGUMENT` / `400` -> request format issue guidance
- `FAILED_PRECONDITION` / `400` -> project/billing/region precondition guidance
- `PERMISSION_DENIED` / `403` -> API permission/setup guidance
- `NOT_FOUND` / `404` -> missing model/resource guidance
- `RESOURCE_EXHAUSTED` / `429` -> high-traffic message with retry guidance
- `INTERNAL` / `500` -> temporary server issue with retry guidance
- `UNAVAILABLE` / `503` -> temporary capacity issue with retry guidance
- `DEADLINE_EXCEEDED` / `504` -> timeout guidance (retry/shorter prompt)

### Firebase Auth code mapping

- `auth/invalid-credential`
- `auth/wrong-password`
- `auth/user-not-found`
- `auth/email-already-in-use`
- `auth/weak-password`
- `auth/invalid-email`
- `auth/user-disabled`
- `auth/too-many-requests`
- `auth/quota-exceeded`
- `auth/network-request-failed`
- `auth/popup-closed-by-user`
- `auth/cancelled-popup-request`
- `auth/popup-blocked`
- `auth/account-exists-with-different-credential`
- `auth/credential-already-in-use`
- `auth/requires-recent-login`
- `auth/user-token-expired`
- `auth/user-signed-out`
- `auth/unauthorized-domain`
- `auth/operation-not-allowed`
- `auth/app-not-authorized`
- fallback for any unlisted `auth/*` code

### Generic API/network mapping

- `401`, `403`, `404`, `408`, `429`, `5xx`
- network/connectivity patterns (`failed to fetch`, `timeout`, `connection reset`, etc.)

## UI Components Added

- `src/components/error-ui/themed-error-banner.tsx`  
  Primary full-width themed error block for auth/chat/bloom surfaces.
- `src/components/error-ui/themed-inline-error.tsx`  
  Compact themed inline error for upload and modal overlays.

## Mapping Engine Added

- `src/lib/errors/user-facing-errors.ts`
  - centralized parser for `code`, `status`, and message patterns
  - provider-aware mapping for Firebase Auth and Gemini
  - retryability hints and high-traffic Gemini detection

## Integration Points Updated

- Auth views:
  - `src/modules/auth/views/sign-in-views.tsx`
  - `src/modules/auth/views/sign-up-views.tsx`
- Auth helper:
  - `src/lib/firebaseAuth.ts`
- Chat runtime + UI:
  - `src/modules/chat/context/chat-context.tsx`
  - `src/modules/chat/ui/components/chat-message-list.tsx`
  - `src/modules/chat/ui/components/chat-input.tsx`
- Upload/Drive:
  - `src/modules/chat/upload/use-chat-attachments.ts`
  - `src/modules/chat/upload/use-drive-upload-auth.ts`
  - `src/modules/chat/upload/components/drive-upload-signin-overlay.tsx`
- Bloom:
  - `src/modules/bloom-ai/hooks/use-bloom-workspace.ts`
  - `src/modules/bloom-ai/ui/views/bloom-ai-view.tsx`
  - `src/app/api/bloom-ai/chat/route.ts`
- Chat API:
  - `src/app/api/chat/route.ts`

