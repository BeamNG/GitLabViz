# Changelog

## [0.3.10] - 2026-01-07
- added context menu for issues
- sidebar: move “Clear filters” next to Filters header; remove duplicate reset button.
- Collapsed sidebar mini toolbar: add “Fit to screen”.

## [0.3.9] - 2026-01-07
- Improved navigation state persistence in the URL
- Improved About page

## [0.3.8] - 2026-01-07
- Prevent duplicate GitLab fetches: ignore “Save & Close/Reload” triggers while an update is already running.

## [0.3.7] - 2026-01-07
- Fix token-at-rest obfuscation: store token under `config.tokenObfuscated` (not `config.token`), keep runtime token plain, and keep `glv-xor1:` format.

## [0.3.6] - 2026-01-07
- GitLab token is now stored obfuscated at rest (XOR + base64) to avoid plain text in local storage / backups.

## [0.3.5] - 2026-01-06
- initial release to the public via github :)