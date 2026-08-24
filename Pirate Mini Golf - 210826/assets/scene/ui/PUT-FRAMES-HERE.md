# UI frames go in this folder

Four PNGs, exactly these names:

- frame-panel.png       256 x 256, 48px border
- frame-panel-lit.png   256 x 256, 48px border
- frame-button.png       96 x 96,  24px border
- frame-chip.png         64 x 64,  16px border

Then set `useTextures: true` in src/golf/theme.ts.

Full spec, including the rules that matter for nine-slicing:
docs/ui-frames.md

This file is only here to create the folder. Delete it once the art lands —
it is excluded from deploys by .dclignore either way.
