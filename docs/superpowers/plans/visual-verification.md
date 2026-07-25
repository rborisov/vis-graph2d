# Visual verification checklist

Install `main.js`, `manifest.json`, and `styles.css` into
`<Vault>/.obsidian/plugins/vis-graph2d/`, reload Obsidian, and enable the
plugin under **Settings → Community plugins**.

- [ ] A time-axis chart renders with readable date labels.
- [ ] A numeric-axis chart shows round numbers (0, 25, 50 …), not dates.
- [ ] A category-axis chart shows the category names under the marks.
- [ ] Default series colours are legible in the light theme.
- [ ] Default series colours are legible in the dark theme.
- [ ] Axis text and gridlines follow the theme in both modes.
- [ ] The legend is readable and correctly positioned.
- [ ] A malformed block shows the red-bordered error box, not a blank space.
- [ ] Editing a referenced CSV file updates the chart without reopening the note.
- [ ] Settings → Graph2d shows all four settings; changing the default height
      visibly resizes a block that sets no height of its own.
- [ ] Each file in `docs/themes/` visibly changes the chart when enabled as a
      CSS snippet, and does not affect anything else in the vault.
- [ ] A chart inside a pubobs export renders as a static PNG rather than an
      interactive widget.
- [ ] Charts render correctly on mobile (the manifest claims
      `isDesktopOnly: false`).
