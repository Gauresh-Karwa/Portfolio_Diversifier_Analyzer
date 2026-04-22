import io
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, KeepTogether, PageBreak
import numpy as np

def create_pdf(data):
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=30, leftMargin=30, topMargin=30, bottomMargin=30)
    story = []
    styles = getSampleStyleSheet()
    
    # Styles
    title_style = ParagraphStyle('TitleStyle', parent=styles['Heading1'], fontName='Helvetica-Bold', fontSize=22, alignment=1, spaceAfter=10, textColor=colors.HexColor('#1E1B4B'))
    subtitle_style = ParagraphStyle('SubtitleStyle', parent=styles['Normal'], fontName='Helvetica', fontSize=12, alignment=1, spaceAfter=20, textColor=colors.HexColor('#64748B'))
    heading_style = ParagraphStyle('HeadingStyle', parent=styles['Heading2'], fontName='Helvetica-Bold', fontSize=16, spaceBefore=20, spaceAfter=10, textColor=colors.HexColor('#0F172A'))
    small_italic = ParagraphStyle('SmallItalic', parent=styles['Normal'], fontName='Helvetica-Oblique', fontSize=8, textColor=colors.gray)
    
    # Top Header
    story.append(Paragraph("PORTFOLIO REBALANCING ANALYSIS", title_style))
    story.append(Paragraph("Diversification Report with Buy / Sell / Hold Action Plan", subtitle_style))
    
    # Extract
    pv = data.get('portfolio_value', 0)
    tc = data.get('total_capital', 0)
    sell_proceeds = data.get('total_sell_proceeds', 0)
    new_cash = max(0, tc - pv)
    
    # Summary Box
    summary_data = [
        ["Portfolio Value", "New Cash Added", "Total Capital", "Sell Proceeds"],
        [f"Rs.{pv:,.0f}", f"Rs.{new_cash:,.0f}", f"Rs.{tc:,.0f}", f"Rs.{sell_proceeds:,.0f}"]
    ]
    summary_table = Table(summary_data, colWidths=[1.7*inch]*4)
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1E3A8A')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('BACKGROUND', (0, 1), (-1, 1), colors.HexColor('#F1F5F9')),
        ('TEXTCOLOR', (0, 1), (-1, 1), colors.HexColor('#334155')),
        ('FONTNAME', (0, 1), (-1, 1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, 1), 10),
        ('GRID', (0,0), (-1,-1), 1, colors.HexColor('#CBD5E1')),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 20))
    
    # Section 1. Current Portfolio Holdings
    story.append(Paragraph("1. Current Portfolio Holdings", heading_style))
    alloc = data.get('allocation', {})
    actions = data.get('rebalance_actions', [])
    
    holdings_data = [["Symbol", "Qty", "Buy Price", "Current Price", "Invested", "Current Val", "P&L (Rs.)", "P&L %"]]
    
    tot_cost = 0
    tot_cur = 0
    tot_pnl = 0
    
    for a in actions:
        ticker = a.get('ticker', '')
        cost_basis = alloc.get(ticker, 0)
        cur_val = a.get('current_value', 0)
        
        if cost_basis == 0 and cur_val == 0:
            continue
            
        live_px = a.get('live_price')
        if not live_px:
            live_px = 1.0
            
        qty = cur_val / live_px if live_px > 0 and cur_val > 0 else (cost_basis / live_px if live_px > 0 else 0)
        buy_px = cost_basis / qty if qty > 0 else 0
        
        pnl = cur_val - cost_basis
        pnl_pct = (pnl / cost_basis * 100) if cost_basis > 0 else 0
        
        tot_cost += cost_basis
        tot_cur += cur_val
        tot_pnl += pnl
        
        pnl_str = f"+{pnl:,.0f}" if pnl > 0 else f"{pnl:,.0f}"
        pnl_pct_str = f"+{pnl_pct:.1f}%" if pnl_pct > 0 else f"{pnl_pct:.1f}%"
        
        holdings_data.append([
            a.get('symbol', ''), f"{qty:,.2f}", f"{buy_px:,.2f}", f"{live_px:,.2f}",
            f"{cost_basis:,.0f}", f"{cur_val:,.0f}", pnl_str, pnl_pct_str
        ])
            
    tot_pnl_str = f"+{tot_pnl:,.0f}" if tot_pnl > 0 else f"{tot_pnl:,.0f}"
    holdings_data.append(["TOTAL", "", "", "", f"{tot_cost:,.0f}", f"{tot_cur:,.0f}", tot_pnl_str, ""])
    
    h_table = Table(holdings_data, colWidths=[1.1*inch, 0.7*inch, 0.9*inch, 0.9*inch, 1.0*inch, 1.0*inch, 0.9*inch, 0.7*inch])
    h_styles = [
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1E3A8A')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('ALIGN', (1, 1), (-1, -1), 'RIGHT'),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#F1F5F9')),
    ]
    
    for i in range(1, len(holdings_data)):
        val_str = holdings_data[i][6]
        if val_str.startswith('+'):
            h_styles.append(('TEXTCOLOR', (6, i), (7, i), colors.HexColor('#16A34A')))
        elif val_str.startswith('-'):
            h_styles.append(('TEXTCOLOR', (6, i), (7, i), colors.HexColor('#DC2626')))
            
    h_table.setStyle(TableStyle(h_styles))
    story.append(h_table)
    story.append(Spacer(1, 20))
    
    # Section 2. Rebalancing Action Plan
    story.append(Paragraph("2. Rebalancing Action Plan", heading_style))
    story.append(Paragraph(f"New cash to invest: Rs.{new_cash:,.0f} | Sell proceeds: Rs.{sell_proceeds:,.0f} | Total deployable: Rs.{sell_proceeds + new_cash:,.0f}", styles['Normal']))
    story.append(Spacer(1, 10))
    
    plan_data = [["Symbol", "Action", "Curr Val (Rs.)", "Target Val (Rs.)", "Delta (Rs.)", "Live Price"]]
    p_styles = [
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1E3A8A')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('ALIGN', (2, 1), (-1, -1), 'RIGHT'),
    ]
    
    for i, a in enumerate(actions):
        row = [
            a.get('symbol', ''),
            a.get('action', ''),
            f"{a.get('current_value', 0):,.0f}",
            f"{a.get('target_value', 0):,.0f}",
            f"{a.get('delta_rupees', 0):,.0f}",
            f"{a.get('live_price', 0):,.2f}" if a.get('live_price') else "N/A"
        ]
        plan_data.append(row)
        
        c = colors.HexColor('#6B7280')
        if a.get('action') == 'BUY': c = colors.HexColor('#16A34A')
        elif a.get('action') == 'SELL': c = colors.HexColor('#DC2626')
        p_styles.append(('TEXTCOLOR', (1, i+1), (1, i+1), c))
        p_styles.append(('FONTNAME', (1, i+1), (1, i+1), 'Helvetica-Bold'))
        
    p_table = Table(plan_data, colWidths=[1.16*inch]*6)
    p_table.setStyle(TableStyle(p_styles))
    story.append(p_table)
    
    story.append(PageBreak())
    
    # Section 3. Execution Order & Summaries
    story.append(Paragraph("3. Execution Order & Summaries", heading_style))
    story.append(Paragraph("Execution Order: Execute SELL orders first to free up capital, then place BUY orders.", small_italic))
    story.append(Spacer(1, 10))
    
    sell_data = [["Stock", "Expected Proceeds"]]
    buy_data = [["Stock", "Amount"]]
    
    for a in actions:
        if a.get('action') == 'SELL':
            sell_data.append([a.get('symbol', ''), f"Rs.{a.get('delta_rupees', 0):,.0f}"])
        elif a.get('action') == 'BUY':
            buy_data.append([a.get('symbol', ''), f"Rs.{a.get('delta_rupees', 0):,.0f}"])
            
    sell_table = Table(sell_data, colWidths=[2.25*inch]*2)
    sell_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#DC2626')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
    ]))
    
    buy_table = Table(buy_data, colWidths=[2.25*inch]*2)
    buy_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#16A34A')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
    ]))
    
    story.append(sell_table)
    story.append(Spacer(1, 20))
    story.append(buy_table)
    
    story.append(Spacer(1, 20))
    
    # Section 4. AI Advisor Recommendation
    story.append(Paragraph("4. AI Advisor Recommendation", heading_style))
    
    ai_text = data.get('llm_recommendation', 'No recommendation available.')
    ai_text = str(ai_text).replace('\n', '<br/>')
    
    ai_style = ParagraphStyle('AIStyle', parent=styles['Normal'], backColor=colors.HexColor('#EFF6FF'), borderColor=colors.HexColor('#BFDBFE'), borderWidth=1, borderPadding=10, fontSize=10, leading=14)
    story.append(Paragraph(ai_text, ai_style))
    
    story.append(Spacer(1, 30))
    story.append(Paragraph("Disclaimer: This report is generated for academic purposes only and does not constitute financial advice. All metrics are computed from historical data. Past performance does not guarantee future returns. Consult a registered advisor.", small_italic))
    
    doc.build(story)
    return buffer.getvalue()
