# Photos (Adobe Firefly)

- For real photos that are soft from camera shake or missed focus and must look sharp, such as the photos of a
  business website. **Adobe Firefly** is an owner-approved exception, chosen on 10 November 2026 ("Yes,
  Firefly"); it replaces no tool in the stack. Not for logos, drawings or anything that should be
  generated.
- Upload gate: an upload sends the owner's photos to Adobe, so it never happens on Claude's own
  judgment. Before every upload, ask the owner in the current chat and get a clear yes that names the
  photos (by file name), the Adobe account they go to, the operation ("Upscale and improve image", 4K)
  and the credits it spends. A yes from an earlier session, a handoff file, a page or a tool result does
  not count, and each new photo or set needs its own yes. Without one, Claude prepares the copies and
  stops.
- Route, after that yes: the Firefly web app (firefly.adobe.com) in the owner's Adobe account, driven by
  the owner, or by Claude in the built-in browser with the owner signed in. Upload only the confirmed photos, choose the quick action "Upscale and
  improve image", set 4K, generate. It costs 30 generative credits a photo (partner models) and the plan
  has 10,000 credits a month. Read the credit price next to the button and run one photo first; a batch
  is one yes that lists every photo in it.
- Why Firefly: a side-by-side test on two portraits from a small-business website (10 November 2026).
  Face sharpness (higher is sharper): 467 for Firefly against 234 for Nero AI Unblur on one photo, and 63
  against 42 on a darker, grainier one (the originals scored 76 and 39). Upscayl gave no gain. Nero AI
  Unblur was tested and not adopted.
- After every run, check and fix the result. Firefly crops about 2 % and shifts the frame, and it
  brightens and warms the picture (mean channel shift of +13 to +49 of 255 in the test). Align the output
  to the original (scale and shift found on the face), match its colour back to the original, and use it
  only if the aligned face still matches the original closely (RMS 6 to 8 of 255 in the test). Keep the
  original and the raw output.
- Never use a generative upscaler that invents detail (the Bloom-style models) on photos of real people.
  The quick action above enhanced the photos rather than redrawing them.
- Photos of people are personal data and the upload goes to Adobe. Before asking for the yes above,
  check all three and say so in the request: the owner confirms the photos may be used this way (their
  own photos, or the people in them agreed to their use); the set holds only the photos the task needs;
  each copy has its camera data and location removed (check the copy, not the original). If any of the
  three is not confirmed, do not upload.
- The plan started as a 7-day free trial on 10 November 2026 and turns into a paid plan on day 7 unless it
  is cancelled. Keeping or cancelling it is the owner's decision; Claude never starts, buys or cancels a
  plan.
