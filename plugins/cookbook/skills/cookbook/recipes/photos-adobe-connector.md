# Photos: the Adobe for creativity connector

- For editing a real photo beyond sharpening: masks (subject, skin, a named object such as a
  window), cut-out, straighten, lens blur and generative expand; it also has Adobe Fonts tools.
  **Adobe for creativity** is Adobe's official hosted connector, reached through the owner's
  claude.ai account. None of its tools sharpens or upscales: that stays on [photos.md](photos.md).
- Proved on a business website's photos (10 November 2026): 26 masks (subject on every photo,
  skin on 8, window on 6) under a yellow-cast fix on 14 photos, straighten kept on 21 of 29, lens
  blur on 14, expand on 4 and one cut-out. The owner, 15 November 2026: "it really helped alot
  with photos/images".
- An ordinary session does not load it (109 tool names; that was why it was switched off). A
  task brings it in with a child session that loads this connector and nothing else:
  `node <skill folder>/scripts/adobe-session.mjs run --brief <file> --out <folder> --allow
  <tool>,<tool>`. Name each Adobe tool the piece needs; `tools --out <folder>` lists them. How
  it is limited, and why it is not a subagent: [setup](photos-adobe-connector-setup.md).
- The upload gate and the personal-data check in [photos.md](photos.md) hold here unchanged: no
  photo or film goes to Adobe without the owner's yes in the current chat naming the files, the
  Adobe account, the operation and the credits. Pass that yes word for word as `--owner-yes`;
  the script refuses every tool that is not read-only without it. The script cannot know what
  the owner said: quoting a yes the owner did not give in this chat is breaking the gate.
- Ask first, each time, for anything that stays in the owner's Adobe account: a Creative Cloud
  folder or file, a font kit or web project (`font_create_kit` and `get_fontkit_embed_url` both
  create one, whatever their descriptions say), a Firefly board, a Stock licence. Say afterwards
  what was left there; removing it is the owner's call.
- Money: the connector's calls have shown no charge, which is unsettled, not zero. Read the
  Firefly credit balance before and after a batch and give it a stop ("stop if it falls by more
  than N"). The Adobe plan is the owner's to keep or cancel ([photos.md](photos.md)).
- What the first job taught:
  - Use the masks and do the colour work locally. The connector's own temperature adjustment
    darkened the photo and turned a neutral window frame blue.
  - A cast correction needs a guard: never push a pixel past neutral, and keep skin from turning
    grey-green. A cream shirt or blonde hair is not a white reference.
  - Auto straighten was rejected on 8 of 29 photos, where it cropped over 10 % or cut into the
    person. Check the crop before keeping one.
  - Generative expand invents what it adds (a second plant pot, once). The owner or the client
    approves every expanded photo.
  - Lens blur also blurs what stands beside the person; little gain on a calm background.
  - Never relight or image-to-video on a photo of a real person: both redrew the face.
  - Adobe's result links expire: download at once, keep the originals, and look at zoomed crops
    of flat areas (walls, glass, whiteboards) before calling a batch done.
- Fallback: the same connector in a Claude Desktop chat, where it still loads. The same gate
  and stops hold there.
