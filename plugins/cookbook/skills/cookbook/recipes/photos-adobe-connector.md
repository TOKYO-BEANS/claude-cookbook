# Photos: the Adobe for creativity connector

- **Adobe for creativity** is Adobe's official hosted connector (`https://adobe-creativity.adobe.io/mcp`,
  OAuth with an Adobe account; docs at developer.adobe.com/adobe-for-creativity) with a Claude plugin. The
  owner connected both on 10 November 2026. In a Claude Code session it loaded 116 tool names (for
  example `image_apply_auto_tone`, `image_apply_adjustments`, `image_apply_preset`), none of them an
  upscaler or sharpener, so sharpening stays on the Firefly route ([photos.md](photos.md)). Its image tools also send photos
  to Adobe, so the same upload gate and personal-data check apply. Connected but not yet used for a
  task: prove it with one real call before relying on it. It can load twice, as the connector and as the
  plugin's server (which asks for sign-in in `/mcp`); use one, and see `connector-register.md` for
  its cost.
