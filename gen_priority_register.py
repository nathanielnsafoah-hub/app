from reportlab.lib.pagesizes import A4, landscape
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.units import mm

OUTPUT = "/Users/air2/Documents/attendance/Priority_Register_May2026.pdf"

PRIORITY_COLORS = {
    "Critical":    colors.HexColor("#C0392B"),
    "High":        colors.HexColor("#E67E22"),
    "Medium-High": colors.HexColor("#D4AC0D"),
    "Medium":      colors.HexColor("#2980B9"),
    "Low":         colors.HexColor("#27AE60"),
}

doc = SimpleDocTemplate(
    OUTPUT,
    pagesize=landscape(A4),
    leftMargin=15*mm, rightMargin=15*mm,
    topMargin=15*mm, bottomMargin=15*mm,
)

styles = getSampleStyleSheet()
title_style = ParagraphStyle("title", fontSize=14, fontName="Helvetica-Bold", spaceAfter=2)
sub_style   = ParagraphStyle("sub",   fontSize=9,  fontName="Helvetica",      spaceAfter=8, textColor=colors.HexColor("#555555"))
note_style  = ParagraphStyle("note",  fontSize=7.5,fontName="Helvetica-Oblique", textColor=colors.HexColor("#666666"), spaceBefore=6)

story = []

story.append(Paragraph("Month-End Reconciliation — Priority Register", title_style))
story.append(Paragraph("Exception Log &nbsp;|&nbsp; Period: May 2026 &nbsp;|&nbsp; Date: 23 May 2026 &nbsp;|&nbsp; Currency: GHS", sub_style))

headers = ["Ref", "Exception Type", "Amount\n(GHS)", "Age\n(Days)", "Composite\nScore", "Priority", "Action Urgency", "Target\nClose", "Owner"]

rows = [
    ["5",  "Suspense balance",      "72,000",  "65", "4.80", "Critical",    "Immediate — FC today",                "Before close",  "FC to assign"],
    ["1",  "Bank receipt unmatched","48,500",  "12", "3.20", "High",        "Immediate — bank investigation today","3 days",        "AR Supervisor"],
    ["4",  "Payroll deduction",     "11,600",  "18", "2.95", "Medium-High", "Today — 24-hr HR deadline",           "2 days",        "Finance Manager"],
    ["2",  "Duplicate invoice",     "18,200",  "4",  "1.75", "Medium",      "Urgent — reverse before payment run", "Today",         "AP Supervisor"],
    ["6",  "FX difference",         "9,800",   "9",  "1.65", "Medium",      "This week",                           "5 days",        "Treasury / AP"],
    ["3",  "Short payment",         "2,750",   "7",  "1.00", "Low",         "This week",                           "5 days",        "AR Clerk"],
    ["",   "TOTAL",                 "162,850", "",   "",     "",            "",                                    "",              ""],
]

col_widths = [12*mm, 44*mm, 26*mm, 18*mm, 22*mm, 28*mm, 64*mm, 22*mm, 36*mm]

table_data = [headers] + rows

base_style = [
    ("FONTNAME",    (0, 0), (-1, 0),  "Helvetica-Bold"),
    ("FONTSIZE",    (0, 0), (-1, 0),  8.5),
    ("BACKGROUND",  (0, 0), (-1, 0),  colors.HexColor("#1A1A2E")),
    ("TEXTCOLOR",   (0, 0), (-1, 0),  colors.white),
    ("ALIGN",       (0, 0), (-1, -1), "CENTER"),
    ("ALIGN",       (1, 1), (1, -2),  "LEFT"),
    ("ALIGN",       (6, 1), (6, -2),  "LEFT"),
    ("ALIGN",       (8, 1), (8, -2),  "LEFT"),
    ("VALIGN",      (0, 0), (-1, -1), "MIDDLE"),
    ("FONTNAME",    (0, 1), (-1, -1), "Helvetica"),
    ("FONTSIZE",    (0, 1), (-1, -1), 8),
    ("ROWBACKGROUNDS", (0, 1), (-1, -2), [colors.HexColor("#F8F9FA"), colors.white]),
    ("GRID",        (0, 0), (-1, -1), 0.4, colors.HexColor("#CCCCCC")),
    ("LINEABOVE",   (0, 0), (-1, 0),  1,   colors.HexColor("#1A1A2E")),
    ("LINEBELOW",   (0, 0), (-1, 0),  1,   colors.HexColor("#1A1A2E")),
    ("TOPPADDING",  (0, 0), (-1, -1), 5),
    ("BOTTOMPADDING",(0, 0),(-1, -1), 5),
    ("LEFTPADDING", (0, 0), (-1, -1), 4),
    ("RIGHTPADDING",(0, 0), (-1, -1), 4),
    # Total row
    ("FONTNAME",    (0, -1), (-1, -1), "Helvetica-Bold"),
    ("BACKGROUND",  (0, -1), (-1, -1), colors.HexColor("#EAECEE")),
    ("LINEABOVE",   (0, -1), (-1, -1), 1, colors.HexColor("#888888")),
]

# Priority cell colours
priority_col = 5
for i, row in enumerate(rows, start=1):
    pval = row[priority_col]
    bg = PRIORITY_COLORS.get(pval)
    if bg:
        base_style.append(("BACKGROUND", (priority_col, i), (priority_col, i), bg))
        base_style.append(("TEXTCOLOR",  (priority_col, i), (priority_col, i), colors.white))
        base_style.append(("FONTNAME",   (priority_col, i), (priority_col, i), "Helvetica-Bold"))

tbl = Table(table_data, colWidths=col_widths, repeatRows=1)
tbl.setStyle(TableStyle(base_style))

story.append(tbl)
story.append(Spacer(1, 4*mm))
story.append(Paragraph(
    "Priority bands: Critical ≥ 4.0 · High 3.0–3.9 · Medium-High 2.5–2.9 · Medium 1.5–2.4 · Low < 1.5  |  "
    "Composite score: Amount 30% · Age 20% · Compliance 20% · Control/Fraud 15% · Resolution 15%  |  "
    "All entries require Financial Controller sign-off before period close.",
    note_style
))

doc.build(story)
print("PDF saved:", OUTPUT)
