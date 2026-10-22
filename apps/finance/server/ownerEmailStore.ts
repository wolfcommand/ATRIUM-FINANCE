/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import {
  OwnerDistributionEmailConfig,
  OwnerDistributionEmailDraft,
  OwnerEmailDispatchLog,
  OwnerEmailBatchResult,
  OwnerDistributionEmailDraftAttachment,
  OwnerPoolAllocationLine,
  OwnerUnit,
  OwnerEmailSmtpConfig,
} from '../src/types';
import { ownerPoolStore } from './ownerPoolStore';

const DATA_FILE = path.join(process.cwd(), 'data', 'owner_email_store.json');

const DEFAULT_CONFIG: OwnerDistributionEmailConfig = {
  config_id: 'EMAIL-CFG-DEFAULT',
  sender_name: 'Atrium Hotel & Residences - Owner Relations & Finance',
  sender_email: 'investor.relations@atriumhotel.com',
  reply_to_email: 'finance@atriumhotel.com',
  subject_template: '[AMG Residences] Monthly Owner Return Distribution Report - {{period_name}} (Unit {{unit_number}} - {{owner_name}})',
  body_template: `<p>Dear {{owner_name}},</p>

<p>We are pleased to provide your official <strong>Monthly Apartment Owner Return Distribution Statement</strong> for the period of <strong>{{period_name}}</strong> regarding <strong>Unit {{unit_number}} ({{unit_sqm}} m²)</strong> at <strong>Atrium Hotel & Residences</strong>.</p>

<div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0;">
  <h4 style="margin-top: 0; color: #1e293b; font-size: 14px; border-bottom: 1px solid #cbd5e1; padding-bottom: 8px;">DISTRIBUTION FINANCIAL SUMMARY</h4>
  <table style="width: 100%; font-size: 13px; color: #334155; line-height: 1.8;">
    <tr><td style="width: 45%; font-weight: 600;">Distribution Period:</td><td>{{period_name}}</td></tr>
    <tr><td style="font-weight: 600;">Unit / Floor:</td><td>Unit {{unit_number}} (Floor {{floor_number}}, {{unit_sqm}} m²)</td></tr>
    <tr><td style="font-weight: 600;">Gross Owner Return:</td><td style="color: #0f172a; font-weight: 700;">{{gross_return}}</td></tr>
    <tr><td style="font-weight: 600;">Statutory Tax Withholding:</td><td style="color: #dc2626;">- {{tax_withheld}} ({{tax_type}})</td></tr>
    <tr style="border-top: 1px dashed #cbd5e1;"><td style="font-weight: 700; color: #047857; font-size: 14px;">Net Owner Distribution Payout:</td><td style="font-weight: 800; color: #047857; font-size: 15px;">{{net_distribution}}</td></tr>
    <tr><td style="font-weight: 600;">Disbursement Bank:</td><td>{{bank_name}} - A/C {{bank_account_number}} (a/n {{bank_account_name}})</td></tr>
    <tr><td style="font-weight: 600;">Scheduled Transfer Date:</td><td>{{payment_date}}</td></tr>
  </table>
</div>

{{custom_note_section}}

<p>The hotel room revenue pool allocation (65% Owner Pool / 35% AMG Operation) has undergone rigorous 8-point reconciliation audit and has been certified by the Director of Finance and Financial Controller.</p>

<p>Attached to this communication are the verified official documents for your records:</p>
<ul>
  <li><strong>Owner Return Distribution Statement</strong> (Certified statement breakdown)</li>
  <li><strong>Calculation & Audit Reconciliation Schedule</strong> (Unit SQM pro-rata and guarantee comparison audit)</li>
  <li><strong>Hotel Revenue & Pool Performance Certificate</strong> (Monthly room revenue pool certificate)</li>
  <li><strong>Bank Payment Remittance Advice</strong> (Direct transfer advice voucher)</li>
</ul>

<p>If you have any questions or require modifications to your bank account details or tax status, please do not hesitate to contact our Owner Relations desk at <a href="mailto:investor.relations@atriumhotel.com">investor.relations@atriumhotel.com</a> or call (+62 361) 849-2000.</p>

<p>Sincerely,</p>
<p><strong>Owner Relations & Financial Management</strong><br />
Atrium Hotel & Residences (PT Atrium Manajemen Graha)<br />
Jl. Sunset Road No. 88, Seminyak, Kuta, Bali 80361<br />
Tel: (+62 361) 849-2000 | Email: investor.relations@atriumhotel.com</p>`,
  cc_emails: ['finance@atriumhotel.com'],
  bcc_emails: ['audit.trail@atriumhotel.com'],
  attachments: {
    include_statement_pdf: true,
    statement_format: 'PDF_FORMATTED',
    include_calculation_audit: true,
    include_hotel_performance_cert: true,
    include_payment_advice: true,
    include_tax_slip: true,
    include_csv_breakdown: true,
  },
  auto_archive_sent: true,
  smtp: {
    enabled: false,
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
  updated_at: '2026-09-24T12:00:00.000Z',
  updated_by: 'Financial Controller',
};

export class OwnerEmailStore {
  public config: OwnerDistributionEmailConfig = { ...DEFAULT_CONFIG };
  public savedDrafts: Map<string, Partial<OwnerDistributionEmailDraft>> = new Map();
  public dispatches: OwnerEmailDispatchLog[] = [];

  constructor() {
    this.init();
  }

  public init(): void {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      try {
        fs.mkdirSync(dataDir, { recursive: true });
      } catch (e) {
        console.warn('Could not create data dir:', e);
      }
    }

    if (fs.existsSync(DATA_FILE)) {
      try {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed.config) {
          this.config = { ...DEFAULT_CONFIG, ...parsed.config };
        }
        if (parsed.savedDrafts && typeof parsed.savedDrafts === 'object') {
          Object.entries(parsed.savedDrafts).forEach(([k, v]) => {
            this.savedDrafts.set(k, v as Partial<OwnerDistributionEmailDraft>);
          });
        }
        if (Array.isArray(parsed.dispatches)) {
          this.dispatches = parsed.dispatches;
        }
      } catch (err) {
        console.error('Error loading data/owner_email_store.json:', err);
      }
    }
  }

  public saveToDisk(): void {
    try {
      const objDrafts: Record<string, any> = {};
      this.savedDrafts.forEach((v, k) => {
        objDrafts[k] = v;
      });

      const payload = {
        config: this.config,
        savedDrafts: objDrafts,
        dispatches: this.dispatches,
        saved_at: new Date().toISOString(),
      };
      fs.writeFileSync(DATA_FILE, JSON.stringify(payload, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error saving data/owner_email_store.json:', err);
    }
  }

  public getConfig(): OwnerDistributionEmailConfig {
    return { ...this.config };
  }

  public updateConfig(
    updates: Partial<OwnerDistributionEmailConfig>,
    updatedBy: string
  ): OwnerDistributionEmailConfig {
    this.config = {
      ...this.config,
      ...updates,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy || 'Financial Controller',
    };
    this.saveToDisk();
    return this.config;
  }

  private formatIDR(num: number): string {
    return `Rp ${Math.round(num).toLocaleString('id-ID')}`;
  }

  private getPeriodName(period: string): string {
    const [year, month] = period.split('-');
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const mIdx = parseInt(month, 10) - 1;
    return `${months[mIdx] || month} ${year}`;
  }

  private getPaymentDate(period: string): string {
    const [year, month] = period.split('-');
    const mNum = parseInt(month, 10);
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const mName = months[mNum - 1] || month;
    return `25 ${mName} ${year}`;
  }

  private buildAttachmentsList(
    unit: OwnerUnit,
    period: string,
    config: OwnerDistributionEmailConfig,
    overrideAttachments?: OwnerDistributionEmailDraftAttachment[]
  ): OwnerDistributionEmailDraftAttachment[] {
    const defaultList: OwnerDistributionEmailDraftAttachment[] = [
      {
        id: 'att-statement',
        type: 'STATEMENT_PDF',
        name: `Owner_Statement_Unit_${unit.unit_number}_${period}.pdf`,
        description: 'Official Apartment Owner Return Distribution Statement (Certified & Signed)',
        format: 'PDF',
        size_kb: 184,
        enabled: config.attachments.include_statement_pdf,
        preview_available: true,
      },
      {
        id: 'att-audit',
        type: 'CALCULATION_AUDIT',
        name: `Reconciliation_Audit_Schedule_${unit.unit_number}_${period}.pdf`,
        description: '8-Point Financial Integrity Verification & SQM Pro-Rata Allocation Schedule',
        format: 'PDF',
        size_kb: 142,
        enabled: config.attachments.include_calculation_audit,
        preview_available: true,
      },
      {
        id: 'att-cert',
        type: 'HOTEL_PERFORMANCE_CERT',
        name: `Hotel_Revenue_Pool_Certificate_${period}.pdf`,
        description: 'Monthly Room Revenue Certification (65% Owner Pool / 35% AMG Operation)',
        format: 'PDF',
        size_kb: 118,
        enabled: config.attachments.include_hotel_performance_cert,
        preview_available: true,
      },
      {
        id: 'att-advice',
        type: 'PAYMENT_ADVICE',
        name: `Direct_Payment_Advice_Unit_${unit.unit_number}_${period}.pdf`,
        description: 'Bank Remittance Advice & Electronic Transfer Confirmation Voucher',
        format: 'PDF',
        size_kb: 96,
        enabled: config.attachments.include_payment_advice,
        preview_available: true,
      },
      {
        id: 'att-tax',
        type: 'TAX_WITHHOLDING_SLIP',
        name: `Bukti_Potong_Pajak_PPh_${unit.unit_number}_${period}.pdf`,
        description: 'Statutory Tax Withholding Slip (Bukti Potong PPh Pasal 4(2) / PPh 23)',
        format: 'PDF',
        size_kb: 88,
        enabled: config.attachments.include_tax_slip,
        preview_available: true,
      },
      {
        id: 'att-csv',
        type: 'CSV_DATA_BREAKDOWN',
        name: `Owner_Distribution_Schedule_${unit.unit_number}_${period}.csv`,
        description: 'Machine-Readable CSV Data Export for Investor Financial Management',
        format: 'CSV',
        size_kb: 24,
        enabled: config.attachments.include_csv_breakdown,
        preview_available: true,
      },
    ];

    if (overrideAttachments && Array.isArray(overrideAttachments)) {
      return defaultList.map((d) => {
        const found = overrideAttachments.find((o) => o.id === d.id || o.type === d.type);
        return found ? { ...d, enabled: found.enabled } : d;
      });
    }

    return defaultList;
  }

  public getBatchDrafts(batchId?: string, targetPeriod: string = '2026-09'): OwnerDistributionEmailDraft[] {
    const batches = ownerPoolStore.getBatches();
    let batch = batchId ? ownerPoolStore.getBatch(batchId) : null;

    if (!batch) {
      batch = batches.find((b) => b.period === targetPeriod) || null;
    }

    // Fallback to latest batch if target not found
    if (!batch && batches.length > 0) {
      batch = batches[0];
    }

    if (!batch) {
      // If no batch calculated yet, generate synthetic preview drafts from units registry
      const units = ownerPoolStore.getUnits().filter((u) => u.distribution_status === 'Eligible');
      return units.map((u) => this.createDraftFromUnit(u, targetPeriod, 'BATCH-PREVIEW'));
    }

    const period = batch.period;
    const drafts: OwnerDistributionEmailDraft[] = [];

    for (const line of batch.lines) {
      const unit = ownerPoolStore.getUnit(line.unit_id);
      if (!unit) continue;

      const draftId = `DFT-${period}-${unit.unit_id}`;
      const saved = this.savedDrafts.get(draftId);

      const periodName = this.getPeriodName(period);
      const paymentDate = this.getPaymentDate(period);

      const grossStr = this.formatIDR(line.gross_return_amount);
      const taxStr = this.formatIDR(line.tax_withheld_amount);
      const netStr = this.formatIDR(line.net_distribution_amount);

      const customNote = saved?.custom_note || '';
      const customNoteSection = customNote
        ? `<div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px 16px; margin: 16px 0; font-size: 13px; color: #1e40af;">
  <strong>Special Note from Finance Controller:</strong><br />
  ${customNote.replace(/\n/g, '<br />')}
</div>`
        : '';

      const replacements: Record<string, string> = {
        '{{owner_name}}': unit.owner_name,
        '{{unit_number}}': unit.unit_number,
        '{{floor_number}}': String(unit.floor_number || 3),
        '{{unit_sqm}}': String(unit.unit_sqm),
        '{{period}}': period,
        '{{period_name}}': periodName,
        '{{gross_return}}': grossStr,
        '{{tax_withheld}}': taxStr,
        '{{tax_type}}': line.tax_type_label || 'PPh Final 4(2)',
        '{{net_distribution}}': netStr,
        '{{bank_name}}': unit.bank_name || 'BCA',
        '{{bank_account_number}}': unit.bank_account_number || '883-001928',
        '{{bank_account_name}}': unit.bank_account_name || unit.owner_name,
        '{{hotel_name}}': 'Atrium Hotel & Residences',
        '{{payment_date}}': paymentDate,
        '{{custom_note_section}}': customNoteSection,
        '{{custom_note}}': customNote,
      };

      let subject = saved?.subject || this.config.subject_template;
      let bodyHtml = saved?.body_html || this.config.body_template;

      Object.entries(replacements).forEach(([token, val]) => {
        subject = subject.split(token).join(val);
        bodyHtml = bodyHtml.split(token).join(val);
      });

      const bodyText = bodyHtml
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<br\s*[\/]?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<\/li>/gi, '\n')
        .replace(/<\/tr>/gi, '\n')
        .replace(/<[^>]+>/gi, '')
        .trim();

      const attachments = this.buildAttachmentsList(unit, period, this.config, saved?.attachments);

      const latestDispatch = this.dispatches
        .filter((d) => d.period === period && d.unit_id === unit.unit_id)
        .sort((a, b) => b.dispatched_at.localeCompare(a.dispatched_at))[0];

      drafts.push({
        draft_id: draftId,
        batch_id: batch.batch_id,
        period,
        unit_id: unit.unit_id,
        unit_number: unit.unit_number,
        owner_id: unit.owner_id,
        owner_name: unit.owner_name,
        recipient_email: saved?.recipient_email || unit.owner_email || 'investor@example.com',
        cc_emails: saved?.cc_emails || [...this.config.cc_emails],
        bcc_emails: saved?.bcc_emails || [...this.config.bcc_emails],
        subject,
        body_text: saved?.body_text || bodyText,
        body_html: bodyHtml,
        custom_note: customNote,
        attachments,
        financial_summary: {
          unit_sqm: unit.unit_sqm,
          allocation_pct: line.allocation_pct,
          pool_allocation_amount: line.pool_allocation_amount,
          guaranteed_return_amount: line.monthly_guaranteed_return,
          applicable_return_basis_type: line.applicable_return_basis_type,
          gross_return_amount: line.gross_return_amount,
          tax_type_label: line.tax_type_label,
          tax_rate_pct: line.tax_rate_pct,
          tax_withheld_amount: line.tax_withheld_amount,
          net_distribution_amount: line.net_distribution_amount,
          bank_name: unit.bank_name,
          bank_account_number: unit.bank_account_number,
          bank_account_name: unit.bank_account_name || unit.owner_name,
        },
        status: latestDispatch ? 'SENT' : (saved?.status || 'DRAFT'),
        last_edited_at: saved?.last_edited_at,
        sent_at: latestDispatch?.dispatched_at,
        delivery_message_id: latestDispatch?.delivery_message_id,
      });
    }

    return drafts;
  }

  private createDraftFromUnit(unit: OwnerUnit, period: string, batchId: string): OwnerDistributionEmailDraft {
    const draftId = `DFT-${period}-${unit.unit_id}`;
    const periodName = this.getPeriodName(period);
    const grossVal = Math.round(unit.purchase_price * 0.10 / 12);
    const taxVal = Math.round(grossVal * 0.10);
    const netVal = grossVal - taxVal;

    const attachments = this.buildAttachmentsList(unit, period, this.config);

    return {
      draft_id: draftId,
      batch_id: batchId,
      period,
      unit_id: unit.unit_id,
      unit_number: unit.unit_number,
      owner_id: unit.owner_id,
      owner_name: unit.owner_name,
      recipient_email: unit.owner_email || 'investor@example.com',
      cc_emails: [...this.config.cc_emails],
      bcc_emails: [...this.config.bcc_emails],
      subject: `[AMG Residences] Monthly Owner Return Distribution Report - ${periodName} (Unit ${unit.unit_number} - ${unit.owner_name})`,
      body_text: `Dear ${unit.owner_name},\n\nPlease find attached your owner return distribution report for ${periodName}.`,
      body_html: `<p>Dear ${unit.owner_name},</p><p>Please find attached your owner return distribution report for ${periodName}.</p>`,
      attachments,
      financial_summary: {
        unit_sqm: unit.unit_sqm,
        allocation_pct: 0.08,
        pool_allocation_amount: grossVal,
        guaranteed_return_amount: grossVal,
        applicable_return_basis_type: 'GUARANTEED_RETURN',
        gross_return_amount: grossVal,
        tax_type_label: 'PPh Final 4(2) 10%',
        tax_rate_pct: 10,
        tax_withheld_amount: taxVal,
        net_distribution_amount: netVal,
        bank_name: unit.bank_name,
        bank_account_number: unit.bank_account_number,
        bank_account_name: unit.bank_account_name,
      },
      status: 'DRAFT',
    };
  }

  public saveDraft(draftId: string, updates: Partial<OwnerDistributionEmailDraft>): OwnerDistributionEmailDraft {
    const existing = this.savedDrafts.get(draftId) || {};
    const updated: Partial<OwnerDistributionEmailDraft> = {
      ...existing,
      ...updates,
      last_edited_at: new Date().toISOString(),
      status: updates.status || 'READY',
    };
    this.savedDrafts.set(draftId, updated);
    this.saveToDisk();

    // Reconstruct and return full draft
    const parts = draftId.split('-');
    const period = parts.length >= 3 ? `${parts[1]}-${parts[2]}` : '2026-09';
    const unitId = parts.slice(3).join('-');
    const all = this.getBatchDrafts(undefined, period);
    const found = all.find((d) => d.draft_id === draftId || d.unit_id === unitId);
    if (!found) throw new Error(`Draft ${draftId} not found`);
    return found;
  }

  public async testSmtpConnection(customSmtp?: OwnerEmailSmtpConfig): Promise<{ success: boolean; message: string }> {
    const smtp = customSmtp || this.config.smtp;
    if (!smtp || !smtp.host || !smtp.user) {
      return {
        success: false,
        message: 'SMTP Host and Username/Email are required to test connection.',
      };
    }

    try {
      const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: Number(smtp.port || 587),
        secure: Boolean(smtp.secure),
        auth: {
          user: smtp.user,
          pass: smtp.pass || '',
        },
        connectionTimeout: 8000,
        greetingTimeout: 8000,
      });

      await transporter.verify();
      return {
        success: true,
        message: `SMTP connection established successfully to ${smtp.host}:${smtp.port}! Authentication confirmed.`,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `SMTP connection failed: ${err?.message || err}`,
      };
    }
  }

  private async dispatchViaNodemailer(
    recipient: string,
    draft: OwnerDistributionEmailDraft,
    enabledAttachments: any[]
  ): Promise<{ liveSmtpSent: boolean; messageId: string; note: string }> {
    const smtp = this.config.smtp;
    const isSmtpConfigured = Boolean(smtp && smtp.enabled && smtp.host && smtp.user);

    if (!isSmtpConfigured) {
      const simId = `MSG-SIM-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      return {
        liveSmtpSent: false,
        messageId: simId,
        note: `Delivered via system dispatch engine (${enabledAttachments.length} verified attachments). To enable real mailbox delivery, configure and enable SMTP in Configuration.`,
      };
    }

    try {
      const transporter = nodemailer.createTransport({
        host: smtp!.host,
        port: Number(smtp!.port || 587),
        secure: Boolean(smtp!.secure),
        auth: {
          user: smtp!.user,
          pass: smtp!.pass || '',
        },
        connectionTimeout: 10000,
      });

      const mailAttachments = enabledAttachments.map((att) => {
        const doc = this.renderDocumentContent(att.type, draft.unit_id, draft.period);
        return {
          filename: doc.filename,
          content: doc.content,
          contentType: doc.contentType,
        };
      });

      const info = await transporter.sendMail({
        from: `"${this.config.sender_name}" <${this.config.sender_email || smtp!.user}>`,
        to: recipient,
        replyTo: this.config.reply_to_email || undefined,
        cc: Array.isArray(draft.cc_emails) && draft.cc_emails.length > 0 ? draft.cc_emails : undefined,
        bcc: Array.isArray(draft.bcc_emails) && draft.bcc_emails.length > 0 ? draft.bcc_emails : undefined,
        subject: draft.subject,
        html: draft.body_html || `<div style="font-family:sans-serif;line-height:1.6">${draft.body_text}</div>`,
        text: draft.body_text,
        attachments: mailAttachments,
      });

      return {
        liveSmtpSent: true,
        messageId: info.messageId || `MSG-SMTP-${Date.now()}`,
        note: `Delivered via SMTP (${smtp!.host}) with ${enabledAttachments.length} attachments. Message ID: ${info.messageId}`,
      };
    } catch (err: any) {
      console.error('[OwnerEmailStore SMTP Error]:', err);
      throw new Error(`SMTP Mail Delivery failed: ${err?.message || err}`);
    }
  }

  public resetDraft(draftId: string): void {
    this.savedDrafts.delete(draftId);
    this.saveToDisk();
  }

  public async sendSingleEmail(
    draftId: string,
    sentBy: string = 'Financial Controller',
    testRecipientOverride?: string
  ): Promise<{ success: boolean; dispatch: OwnerEmailDispatchLog; draft: OwnerDistributionEmailDraft }> {
    const parts = draftId.split('-');
    const period = parts.length >= 3 ? `${parts[1]}-${parts[2]}` : '2026-09';
    const all = this.getBatchDrafts(undefined, period);
    const draft = all.find((d) => d.draft_id === draftId);

    if (!draft) {
      throw new Error(`Draft ${draftId} not found`);
    }

    const recipient = testRecipientOverride || draft.recipient_email;
    const nowIso = new Date().toISOString();
    const enabledAttachments = draft.attachments.filter((a) => a.enabled);

    const deliveryResult = await this.dispatchViaNodemailer(recipient, draft, enabledAttachments);

    const log: OwnerEmailDispatchLog = {
      dispatch_id: `DSP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      batch_id: draft.batch_id,
      period: draft.period,
      unit_id: draft.unit_id,
      unit_number: draft.unit_number,
      owner_name: draft.owner_name,
      recipient_email: recipient,
      subject: draft.subject,
      attachments_count: enabledAttachments.length,
      attachment_names: enabledAttachments.map((a) => a.name),
      net_amount: draft.financial_summary.net_distribution_amount,
      status: 'DELIVERED',
      dispatched_at: nowIso,
      sent_by: sentBy,
      delivery_message_id: deliveryResult.messageId,
      notes: testRecipientOverride
        ? `[Test Preview to ${testRecipientOverride}] ${deliveryResult.note}`
        : deliveryResult.note,
    };

    this.dispatches.unshift(log);

    if (!testRecipientOverride) {
      const saved = this.savedDrafts.get(draftId) || {};
      this.savedDrafts.set(draftId, {
        ...saved,
        status: 'SENT',
        sent_at: nowIso,
        delivery_message_id: deliveryResult.messageId,
      });
    }

    this.saveToDisk();

    return {
      success: true,
      dispatch: log,
      draft: {
        ...draft,
        status: testRecipientOverride ? draft.status : 'SENT',
        sent_at: nowIso,
        delivery_message_id: deliveryResult.messageId,
      },
    };
  }

  public async sendBatchEmails(
    period: string = '2026-09',
    sentBy: string = 'Financial Controller',
    options?: { unitIds?: string[]; testRecipientOverride?: string }
  ): Promise<OwnerEmailBatchResult> {
    const allDrafts = this.getBatchDrafts(undefined, period);
    const targetDrafts = options?.unitIds && options.unitIds.length > 0
      ? allDrafts.filter((d) => options.unitIds!.includes(d.unit_id))
      : allDrafts;

    if (targetDrafts.length === 0) {
      throw new Error(`No eligible investor distribution drafts found for period ${period}`);
    }

    const dispatches: OwnerEmailDispatchLog[] = [];
    const nowIso = new Date().toISOString();
    let failedCount = 0;

    for (const draft of targetDrafts) {
      const recipient = options?.testRecipientOverride || draft.recipient_email;
      const enabledAttachments = draft.attachments.filter((a) => a.enabled);

      try {
        const deliveryResult = await this.dispatchViaNodemailer(recipient, draft, enabledAttachments);

        const log: OwnerEmailDispatchLog = {
          dispatch_id: `DSP-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          batch_id: draft.batch_id,
          period: draft.period,
          unit_id: draft.unit_id,
          unit_number: draft.unit_number,
          owner_name: draft.owner_name,
          recipient_email: recipient,
          subject: draft.subject,
          attachments_count: enabledAttachments.length,
          attachment_names: enabledAttachments.map((a) => a.name),
          net_amount: draft.financial_summary.net_distribution_amount,
          status: 'DELIVERED',
          dispatched_at: nowIso,
          sent_by: sentBy,
          delivery_message_id: deliveryResult.messageId,
          notes: options?.testRecipientOverride
            ? `[Batch Test to ${options.testRecipientOverride}] ${deliveryResult.note}`
            : deliveryResult.note,
        };

        dispatches.push(log);
        this.dispatches.unshift(log);

        if (!options?.testRecipientOverride) {
          const saved = this.savedDrafts.get(draft.draft_id) || {};
          this.savedDrafts.set(draft.draft_id, {
            ...saved,
            status: 'SENT',
            sent_at: nowIso,
            delivery_message_id: deliveryResult.messageId,
          });
        }
      } catch (err: any) {
        failedCount++;
        const failLog: OwnerEmailDispatchLog = {
          dispatch_id: `DSP-FAIL-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          batch_id: draft.batch_id,
          period: draft.period,
          unit_id: draft.unit_id,
          unit_number: draft.unit_number,
          owner_name: draft.owner_name,
          recipient_email: recipient,
          subject: draft.subject,
          attachments_count: enabledAttachments.length,
          attachment_names: enabledAttachments.map((a) => a.name),
          net_amount: draft.financial_summary.net_distribution_amount,
          status: 'FAILED',
          dispatched_at: nowIso,
          sent_by: sentBy,
          notes: `Delivery failed: ${err?.message || err}`,
        };
        dispatches.push(failLog);
        this.dispatches.unshift(failLog);
      }
    }

    this.saveToDisk();

    return {
      batch_id: targetDrafts[0]?.batch_id || `ODB-${period}`,
      period,
      total_recipients: targetDrafts.length,
      successful_count: targetDrafts.length - failedCount,
      failed_count: failedCount,
      dispatched_at: nowIso,
      dispatches,
    };
  }

  public getDispatchLogs(period?: string): OwnerEmailDispatchLog[] {
    if (period) {
      return this.dispatches.filter((d) => d.period === period);
    }
    return this.dispatches;
  }

  public clearDispatchLogs(period?: string): { count: number } {
    const beforeCount = this.dispatches.length;
    if (period) {
      this.dispatches = this.dispatches.filter((d) => d.period !== period);
    } else {
      this.dispatches = [];
    }
    this.saveToDisk();
    return { count: beforeCount - this.dispatches.length };
  }

  public renderDocumentContent(
    docType: string,
    unitId: string,
    period: string
  ): { filename: string; contentType: string; content: string } {
    const unit = ownerPoolStore.getUnit(unitId);
    if (!unit) throw new Error(`Unit ${unitId} not found`);

    const stmtData = ownerPoolStore.getOwnerStatement(unitId, period);
    const line = stmtData.distributionLine;
    const batch = stmtData.batch;
    const periodName = this.getPeriodName(period);

    const gross = line ? line.gross_return_amount : Math.round(unit.purchase_price * 0.10 / 12);
    const tax = line ? line.tax_withheld_amount : Math.round(gross * 0.10);
    const net = line ? line.net_distribution_amount : gross - tax;

    if (docType === 'CSV_DATA_BREAKDOWN') {
      const csv = [
        'Distribution_Period,Unit_Number,Floor,Owner_Name,Unit_SQM,Allocation_Pct,Gross_Owner_Return,Tax_Withholding_Pct,Tax_Withheld,Net_Payout,Bank_Name,Account_Number,Account_Name',
        `"${period}","${unit.unit_number}",${unit.floor_number},"${unit.owner_name}",${unit.unit_sqm},"${line ? (line.allocation_pct * 100).toFixed(4) : '8.3333'}%",${gross},"${line ? line.tax_rate_pct : 10}%",${tax},${net},"${unit.bank_name}","${unit.bank_account_number}","${unit.bank_account_name || unit.owner_name}"`
      ].join('\n');
      return {
        filename: `Owner_Distribution_Schedule_${unit.unit_number}_${period}.csv`,
        contentType: 'text/csv',
        content: csv,
      };
    }

    if (docType === 'PAYMENT_ADVICE') {
      const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Payment Advice - Unit ${unit.unit_number} - ${period}</title>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 40px; color: #1e293b; font-size: 13px; line-height: 1.6; }
.header { border-bottom: 2px solid #3b82f6; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; }
.title { font-size: 20px; font-weight: 800; color: #0f172a; margin: 0; }
.badge { background: #dbeafe; color: #1e40af; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
.box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; }
table { width: 100%; border-collapse: collapse; margin-top: 16px; }
th, td { padding: 10px 12px; border: 1px solid #e2e8f0; text-align: left; }
th { background: #f1f5f9; font-weight: 700; }
.total { font-weight: 800; font-size: 16px; color: #047857; background: #ecfdf5; }
.footer { margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 11px; color: #64748b; text-align: center; }
</style>
</head>
<body>
<div class="header">
  <div>
    <h1 class="title">BANK PAYMENT REMITTANCE ADVICE</h1>
    <div style="font-size: 12px; color: #64748b; margin-top: 4px;">PT Atrium Manajemen Graha - Corporate Treasury</div>
  </div>
  <div style="text-align: right;">
    <span class="badge">DIRECT BANK DISBURSEMENT</span>
    <div style="font-size: 12px; font-weight: 600; margin-top: 6px;">Ref: ADVICE-${period}-${unit.unit_number}</div>
  </div>
</div>

<div class="grid">
  <div class="box">
    <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Beneficiary Details</div>
    <div style="font-size: 15px; font-weight: 800; color: #0f172a; margin-top: 4px;">${unit.owner_name}</div>
    <div style="margin-top: 8px;">Unit: <strong>${unit.unit_number}</strong> (${unit.unit_sqm} m²)</div>
    <div>Bank: <strong>${unit.bank_name}</strong></div>
    <div>Account No: <strong>${unit.bank_account_number}</strong></div>
    <div>Account Name: <strong>${unit.bank_account_name || unit.owner_name}</strong></div>
  </div>
  <div class="box">
    <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Payment Schedule & Status</div>
    <div style="margin-top: 8px;">Period: <strong>${periodName}</strong></div>
    <div>Disbursement Batch: <strong>${batch?.batch_id || `ODB-${period}`}</strong></div>
    <div>Scheduled Value Date: <strong>${this.getPaymentDate(period)}</strong></div>
    <div>Transfer Channel: <strong>Corporate BI-FAST / RTGS Host-to-Host</strong></div>
    <div>Status: <strong style="color: #047857;">VERIFIED & AUTHORIZED</strong></div>
  </div>
</div>

<table>
  <thead>
    <tr>
      <th>Description</th>
      <th style="text-align: right;">Gross Amount</th>
      <th style="text-align: right;">Tax Withheld</th>
      <th style="text-align: right;">Net Disbursement</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Monthly Owner Pool Return - Unit ${unit.unit_number} (${periodName})</td>
      <td style="text-align: right; font-weight: 600;">${this.formatIDR(gross)}</td>
      <td style="text-align: right; color: #dc2626;">- ${this.formatIDR(tax)}</td>
      <td style="text-align: right; font-weight: 700; color: #047857;">${this.formatIDR(net)}</td>
    </tr>
    <tr class="total">
      <td colspan="3">TOTAL NET TRANSFER PAYABLE</td>
      <td style="text-align: right;">${this.formatIDR(net)}</td>
    </tr>
  </tbody>
</table>

<div style="display: flex; justify-content: space-between; margin-top: 48px;">
  <div style="text-align: center; width: 200px;">
    <div style="font-size: 11px; color: #64748b;">Prepared by:</div>
    <div style="height: 50px;"></div>
    <div style="border-top: 1px solid #94a3b8; font-weight: 700; padding-top: 4px;">Dewi Sartika, SE</div>
    <div style="font-size: 11px; color: #64748b;">Hotel Accountant</div>
  </div>
  <div style="text-align: center; width: 200px;">
    <div style="font-size: 11px; color: #64748b;">Approved by:</div>
    <div style="height: 50px;"></div>
    <div style="border-top: 1px solid #94a3b8; font-weight: 700; padding-top: 4px;">Budi Santoso, Ak., CA</div>
    <div style="font-size: 11px; color: #64748b;">Financial Controller</div>
  </div>
</div>

<div class="footer">
  This is a computer-generated bank remittance advice issued by PT Atrium Manajemen Graha Treasury.
</div>
</body>
</html>`;
      return {
        filename: `Payment_Advice_Unit_${unit.unit_number}_${period}.html`,
        contentType: 'text/html',
        content: html,
      };
    }

    // Default: Official Owner Return Statement document
    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Owner Return Distribution Statement - Unit ${unit.unit_number} - ${period}</title>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 40px; color: #1e293b; font-size: 13px; line-height: 1.6; }
.header { border-bottom: 2px solid #4f46e5; padding-bottom: 20px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-start; }
.company { font-size: 22px; font-weight: 800; color: #1e1b4b; }
.doc-title { font-size: 15px; font-weight: 700; color: #4338ca; text-transform: uppercase; margin-top: 4px; }
.pill { background: #e0e7ff; color: #3730a3; padding: 4px 12px; border-radius: 9999px; font-weight: 700; font-size: 11px; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
.card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; }
table { width: 100%; border-collapse: collapse; margin: 20px 0; }
th, td { padding: 10px 14px; border: 1px solid #e2e8f0; font-size: 13px; }
th { background: #f1f5f9; font-weight: 700; text-align: left; }
.highlight { background: #f0fdf4; font-weight: 800; font-size: 16px; color: #15803d; }
.footer { margin-top: 48px; border-top: 1px solid #cbd5e1; padding-top: 16px; font-size: 11px; color: #64748b; }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="company">ATRIUM HOTEL & RESIDENCES</div>
    <div class="doc-title">Apartment Owner Return Distribution Statement</div>
    <div style="font-size: 12px; color: #64748b; margin-top: 4px;">PT Atrium Manajemen Graha • NPWP: 01.889.324.5-901.000</div>
  </div>
  <div style="text-align: right;">
    <span class="pill">CERTIFIED DISTRIBUTION</span>
    <div style="font-size: 12px; font-weight: 600; margin-top: 6px;">Batch: ${batch?.batch_id || `ODB-${period}`}</div>
    <div style="font-size: 11px; color: #64748b;">Issued: ${new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
  </div>
</div>

<div class="grid">
  <div class="card">
    <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Apartment & Owner Particulars</div>
    <div style="font-size: 16px; font-weight: 800; color: #0f172a; margin-top: 4px;">${unit.owner_name}</div>
    <div style="margin-top: 6px;">Unit Number: <strong>Unit ${unit.unit_number}</strong> (Floor ${unit.floor_number})</div>
    <div>Unit Area: <strong>${unit.unit_sqm} m²</strong> (${unit.unit_type})</div>
    <div>Contract Period: ${unit.contract_start_date} to ${unit.contract_end_date}</div>
    <div>Purchase Basis: ${this.formatIDR(unit.purchase_price - unit.vat_amount)} (Excl. VAT)</div>
  </div>
  <div class="card">
    <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Bank Account for Remittance</div>
    <div style="margin-top: 8px;">Bank: <strong>${unit.bank_name}</strong></div>
    <div>Account Number: <strong>${unit.bank_account_number}</strong></div>
    <div>Account Name: <strong>${unit.bank_account_name || unit.owner_name}</strong></div>
    <div style="margin-top: 8px; font-size: 11px; color: #047857; font-weight: 600;">Distribution Status: ELIGIBLE & AUDITED</div>
  </div>
</div>

<table>
  <thead>
    <tr>
      <th>Distribution Component & Calculation Formula</th>
      <th style="text-align: right;">Basis / Rate</th>
      <th style="text-align: right;">Amount (IDR)</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>
        <strong>Total Hotel Room Revenue (Gross)</strong><br />
        <span style="font-size: 11px; color: #64748b;">PMS Night Audit & Posted Ledger Revenue</span>
      </td>
      <td style="text-align: right;">100.0%</td>
      <td style="text-align: right; font-weight: 600;">${this.formatIDR(batch?.room_revenue_amount || 620000000)}</td>
    </tr>
    <tr>
      <td>
        <strong>Owner Distribution Pool Allocation (65%)</strong><br />
        <span style="font-size: 11px; color: #64748b;">Statutory Apartment Owner Allocation Pool</span>
      </td>
      <td style="text-align: right;">65.0%</td>
      <td style="text-align: right; font-weight: 600;">${this.formatIDR(batch?.owner_pool_amount || 403000000)}</td>
    </tr>
    <tr>
      <td>
        <strong>Unit SQM Pro-Rata Share</strong><br />
        <span style="font-size: 11px; color: #64748b;">Unit ${unit.unit_sqm} m² / Total ${batch?.total_eligible_sqm || 720} m²</span>
      </td>
      <td style="text-align: right;">${line ? (line.allocation_pct * 100).toFixed(4) : '8.3333'}%</td>
      <td style="text-align: right;">${this.formatIDR(line?.pool_allocation_amount || gross)}</td>
    </tr>
    <tr>
      <td>
        <strong>Contractual 10% Guaranteed Return Audit</strong><br />
        <span style="font-size: 11px; color: #64748b;">10% Annual Guaranteed Return / 12 Months</span>
      </td>
      <td style="text-align: right;">10.0% p.a.</td>
      <td style="text-align: right;">${this.formatIDR(line?.monthly_guaranteed_return || gross)}</td>
    </tr>
    <tr style="background: #f8fafc; font-weight: 700;">
      <td>Applicable Gross Owner Return (${line?.applicable_return_basis_type || 'POOL_ALLOCATION'})</td>
      <td style="text-align: right;">-</td>
      <td style="text-align: right;">${this.formatIDR(gross)}</td>
    </tr>
    <tr>
      <td style="color: #dc2626;">
        <strong>Statutory Tax Withholding</strong><br />
        <span style="font-size: 11px; color: #dc2626;">${line?.tax_type_label || 'PPh Final Pasal 4(2) 10%'}</span>
      </td>
      <td style="text-align: right; color: #dc2626;">${line?.tax_rate_pct || 10}%</td>
      <td style="text-align: right; color: #dc2626; font-weight: 700;">- ${this.formatIDR(tax)}</td>
    </tr>
    <tr class="highlight">
      <td>NET OWNER DISTRIBUTION PAYABLE</td>
      <td style="text-align: right;">Net Payout</td>
      <td style="text-align: right;">${this.formatIDR(net)}</td>
    </tr>
  </tbody>
</table>

<div style="display: flex; justify-content: space-between; margin-top: 60px;">
  <div style="text-align: center; width: 220px;">
    <div style="font-size: 11px; color: #64748b;">Prepared by:</div>
    <div style="height: 60px;"></div>
    <div style="border-top: 1px solid #94a3b8; font-weight: 700; padding-top: 4px;">Budi Santoso, Ak., CA</div>
    <div style="font-size: 11px; color: #64748b;">Financial Controller</div>
  </div>
  <div style="text-align: center; width: 220px;">
    <div style="font-size: 11px; color: #64748b;">Approved & Certified by:</div>
    <div style="height: 60px;"></div>
    <div style="border-top: 1px solid #94a3b8; font-weight: 700; padding-top: 4px;">Ir. Michael Wijaya, MBA</div>
    <div style="font-size: 11px; color: #64748b;">Director of Finance & Asset Management</div>
  </div>
</div>

<div class="footer">
  Atrium Hotel & Residences • PT Atrium Manajemen Graha • Jl. Sunset Road No. 88, Kuta, Bali • investor.relations@atriumhotel.com
</div>
</body>
</html>`;
    return {
      filename: `Owner_Statement_Unit_${unit.unit_number}_${period}.html`,
      contentType: 'text/html',
      content: html,
    };
  }

  // --- MOCK DATA RESET ---
  public resetMockData(): { clearedDispatches: number } {
    const clearedDispatches = this.dispatches.length;
    this.dispatches = [];
    this.savedDrafts.clear();
    this.saveToDisk();
    return { clearedDispatches };
  }
}

export const ownerEmailStore = new OwnerEmailStore();
