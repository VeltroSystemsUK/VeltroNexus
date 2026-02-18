import sys
import json
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.graphics.shapes import Drawing
from reportlab.graphics.charts.barcharts import VerticalBarChart

def generate_recovery_report(data_json):
    """
    Generates a Cash Flow Recovery Report PDF based on the provided data.
    """
    try:
        data = json.loads(data_json)
        filename = f"Cash_Flow_Recovery_Report_{data['companyName'].replace(' ', '_')}.pdf"
        
        doc = SimpleDocTemplate(filename, pagesize=letter)
        styles = getSampleStyleSheet()
        story = []

        # Title
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            spaceAfter=30,
            textColor=colors.HexColor("#1e293b")
        )
        story.append(Paragraph(f"Cash Flow Recovery Report: {data['companyName']}", title_style))
        story.append(Spacer(1, 12))

        # Executive Summary
        story.append(Paragraph("Executive Summary", styles['Heading2']))
        summary_text = f"""
        <b>Current Debt Analysis:</b> {data['companyName']} is currently servicing active facilities with an estimated 
        monthly outflow of <b>£{data['currentMonthly']:,.2f}</b>. Based on 2026 market rates, this capital structure is inefficient.
        <br/><br/>
        <b>Refinancing Opportunity:</b> By consolidating into a 60-month facility at {data['newRate']:.1f}%, 
        monthly outflows can be reduced to <b>£{data['newMonthly']:,.2f}</b>.
        """
        story.append(Paragraph(summary_text, styles['Normal']))
        story.append(Spacer(1, 20))

        # The Delta Logic (Table)
        story.append(Paragraph("The 2026 Cost Efficiency Analysis", styles['Heading2']))
        
        table_data = [
            ['Metric', 'Current Structure', 'Proposed 5-Year Facility', 'The Impact (Delta)'],
            ['Interest Rate', f"{data['currentRate']:.1f}% (Est.)", f"{data['newRate']:.1f}%", f"{data['currentRate'] - data['newRate']:.1f}% Lower"],
            ['Monthly Payment', f"£{data['currentMonthly']:,.2f}", f"£{data['newMonthly']:,.2f}", f"£{data['monthlySaving']:,.2f} Saved"],
            ['Annual Liquidity', '£0.00', f"£{data['annualSaving']:,.2f}", f"£{data['annualSaving']:,.2f} Cash Generated"]
        ]

        t = Table(table_data, colWidths=[1.5*inch, 1.5*inch, 1.5*inch, 1.5*inch])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#0f172a")),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor("#f1f5f9")),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            # Highlight the Savings
            ('TEXTCOLOR', (3, 1), (3, -1), colors.HexColor("#16a34a")),
            ('FONTNAME', (3, 1), (3, -1), 'Helvetica-Bold'),
        ]))
        story.append(t)
        story.append(Spacer(1, 30))

        # Bar Chart: Monthly Cash Burn vs Surplus
        story.append(Paragraph("Monthly Cash Flow Comparison", styles['Heading2']))
        
        drawing = Drawing(400, 200)
        bc = VerticalBarChart()
        bc.x = 50
        bc.y = 50
        bc.height = 125
        bc.width = 300
        bc.data = [[data['currentMonthly'], data['newMonthly']]]
        bc.strokeColor = colors.black
        bc.valueAxis.valueMin = 0
        bc.valueAxis.valueMax = max(data['currentMonthly'], data['newMonthly']) * 1.2
        bc.valueAxis.valueStep = 2000
        bc.categoryAxis.labels.boxAnchor = 'ne'
        bc.categoryAxis.categoryNames = ['Current Monthly', 'Refinanced Monthly']
        bc.bars[0].fillColor = colors.HexColor("#ef4444") # Red for high cost
        bc.bars[1].fillColor = colors.HexColor("#22c55e") # Green for savings
        
        drawing.add(bc)
        story.append(drawing)
        story.append(Spacer(1, 20))

        # Valuation Impact
        story.append(Paragraph("5-Year Valuation Impact", styles['Heading2']))
        valuation_text = f"""
        In the current 2026 M&A environment, businesses are valued on EBITDA multiples. 
        <br/><br/>
        Every <b>£1,000</b> saved in monthly interest adds approximately <b>£50,000 - £70,000</b> to your business's exit value.
        <br/><br/>
        <b>Your Projected Valuation Increase:</b><br/>
        <font size=14 color='#16a34a'><b>£{data['valuationImpactLow']:,.0f} - £{data['valuationImpactHigh']:,.0f}</b></font>
        """
        story.append(Paragraph(valuation_text, styles['Normal']))
        story.append(Spacer(1, 30))

        # Disclaimer
        disclaimer_style = ParagraphStyle(
            'Disclaimer',
            parent=styles['Normal'],
            fontSize=8,
            textColor=colors.gray
        )
        story.append(Paragraph("DISCLAIMER: This report is for initial discussion purposes and does not constitute a formal offer of finance. Rates are subject to status, creditworthiness, and asset valuation. Veltro does not provide regulated financial advice.", disclaimer_style))

        # Build PDF
        doc.build(story)
        print(f"SUCCESS: Created {filename}")
        return filename

    except Exception as e:
        print(f"ERROR: {str(e)}")
        return None

if __name__ == "__main__":
    if len(sys.argv) > 1:
        arg = sys.argv[1]
        try:
            # Try to read as a file first
            with open(arg, 'r') as f:
                input_data = f.read()
        except (FileNotFoundError, OSError):
            # Fallback to treating arg as JSON string
            input_data = arg
            
        generate_recovery_report(input_data)
    else:
        # Test Data
        test_data = {
            "companyName": "Acme Manufacturing Ltd",
            "currentMonthly": 9500,
            "currentRate": 15.0,
            "newMonthly": 3150,
            "newRate": 8.5,
            "monthlySaving": 6350,
            "annualSaving": 76200,
            "valuationImpactLow": 381000,
            "valuationImpactHigh": 533400
        }
        generate_recovery_report(json.dumps(test_data))
