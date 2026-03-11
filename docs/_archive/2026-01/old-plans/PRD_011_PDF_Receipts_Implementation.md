# PRD-011: PDF Receipts - Implementation Plan
# Educational Guide for Solo Developer

**Document Version**: 1.0  
**Last Updated**: November 1, 2025  
**Estimated Duration**: Week 12 (4 days)  
**Difficulty**: ⭐⭐⭐ Moderate  
**Prerequisites**: PRD 001-010 completed

---

## 📚 **WHAT YOU'LL LEARN**

### Technical Skills
- ✅ PDF generation in Node.js (PDFKit/Puppeteer)
- ✅ HTML to PDF conversion
- ✅ Template engines (Handlebars/EJS)
- ✅ Multi-language PDF rendering
- ✅ RTL (Right-to-Left) text in PDFs
- ✅ QR code generation
- ✅ Barcode generation
- ✅ PDF optimization and compression
- ✅ Email attachments

### Business Logic
- ✅ Receipt templates (Invoice, Packing List, Delivery Note)
- ✅ Tax calculations and formatting
- ✅ Branding and customization
- ✅ Digital signatures

---

## 🎯 **BUSINESS GOAL**

Generate professional, printable PDF receipts for:
1. **Invoices**: Customer billing documents
2. **Packing Lists**: Items included in order
3. **Delivery Notes**: Proof of delivery
4. **Tax Receipts**: VAT-compliant receipts

**Features:**
- Multi-language (EN/AR) with proper RTL support
- Tenant branding (logo, colors, contact info)
- QR codes for verification
- Email-ready attachments
- Print-optimized layout

---

## 🗄️ **DAY 1: SETUP & LIBRARY SELECTION (2-3 hours)**

### Concept: PDF Generation Approaches

```
Option 1: PDFKit (Node.js library)
✅ Pros: Fast, programmatic, fine control
❌ Cons: Manual layout, complex for RTL

Option 2: Puppeteer (HTML → PDF)
✅ Pros: Use HTML/CSS, easy styling, great RTL support
❌ Cons: Slower, heavier (Chrome headless)

Option 3: jsPDF (Client-side)
✅ Pros: Works in browser
❌ Cons: Limited server-side use

🎯 RECOMMENDED: Puppeteer for CleanMateX
Why? 
- HTML/CSS is easier to style
- Perfect RTL support
- Can reuse web templates
- Worth the performance trade-off
```

### Step 1.1: Install Dependencies

```bash
cd apps/api

# Install Puppeteer (Chrome headless)
npm install puppeteer

# Install template engine
npm install handlebars

# Install QR code generator
npm install qrcode

# Install barcode generator  
npm install jsbarcode canvas

# Types
npm install --save-dev @types/qrcode
```

---

### Step 1.2: Create PDF Service Module

```bash
# Generate NestJS module
nest g module pdf
nest g service pdf
```

---

## 🚀 **DAY 2: PDF GENERATION SERVICE (5-6 hours)**

### Step 2.1: PDF Service Base Class

**File**: `apps/api/src/pdf/pdf.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import puppeteer from 'puppeteer';
import Handlebars from 'handlebars';
import * as QRCode from 'qrcode';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class PdfService {
  private browser: puppeteer.Browser | null = null;

  async onModuleInit() {
    // Initialize browser on startup
    this.browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }

  async onModuleDestroy() {
    // Close browser on shutdown
    if (this.browser) {
      await this.browser.close();
    }
  }

  /**
   * Generate PDF from HTML template
   */
  async generatePdf(
    htmlContent: string,
    options?: {
      format?: 'A4' | 'Letter';
      landscape?: boolean;
      margin?: { top: string; right: string; bottom: string; left: string };
    },
  ): Promise<Buffer> {
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    const page = await this.browser.newPage();

    try {
      // Set content
      await page.setContent(htmlContent, {
        waitUntil: 'networkidle0',
      });

      // Generate PDF
      const pdfBuffer = await page.pdf({
        format: options?.format || 'A4',
        landscape: options?.landscape || false,
        margin: options?.margin || {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm',
        },
        printBackground: true, // Include background colors
      });

      return pdfBuffer;
    } finally {
      await page.close();
    }
  }

  /**
   * Render Handlebars template
   */
  async renderTemplate(templateName: string, data: any): Promise<string> {
    // Load template file
    const templatePath = path.join(
      __dirname,
      '../templates',
      `${templateName}.hbs`,
    );
    const templateContent = await fs.readFile(templatePath, 'utf-8');

    // Compile template
    const template = Handlebars.compile(templateContent);

    // Render with data
    return template(data);
  }

  /**
   * Generate QR code as base64
   */
  async generateQRCode(data: string): Promise<string> {
    return QRCode.toDataURL(data, {
      width: 200,
      margin: 1,
    });
  }

  /**
   * Generate barcode as base64
   */
  async generateBarcode(code: string): Promise<string> {
    // Using jsbarcode with canvas
    const { createCanvas } = require('canvas');
    const JsBarcode = require('jsbarcode');

    const canvas = createCanvas(200, 50);
    JsBarcode(canvas, code, {
      format: 'CODE128',
      displayValue: true,
      fontSize: 14,
    });

    return canvas.toDataURL();
  }
}
```

---

### Step 2.2: Invoice PDF Service

**File**: `apps/api/src/pdf/invoice-pdf.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PdfService } from './pdf.service';

@Injectable()
export class InvoicePdfService {
  constructor(
    private prisma: PrismaService,
    private pdfService: PdfService,
  ) {}

  /**
   * Generate invoice PDF
   */
  async generateInvoicePdf(orderId: string): Promise<Buffer> {
    // Get order with all details
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        items: {
          where: { status: { not: 'CANCELLED' } },
        },
        payments: true,
        tenant: {
          include: {
            branches: {
              where: { isPrimary: true },
            },
          },
        },
      },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    // Generate QR code (order verification)
    const qrCodeData = JSON.stringify({
      orderNumber: order.orderNumber,
      total: order.total,
      date: order.createdAt,
    });
    const qrCode = await this.pdfService.generateQRCode(qrCodeData);

    // Prepare template data
    const templateData = {
      // Tenant/Company info
      company: {
        name: order.tenant.name,
        name2: order.tenant.name2,
        logo: order.tenant.logoUrl,
        address: order.tenant.branches[0]?.address,
        phone: order.tenant.branches[0]?.phone,
        email: order.tenant.email,
        vatNumber: order.tenant.vatNumber,
      },

      // Invoice details
      invoice: {
        number: order.orderNumber,
        date: this.formatDate(order.createdAt),
        dueDate: this.formatDate(order.readyBy),
        status: order.status,
      },

      // Customer details
      customer: {
        name: order.customer.name,
        phone: order.customer.phone,
        email: order.customer.email,
        address: order.customer.addresses?.[0],
      },

      // Line items
      items: order.items.map(item => ({
        name: item.itemName,
        name2: item.itemName2,
        service: item.service,
        quantity: item.quantity,
        unitPrice: this.formatCurrency(item.unitPrice, order.currency),
        total: this.formatCurrency(item.total, order.currency),
      })),

      // Totals
      subtotal: this.formatCurrency(order.subtotal, order.currency),
      tax: this.formatCurrency(order.tax, order.currency),
      discount: order.discount > 0 ? this.formatCurrency(order.discount, order.currency) : null,
      total: this.formatCurrency(order.total, order.currency),
      currency: order.currency,

      // Payments
      payments: order.payments.map(p => ({
        method: p.method,
        amount: this.formatCurrency(p.amount, order.currency),
        date: this.formatDate(p.paidAt),
      })),
      
      balance: this.formatCurrency(
        Number(order.total) - order.payments.reduce((sum, p) => sum + Number(p.amount), 0),
        order.currency,
      ),

      // QR code
      qrCode,

      // Footer
      footer: {
        notes: 'Thank you for your business!',
        notes2: 'شكراً لك على التعامل معنا',
      },
    };

    // Render template
    const html = await this.pdfService.renderTemplate('invoice', templateData);

    // Generate PDF
    return this.pdfService.generatePdf(html);
  }

  private formatDate(date: Date | null): string {
    if (!date) return '-';
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(date));
  }

  private formatCurrency(amount: number | string, currency: string): string {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(Number(amount));
  }
}
```

---

## 🎨 **DAY 3: PDF TEMPLATES (4-5 hours)**

### Step 3.1: Invoice Template

**File**: `apps/api/src/templates/invoice.hbs`

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Arial', sans-serif;
      font-size: 12px;
      line-height: 1.6;
      color: #333;
    }

    /* Arabic font support */
    .arabic {
      font-family: 'Arial', 'Helvetica', sans-serif;
      direction: rtl;
      text-align: right;
    }

    .container {
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }

    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: start;
      margin-bottom: 30px;
      border-bottom: 2px solid #3B82F6;
      padding-bottom: 20px;
    }

    .company-info {
      flex: 1;
    }

    .company-logo {
      max-width: 150px;
      max-height: 80px;
      margin-bottom: 10px;
    }

    .company-name {
      font-size: 24px;
      font-weight: bold;
      color: #3B82F6;
      margin-bottom: 5px;
    }

    .company-details {
      font-size: 10px;
      color: #666;
    }

    .invoice-info {
      text-align: right;
      background: #F3F4F6;
      padding: 15px;
      border-radius: 8px;
    }

    .invoice-title {
      font-size: 28px;
      font-weight: bold;
      color: #3B82F6;
      margin-bottom: 10px;
    }

    .invoice-number {
      font-size: 14px;
      font-weight: bold;
      margin: 5px 0;
    }

    /* Billing section */
    .billing-section {
      display: flex;
      justify-content: space-between;
      margin: 30px 0;
    }

    .bill-to, .invoice-details {
      flex: 1;
      background: #F9FAFB;
      padding: 15px;
      border-radius: 8px;
      margin-right: 10px;
    }

    .bill-to:last-child {
      margin-right: 0;
    }

    .section-title {
      font-size: 12px;
      font-weight: bold;
      color: #6B7280;
      text-transform: uppercase;
      margin-bottom: 10px;
    }

    /* Items table */
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }

    .items-table thead {
      background: #3B82F6;
      color: white;
    }

    .items-table th {
      padding: 12px;
      text-align: left;
      font-weight: 600;
      font-size: 11px;
    }

    .items-table td {
      padding: 10px 12px;
      border-bottom: 1px solid #E5E7EB;
    }

    .items-table tbody tr:hover {
      background: #F9FAFB;
    }

    .text-right {
      text-align: right;
    }

    .text-center {
      text-align: center;
    }

    /* Totals */
    .totals-section {
      display: flex;
      justify-content: flex-end;
      margin-top: 30px;
    }

    .totals-table {
      width: 300px;
    }

    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #E5E7EB;
    }

    .totals-row.total {
      background: #3B82F6;
      color: white;
      font-size: 16px;
      font-weight: bold;
      padding: 12px;
      border-radius: 8px;
      margin-top: 10px;
    }

    /* QR Code */
    .qr-section {
      text-align: center;
      margin: 30px 0;
    }

    .qr-code {
      max-width: 150px;
    }

    /* Footer */
    .footer {
      margin-top: 50px;
      padding-top: 20px;
      border-top: 1px solid #E5E7EB;
      text-align: center;
      font-size: 10px;
      color: #6B7280;
    }

    .footer-bilingual {
      margin-top: 10px;
    }

    .footer-bilingual .arabic {
      margin-top: 5px;
    }

    /* Status badge */
    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
    }

    .status-paid {
      background: #10B981;
      color: white;
    }

    .status-pending {
      background: #F59E0B;
      color: white;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <div class="company-info">
        {{#if company.logo}}
          <img src="{{company.logo}}" alt="Logo" class="company-logo">
        {{/if}}
        <div class="company-name">{{company.name}}</div>
        <div class="company-name arabic">{{company.name2}}</div>
        <div class="company-details">
          {{company.address}}<br>
          {{company.phone}} | {{company.email}}<br>
          VAT: {{company.vatNumber}}
        </div>
      </div>

      <div class="invoice-info">
        <div class="invoice-title">INVOICE</div>
        <div class="invoice-title arabic">فاتورة</div>
        <div class="invoice-number">#{{invoice.number}}</div>
        <div>Date: {{invoice.date}}</div>
        <div>Due: {{invoice.dueDate}}</div>
        <div>
          <span class="status-badge status-{{invoice.status}}">
            {{invoice.status}}
          </span>
        </div>
      </div>
    </div>

    <!-- Billing section -->
    <div class="billing-section">
      <div class="bill-to">
        <div class="section-title">Bill To</div>
        <div><strong>{{customer.name}}</strong></div>
        <div>{{customer.phone}}</div>
        {{#if customer.email}}
          <div>{{customer.email}}</div>
        {{/if}}
        {{#if customer.address}}
          <div style="margin-top: 5px;">{{customer.address}}</div>
        {{/if}}
      </div>
    </div>

    <!-- Items table -->
    <table class="items-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Item / Service</th>
          <th class="text-center">Qty</th>
          <th class="text-right">Unit Price</th>
          <th class="text-right">Total</th>
        </tr>
      </thead>
      <tbody>
        {{#each items}}
          <tr>
            <td>{{@index}}</td>
            <td>
              <div>{{this.name}}</div>
              <div class="arabic" style="font-size: 10px; color: #6B7280;">{{this.name2}}</div>
              <div style="font-size: 10px; color: #6B7280;">{{this.service}}</div>
            </td>
            <td class="text-center">{{this.quantity}}</td>
            <td class="text-right">{{this.unitPrice}}</td>
            <td class="text-right"><strong>{{this.total}}</strong></td>
          </tr>
        {{/each}}
      </tbody>
    </table>

    <!-- Totals -->
    <div class="totals-section">
      <div class="totals-table">
        <div class="totals-row">
          <span>Subtotal:</span>
          <span>{{subtotal}}</span>
        </div>
        {{#if discount}}
          <div class="totals-row">
            <span>Discount:</span>
            <span style="color: #EF4444;">-{{discount}}</span>
          </div>
        {{/if}}
        <div class="totals-row">
          <span>VAT (5%):</span>
          <span>{{tax}}</span>
        </div>
        <div class="totals-row total">
          <span>TOTAL:</span>
          <span>{{total}}</span>
        </div>
      </div>
    </div>

    <!-- QR Code -->
    <div class="qr-section">
      <img src="{{qrCode}}" alt="QR Code" class="qr-code">
      <div style="margin-top: 10px; font-size: 10px; color: #6B7280;">
        Scan to verify invoice
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <div class="footer-bilingual">
        <div>{{footer.notes}}</div>
        <div class="arabic">{{footer.notes2}}</div>
      </div>
      <div style="margin-top: 20px;">
        This is a computer-generated invoice and does not require a signature.
      </div>
    </div>
  </div>
</body>
</html>
```

---

## 🔌 **DAY 4: API INTEGRATION & DELIVERY (3-4 hours)**

### Step 4.1: PDF Controller

**File**: `apps/api/src/pdf/pdf.controller.ts`

```typescript
import {
  Controller,
  Get,
  Param,
  Res,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InvoicePdfService } from './invoice-pdf.service';

@ApiTags('PDF')
@Controller('api/v1/pdf')
@UseGuards(JwtAuthGuard)
export class PdfController {
  constructor(private invoicePdfService: InvoicePdfService) {}

  @Get('invoice/:orderId')
  @ApiOperation({ summary: 'Generate invoice PDF' })
  async getInvoicePdf(
    @Param('orderId') orderId: string,
    @Res() res: Response,
  ) {
    // Generate PDF
    const pdfBuffer = await this.invoicePdfService.generateInvoicePdf(orderId);

    // Set headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=invoice-${orderId}.pdf`,
    );
    res.setHeader('Content-Length', pdfBuffer.length);

    // Send PDF
    res.status(HttpStatus.OK).send(pdfBuffer);
  }

  @Get('invoice/:orderId/preview')
  @ApiOperation({ summary: 'Preview invoice PDF in browser' })
  async previewInvoicePdf(
    @Param('orderId') orderId: string,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.invoicePdfService.generateInvoicePdf(orderId);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline'); // Show in browser
    res.status(HttpStatus.OK).send(pdfBuffer);
  }
}
```

---

### Step 4.2: Email PDF Attachment

**File**: `apps/api/src/email/email.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { InvoicePdfService } from '../pdf/invoice-pdf.service';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(private invoicePdfService: InvoicePdfService) {
    // Initialize email transporter (SendGrid/Mailgun)
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendInvoiceEmail(orderId: string, customerEmail: string) {
    // Generate PDF
    const pdfBuffer = await this.invoicePdfService.generateInvoicePdf(orderId);

    // Send email
    await this.transporter.sendMail({
      from: process.env.SENDER_EMAIL,
      to: customerEmail,
      subject: `Invoice #${orderId}`,
      html: `
        <h2>Your Invoice</h2>
        <p>Thank you for your business. Please find your invoice attached.</p>
      `,
      attachments: [
        {
          filename: `invoice-${orderId}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });
  }
}
```

---

## ✅ **COMPLETION CHECKLIST**

- [x] Puppeteer setup
- [x] PDF generation service
- [x] Invoice template (HTML/CSS)
- [x] RTL support for Arabic
- [x] QR code generation
- [x] Multi-language formatting
- [x] Download/preview endpoints
- [x] Email attachment support

---

**Congratulations!** 🎉 Professional PDF receipts ready!

**Next**: [PRD-012: Payments Implementation →](./PRD_012_Payments_Implementation.md)
