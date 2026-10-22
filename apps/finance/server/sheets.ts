/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { google } from 'googleapis';

export const REQUIRED_TABS: Record<string, string[]> = {
  chart_of_accounts: [
    'account_code',
    'account_name',
    'account_type',
    'normal_balance',
    'statutory_line',
    'usali_line',
    'active',
  ],
  departments: [
    'department_code',
    'department_name',
    'active',
  ],
  journal_header: [
    'journal_id',
    'journal_date',
    'period',
    'status',
    'source_type',
    'source_reference',
    'created_by',
    'approved_by',
    'posted_at',
    'reversal_of',
  ],
  journal_line: [
    'journal_id',
    'line_no',
    'account_code',
    'department_code',
    'debit',
    'credit',
    'description',
  ],
  revenue_transactions: [
    'transaction_id',
    'date',
    'source',
    'department_code',
    'account_code',
    'amount',
    'description',
    'journal_id',
  ],
  spending_transactions: [
    'transaction_id',
    'date',
    'type',
    'vendor_or_employee',
    'department_code',
    'account_code',
    'amount',
    'description',
    'journal_id',
  ],
};

function cleanEnvVal(raw: string | undefined): string {
  let val = (raw || '').trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1).trim();
  }
  return val;
}

function cleanPrivateKey(raw: string | undefined): string {
  let key = (raw || '').trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1).trim();
  }
  return key.replace(/\\n/g, '\n').trim();
}

export class GoogleSheetsClient {
  private spreadsheetId: string;
  private clientEmail: string;
  private privateKey: string;
  private sheetsService: any = null;
  public isConnected: boolean = false;
  public lastError: string | null = null;
  public initializedTabs: string[] = [];

  constructor() {
    this.spreadsheetId = cleanEnvVal(process.env.GOOGLE_SPREADSHEET_ID);
    this.clientEmail = cleanEnvVal(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL);
    this.privateKey = cleanPrivateKey(process.env.GOOGLE_PRIVATE_KEY);
  }

  public hasCredentials(): boolean {
    return Boolean(this.spreadsheetId && this.clientEmail && this.privateKey);
  }

  public async initialize(): Promise<boolean> {
    // Re-read env in case updated at runtime
    this.spreadsheetId = cleanEnvVal(process.env.GOOGLE_SPREADSHEET_ID);
    this.clientEmail = cleanEnvVal(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL);
    this.privateKey = cleanPrivateKey(process.env.GOOGLE_PRIVATE_KEY);

    if (!this.hasCredentials()) {
      this.isConnected = false;
      this.lastError = 'Google Sheets credentials missing (GOOGLE_SPREADSHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY).';
      return false;
    }

    try {
      const auth = new google.auth.JWT({
        email: this.clientEmail,
        key: this.privateKey,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });

      this.sheetsService = google.sheets({ version: 'v4', auth });

      // Test connection and inspect existing sheets
      const meta = await this.sheetsService.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
      });

      const existingSheets: string[] = (meta.data.sheets || [])
        .map((s: any) => s.properties?.title)
        .filter(Boolean);

      // Auto-create missing tabs
      const missingTabs = Object.keys(REQUIRED_TABS).filter(
        (tab) => !existingSheets.includes(tab)
      );

      if (missingTabs.length > 0) {
        const requests = missingTabs.map((title) => ({
          addSheet: {
            properties: { title },
          },
        }));

        await this.sheetsService.spreadsheets.batchUpdate({
          spreadsheetId: this.spreadsheetId,
          requestBody: { requests },
        });

        // Initialize header rows for newly created tabs
        for (const tab of missingTabs) {
          const headers = REQUIRED_TABS[tab];
          await this.sheetsService.spreadsheets.values.update({
            spreadsheetId: this.spreadsheetId,
            range: `${tab}!A1`,
            valueInputOption: 'RAW',
            requestBody: {
              values: [headers],
            },
          });
        }
      }

      // Check that existing tabs also have their header row
      for (const tab of Object.keys(REQUIRED_TABS)) {
        if (!missingTabs.includes(tab)) {
          try {
            const headRes = await this.sheetsService.spreadsheets.values.get({
              spreadsheetId: this.spreadsheetId,
              range: `${tab}!A1:Z1`,
            });
            const existingHeaders = headRes.data.values?.[0] || [];
            if (existingHeaders.length === 0) {
              const headers = REQUIRED_TABS[tab];
              await this.sheetsService.spreadsheets.values.update({
                spreadsheetId: this.spreadsheetId,
                range: `${tab}!A1`,
                valueInputOption: 'RAW',
                requestBody: {
                  values: [headers],
                },
              });
            }
          } catch (headErr) {
            console.warn(`Could not verify header for ${tab}:`, headErr);
          }
        }
      }

      this.initializedTabs = Object.keys(REQUIRED_TABS);
      this.isConnected = true;
      this.lastError = null;
      return true;
    } catch (err: any) {
      console.error('Google Sheets connection error:', err?.message || err);
      this.isConnected = false;
      this.lastError = err?.message || 'Failed to authenticate with Google Sheets API';
      return false;
    }
  }

  public async readTab(tabName: string): Promise<Record<string, any>[]> {
    if (!this.isConnected || !this.sheetsService) {
      throw new Error('Google Sheets not connected');
    }

    try {
      const res = await this.sheetsService.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${tabName}!A1:Z`,
      });

      const rows = res.data.values || [];
      if (rows.length <= 1) {
        return []; // only header or empty
      }

      const headers: string[] = rows[0].map((h: any) => String(h).trim());
      const dataRows = rows.slice(1);

      return dataRows.map((row: any[]) => {
        const item: Record<string, any> = {};
        headers.forEach((header, index) => {
          item[header] = row[index] !== undefined ? row[index] : '';
        });
        return item;
      });
    } catch (err: any) {
      console.error(`Error reading tab ${tabName}:`, err?.message || err);
      throw err;
    }
  }

  public async writeTab(tabName: string, headers: string[], rows: any[][]): Promise<void> {
    if (!this.isConnected || !this.sheetsService) {
      throw new Error('Google Sheets not connected');
    }

    try {
      // Clear existing values
      await this.sheetsService.spreadsheets.values.clear({
        spreadsheetId: this.spreadsheetId,
        range: `${tabName}!A:Z`,
      });

      // Write header + rows
      const values = [headers, ...rows];
      await this.sheetsService.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `${tabName}!A1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values },
      });
    } catch (err: any) {
      console.error(`Error writing tab ${tabName}:`, err?.message || err);
      throw err;
    }
  }

  public async appendRow(tabName: string, rowValues: any[]): Promise<void> {
    if (!this.isConnected || !this.sheetsService) {
      throw new Error('Google Sheets not connected');
    }

    await this.sheetsService.spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId,
      range: `${tabName}!A:A`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [rowValues],
      },
    });
  }

  public getStatus() {
    return {
      connected: this.isConnected,
      hasCredentials: this.hasCredentials(),
      spreadsheetId: this.spreadsheetId || null,
      clientEmail: this.clientEmail || null,
      initializedTabs: this.initializedTabs,
      error: this.lastError,
    };
  }

  public async getDiagnostics() {
    const t0 = Date.now();
    if (!this.isConnected || !this.sheetsService) {
      await this.initialize();
    }
    if (!this.isConnected || !this.sheetsService) {
      return {
        connected: false,
        latency_ms: Date.now() - t0,
        spreadsheet_id: this.spreadsheetId || '',
        tabs_verified: [],
        checked_at: new Date().toISOString(),
      };
    }

    try {
      const res = await this.sheetsService.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
      });
      const latency_ms = Date.now() - t0;
      const title = res.data.properties?.title || 'Google Sheet Master Ledger';

      const tabs_verified: { tab_name: string; rows_count: number; has_headers: boolean }[] = [];
      for (const tab of Object.keys(REQUIRED_TABS)) {
        try {
          const valRes = await this.sheetsService.spreadsheets.values.get({
            spreadsheetId: this.spreadsheetId,
            range: `${tab}!A1:B`,
          });
          const rows = valRes.data.values || [];
          tabs_verified.push({
            tab_name: tab,
            rows_count: Math.max(0, rows.length - 1),
            has_headers: rows.length > 0,
          });
        } catch {
          tabs_verified.push({
            tab_name: tab,
            rows_count: 0,
            has_headers: false,
          });
        }
      }

      return {
        connected: true,
        latency_ms,
        spreadsheet_title: title,
        spreadsheet_id: this.spreadsheetId,
        tabs_verified,
        checked_at: new Date().toISOString(),
      };
    } catch (err: any) {
      return {
        connected: false,
        latency_ms: Date.now() - t0,
        spreadsheet_id: this.spreadsheetId || '',
        tabs_verified: [],
        checked_at: new Date().toISOString(),
      };
    }
  }
}
