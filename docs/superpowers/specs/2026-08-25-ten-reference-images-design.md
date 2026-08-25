# Ten Reference Images Design

## Goal

Allow a user to submit up to ten reference images for a generation or edit request while preventing oversized multipart requests from exhausting the local proxy's memory.

## Scope

- The React UI accepts and displays up to ten reference images.
- The local Express proxy accepts up to ten `image[]` fields.
- The proxy rejects an edit request when all uploaded images and an optional mask exceed 50 MB in total.
- Existing per-file protection remains 20 MB.

## Request Flow

1. The browser limits selection to ten image files and continues to show their count.
2. The browser posts them as repeated `image[]` multipart fields, as it does today.
3. Multer rejects individual files larger than 20 MB and more than ten `image[]` fields.
4. The route sums the uploaded image and mask sizes before calling SudoCode. Requests over 50 MB receive a `413` response with a Chinese error message.
5. Valid requests are forwarded unchanged to the SudoCode-compatible image edits endpoint.

## Error Handling

- More than ten client-selected files: retain the first available files and show the existing capacity message with the new limit.
- More than ten multipart image fields: Multer rejects the request before it reaches the upstream API.
- Total files and mask over 50 MB: return `413` without consuming upstream API quota.
- Upstream rejection of ten images: continue returning the provider's status and message; no automatic retry is attempted.

## Testing And Validation

- Add a server-level test for the total-upload-size validator, including exactly 50 MB and over-50 MB cases.
- Run the project build after implementation.
- Do not make live 5-, 8-, or 10-image API calls in this change because those requests may consume the user's SudoCode quota. Those can be run later with explicit approval.

## Non-Goals

- No change to provider model, pricing, output format, or image generation endpoint.
- No persistent upload storage or server-side image transformation.
