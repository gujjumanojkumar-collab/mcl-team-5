"""MCL branded slide deck helper (python-pptx).

Every slide gets:
  - the MCL logo in the top right corner
  - the footer "Mahanadi Coalfields Ltd"
  - the blue / black / white theme

Use it from another script:
    import sys; sys.path.insert(0, ".claude/skills/mcl-ppt/scripts")
    from mcl_deck import MCLDeck
    deck = MCLDeck()
    deck.title_slide("Production Review", "Monthly update - made-up figures")
    deck.bullet_slide("Key points", ["Point one", "Point two"])
    deck.save("output.pptx")
"""
import os

from pptx import Presentation
from pptx.chart.data import CategoryChartData
from pptx.dml.color import RGBColor
from pptx.enum.chart import XL_CHART_TYPE, XL_LEGEND_POSITION
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.util import Inches, Pt

# ---- Theme: blue, black and white only ----
BLUE = RGBColor(0x0F, 0x3F, 0x7D)       # MCL logo blue
LIGHT_BLUE = RGBColor(0xDC, 0xE6, 0xF2)  # pale tint of the same blue, for panels
BLACK = RGBColor(0x11, 0x11, 0x11)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
GREY = RGBColor(0x55, 0x55, 0x55)        # muted black for small text
FONT = "Calibri"

FOOTER_TEXT = "Mahanadi Coalfields Ltd"
LOGO = os.path.join(os.path.dirname(__file__), "..", "assets", "mcl-logo.jpg")

W, H = Inches(13.333), Inches(7.5)  # 16:9
LOGO_W = Inches(1.6)                # logo is 269 x 146 px
LOGO_H = int(LOGO_W * 146 / 269)
MARGIN = Inches(0.5)
FOOTER_H = Inches(0.45)


class MCLDeck:
    def __init__(self):
        self.prs = Presentation()
        self.prs.slide_width, self.prs.slide_height = W, H
        self._blank = self.prs.slide_layouts[6]
        self._n = 0

    # ---------- building blocks ----------
    def _text(self, slide, x, y, w, h, text, size=18, bold=False,
              color=BLACK, align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP):
        box = slide.shapes.add_textbox(x, y, w, h)
        tf = box.text_frame
        tf.word_wrap = True
        tf.vertical_anchor = anchor
        lines = text if isinstance(text, list) else [text]
        for i, line in enumerate(lines):
            p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
            p.alignment = align
            r = p.add_run()
            r.text = line
            r.font.size, r.font.bold, r.font.name = Pt(size), bold, FONT
            r.font.color.rgb = color
        return box

    def _rect(self, slide, x, y, w, h, fill):
        s = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, x, y, w, h)
        s.fill.solid()
        s.fill.fore_color.rgb = fill
        s.line.fill.background()
        s.shadow.inherit = False
        return s

    def _new_slide(self, background=WHITE):
        """Blank slide with logo (top right) and footer. Always use this."""
        self._n += 1
        slide = self.prs.slides.add_slide(self._blank)
        bg = slide.background.fill
        bg.solid()
        bg.fore_color.rgb = background
        # Logo sits on a white tile so it stays clear on blue slides too.
        lx, ly = W - LOGO_W - Inches(0.3), Inches(0.25)
        if background != WHITE:
            self._rect(slide, lx - Inches(0.08), ly - Inches(0.06),
                       LOGO_W + Inches(0.16), LOGO_H + Inches(0.12), WHITE)
        slide.shapes.add_picture(LOGO, lx, ly, LOGO_W, LOGO_H)
        # Footer bar
        self._rect(slide, 0, H - FOOTER_H, W, FOOTER_H, BLACK)
        self._rect(slide, 0, H - FOOTER_H - Inches(0.05), W, Inches(0.05), BLUE)
        self._text(slide, MARGIN, H - FOOTER_H, Inches(8), FOOTER_H,
                   FOOTER_TEXT, 12, True, WHITE, anchor=MSO_ANCHOR.MIDDLE)
        self._text(slide, W - Inches(1.5), H - FOOTER_H, Inches(1), FOOTER_H,
                   str(self._n), 12, False, WHITE, PP_ALIGN.RIGHT,
                   MSO_ANCHOR.MIDDLE)
        return slide

    def _heading(self, slide, title):
        self._rect(slide, MARGIN, Inches(0.45), Inches(0.12), Inches(0.7), BLUE)
        self._text(slide, MARGIN + Inches(0.3), Inches(0.35),
                   W - LOGO_W - Inches(1.6), Inches(0.9), title, 30, True,
                   BLUE, anchor=MSO_ANCHOR.MIDDLE)

    # ---------- slide types ----------
    def title_slide(self, title, subtitle="", date_line=""):
        s = self._new_slide(BLUE)
        self._text(s, MARGIN + Inches(0.3), Inches(2.3), Inches(10.5),
                   Inches(1.6), title, 44, True, WHITE,
                   anchor=MSO_ANCHOR.BOTTOM)
        self._rect(s, MARGIN + Inches(0.3), Inches(4.05), Inches(2),
                   Inches(0.06), WHITE)
        if subtitle:
            self._text(s, MARGIN + Inches(0.3), Inches(4.25), Inches(10.5),
                       Inches(0.8), subtitle, 22, False, WHITE)
        if date_line:
            self._text(s, MARGIN + Inches(0.3), Inches(5.1), Inches(10.5),
                       Inches(0.5), date_line, 16, False, LIGHT_BLUE)
        return s

    def section_slide(self, title, number=""):
        s = self._new_slide(BLACK)
        if number:
            self._text(s, MARGIN + Inches(0.3), Inches(2.2), Inches(4),
                       Inches(1.2), str(number), 60, True, LIGHT_BLUE)
        self._text(s, MARGIN + Inches(0.3), Inches(3.4), Inches(11),
                   Inches(1.2), title, 40, True, WHITE)
        return s

    def bullet_slide(self, title, bullets, note=""):
        s = self._new_slide()
        self._heading(s, title)
        box = s.shapes.add_textbox(MARGIN + Inches(0.3), Inches(1.6),
                                   W - Inches(1.6), Inches(4.8))
        tf = box.text_frame
        tf.word_wrap = True
        for i, b in enumerate(bullets):
            p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
            p.space_after = Pt(12)
            dot = p.add_run()
            dot.text = "■  "
            dot.font.size, dot.font.color.rgb = Pt(14), BLUE
            r = p.add_run()
            r.text = b
            r.font.size, r.font.name, r.font.color.rgb = Pt(22), FONT, BLACK
        if note:
            self._text(s, MARGIN + Inches(0.3), H - FOOTER_H - Inches(0.7),
                       W - Inches(1.6), Inches(0.5), note, 13, False, GREY)
        return s

    def two_column_slide(self, title, left_title, left_bullets,
                         right_title, right_bullets):
        s = self._new_slide()
        self._heading(s, title)
        col_w = (W - 2 * MARGIN - Inches(0.4)) / 2
        for i, (t, items) in enumerate([(left_title, left_bullets),
                                        (right_title, right_bullets)]):
            x = MARGIN + i * (col_w + Inches(0.4))
            self._rect(s, x, Inches(1.6), col_w, Inches(0.6),
                       BLUE if i == 0 else BLACK)
            self._text(s, x + Inches(0.2), Inches(1.6), col_w, Inches(0.6),
                       t, 20, True, WHITE, anchor=MSO_ANCHOR.MIDDLE)
            self._rect(s, x, Inches(2.2), col_w, Inches(4.2), LIGHT_BLUE)
            self._text(s, x + Inches(0.25), Inches(2.4), col_w - Inches(0.5),
                       Inches(3.9), ["•  " + b for b in items], 18)
        return s

    def stats_slide(self, title, stats):
        """stats = [("1,240", "Tonnes moved"), ...]  (2 to 4 items)."""
        s = self._new_slide()
        self._heading(s, title)
        n = len(stats)
        gap = Inches(0.3)
        cw = (W - 2 * MARGIN - gap * (n - 1)) / n
        for i, (value, label) in enumerate(stats):
            x = MARGIN + i * (cw + gap)
            self._rect(s, x, Inches(2.3), cw, Inches(2.6),
                       BLUE if i % 2 == 0 else BLACK)
            self._text(s, x, Inches(2.5), cw, Inches(1.4), value, 48, True,
                       WHITE, PP_ALIGN.CENTER, MSO_ANCHOR.MIDDLE)
            self._text(s, x + Inches(0.2), Inches(3.9), cw - Inches(0.4),
                       Inches(0.9), label, 18, False, WHITE, PP_ALIGN.CENTER)
        return s

    def table_slide(self, title, header, rows):
        s = self._new_slide()
        self._heading(s, title)
        nrows, ncols = len(rows) + 1, len(header)
        tbl = s.shapes.add_table(nrows, ncols, MARGIN, Inches(1.6),
                                 W - 2 * MARGIN,
                                 Inches(0.5) * nrows).table
        for r in range(nrows):
            for c in range(ncols):
                cell = tbl.cell(r, c)
                cell.text = str(header[c] if r == 0 else rows[r - 1][c])
                cell.fill.solid()
                cell.fill.fore_color.rgb = (BLUE if r == 0 else
                                            (WHITE if r % 2 else LIGHT_BLUE))
                for p in cell.text_frame.paragraphs:
                    for run in p.runs:
                        run.font.size, run.font.name = Pt(16), FONT
                        run.font.bold = r == 0
                        run.font.color.rgb = WHITE if r == 0 else BLACK
        return s

    def chart_slide(self, title, categories, series, kind="bar"):
        """series = {"Plan": [..], "Actual": [..]}; kind = bar | line | pie."""
        s = self._new_slide()
        self._heading(s, title)
        data = CategoryChartData()
        data.categories = categories
        for name, vals in series.items():
            data.add_series(name, vals)
        ct = {"bar": XL_CHART_TYPE.COLUMN_CLUSTERED,
              "line": XL_CHART_TYPE.LINE_MARKERS,
              "pie": XL_CHART_TYPE.PIE}[kind]
        chart = s.shapes.add_chart(ct, MARGIN, Inches(1.5), W - 2 * MARGIN,
                                   Inches(5.2), data).chart
        chart.has_legend = len(series) > 1 or kind == "pie"
        if chart.has_legend:
            chart.legend.position = XL_LEGEND_POSITION.BOTTOM
            chart.legend.include_in_layout = False
        palette = [BLUE, BLACK, RGBColor(0x7F, 0x9C, 0xC4), GREY]
        if kind == "pie":
            for i, pt in enumerate(chart.plots[0].series[0].points):
                pt.format.fill.solid()
                pt.format.fill.fore_color.rgb = palette[i % len(palette)]
        else:
            for i, ser in enumerate(chart.plots[0].series):
                fmt = ser.format
                if kind == "line":
                    fmt.line.color.rgb = palette[i % len(palette)]
                    fmt.line.width = Pt(3)
                else:
                    fmt.fill.solid()
                    fmt.fill.fore_color.rgb = palette[i % len(palette)]
        return s

    def closing_slide(self, text="Thank you", sub=""):
        s = self._new_slide(BLUE)
        self._text(s, 0, Inches(2.6), W, Inches(1.3), text, 48, True, WHITE,
                   PP_ALIGN.CENTER, MSO_ANCHOR.MIDDLE)
        if sub:
            self._text(s, 0, Inches(3.9), W, Inches(0.8), sub, 20, False,
                       LIGHT_BLUE, PP_ALIGN.CENTER)
        return s

    def save(self, path):
        self.prs.save(path)
        return path
