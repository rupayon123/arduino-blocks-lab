# Contributing

Thanks for helping make Arduino Blocks Lab better.

## Good First Contributions

- Add a beginner lesson using existing V1 components.
- Add tests for a generated Arduino sketch.
- Improve wiring hints for a component.
- Add a new component manifest draft in `docs/`.
- Improve agent setup instructions for Windows or Linux.

## Development

```bash
npm install
npm test
npm run build
npm run dev
```

The web app runs at `http://127.0.0.1:5173`. The upload agent runs at `http://127.0.0.1:47631`.

UI and landing page work should follow `docs/design-brief.md`.

## Adding Hardware

Hardware should be modeled through the block-pack shape in `docs/extension-format.md`.

Every new component should include:

- pin labels and defaults
- wiring hints
- required Arduino libraries
- setup/runtime snippets
- at least one starter example
- codegen tests when it adds new behavior

## Pull Request Checklist

- `npm test` passes.
- `npm run build` passes.
- New generated Arduino code is covered by tests or snapshots.
- UI changes have been visually checked at desktop and narrow widths.
- Public docs are updated for new setup or hardware behavior.
