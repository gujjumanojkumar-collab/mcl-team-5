---
name: mcl-ppt
description: Make MCL-branded PowerPoint decks (.pptx) for Mahanadi Coalfields Ltd executives. Use whenever an MCL user asks for a PPT, PowerPoint, deck, slides or presentation. Every slide gets the MCL logo in the top right corner, the footer "Mahanadi Coalfields Ltd", and a blue, black and white theme.
---

# MCL presentation skill

Use this when an MCL executive asks for a PPT, PowerPoint, slides, a deck or a
presentation.

## Brand rules (always, on every slide)
1. **Logo:** the MCL logo (`assets/mcl-logo.jpg`) in the **top right corner of
   every slide**, including the title and closing slides.
2. **Footer:** the text **"Mahanadi Coalfields Ltd"** at the bottom of every
   slide (with the slide number on the right).
3. **Theme:** only **blue, black and white**.
   - Blue `#0F3F7D` (the MCL logo blue) - headings, title slide, highlights
   - Black `#111111` - body text, footer bar, section slides
   - White `#FFFFFF` - slide background
   - Allowed helpers: pale blue `#DCE6F2` for panels, grey `#555555` for small notes
   - No other colours (no green, red, orange) - even in charts.
   - Font: Calibri.

## How to build the deck
Use the helper `scripts/mcl_deck.py` in this skill's folder (needs `python-pptx`;
if missing, run `pip install python-pptx`). It applies all
three rules automatically, so never add slides any other way.

```python
import sys
# The folder this SKILL.md is in (shown as the skill's base directory when it loads)
sys.path.insert(0, "<skill folder>/scripts")
from mcl_deck import MCLDeck

deck = MCLDeck()
deck.title_slide("Quarterly Production Review", "Talcher Area", "November 2026")
deck.section_slide("Where we stand", 1)
deck.bullet_slide("Key points", ["Point one", "Point two"], note="Figures are illustrative")
deck.stats_slide("At a glance", [("92%", "Plan achieved"), ("14", "Delay hours")])
deck.two_column_slide("Issues and actions", "Issues", ["..."], "Actions", ["..."])
deck.table_slide("Contractor summary", ["Stage", "Delay (min)"], [["Drilling", 120]])
deck.chart_slide("Plan vs actual", ["Mon", "Tue"], {"Plan": [10, 12], "Actual": [9, 11]}, kind="bar")
deck.closing_slide("Thank you", "Questions and discussion")
deck.save("MCL-presentation.pptx")
```

Slide types: `title_slide`, `section_slide`, `bullet_slide`,
`two_column_slide`, `stats_slide`, `table_slide`, `chart_slide`
(bar / line / pie), `closing_slide`.

If you need a layout that is not there, add a method to `MCLDeck` that starts
with `self._new_slide()` (this is what puts the logo and footer on).

## Content rules
- Short slide titles; at most 5-6 bullets per slide, one line each.
- Plain English for busy executives: the main message first, details after.
- Start with a title slide, end with a closing slide.
- Do not invent real MCL figures, names or employee IDs. If numbers are made
  up, say so in a small note on the slide.

## Before handing over
1. Render to images and look at every slide (if LibreOffice is available):
   `soffice --headless --convert-to pdf deck.pptx` then
   `pdftoppm -png -r 50 deck.pdf page`.
2. Check: logo top right on every slide, footer on every slide, nothing
   overlapping the logo or footer, only blue / black / white used.
3. Save the .pptx where the user can open it and tell them the file name.
