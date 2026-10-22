/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { store } from './server/store';
import { inventoryStore } from './server/inventoryStore';
import { serviceChargeStore } from './server/serviceChargeStore';
import { ownerPoolStore } from './server/ownerPoolStore';
import { ownerEmailStore } from './server/ownerEmailStore';
import { taxStore } from './server/taxStore';
import { arapStore } from './server/arapStore';
import { pettyCashStore } from './server/pettyCashStore';
import {
  clearFinanceSessionCookie,
  exchangeHandoffToken,
  getFinanceSession,
  requireWolfSession,
  setFinanceSessionCookie,
} from './server/wolfAuth';
import { requireAuthorized } from './server/authorizeMiddleware';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  const app = express();

  app.use(express.json());

  // Initialize store and attempt Google Sheets connection on boot
  store.init().catch((err) => {
    console.warn('Initial Google Sheets load notice:', err?.message || err);
  });

  // --- API ROUTES ---

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Wolf portal handoff (Prompt 3) — only trusted entry path
  app.post('/api/wolf/handoff', async (req, res) => {
    try {
      const token = String(req.body?.token ?? '');
      if (!token) {
        res.status(400).json({ error: 'token_required' });
        return;
      }
      const session = await exchangeHandoffToken(token);
      setFinanceSessionCookie(res, session.id);
      res.json({
        ok: true,
        userId: session.userId,
        companyId: session.companyId,
        authLevel: session.authLevel,
      });
    } catch (err: any) {
      const msg = err?.message || 'handoff_failed';
      const status = msg === 'wolf_session_revoked' ? 401 : 401;
      res.status(status).json({ error: msg });
    }
  });

  app.get('/api/wolf/session', (req, res) => {
    const session = getFinanceSession(req);
    if (!session) {
      res.status(401).json({ error: 'wolf_session_required' });
      return;
    }
    res.json({
      userId: session.userId,
      companyId: session.companyId,
      authLevel: session.authLevel,
      authTime: session.authTime,
    });
  });

  app.post('/api/wolf/logout', (req, res) => {
    clearFinanceSessionCookie(res);
    res.json({ ok: true });
  });

  // Disable legacy password login — Finance trusts Wolf handoff only
  app.post('/api/auth/verify-user', (_req, res) => {
    res.status(410).json({
      error: 'legacy_login_disabled',
      message: 'Sign in through the Wolf portal.',
    });
  });

  app.use(requireWolfSession);
  app.use(requireAuthorized);

  // Google Sheets Connection Status
  app.get('/api/status', (req, res) => {
    const sheetStatus = store.sheetsClient.getStatus();
    res.json({
      connected: sheetStatus.connected,
      hasCredentials: sheetStatus.hasCredentials,
      spreadsheetId: sheetStatus.spreadsheetId,
      clientEmail: sheetStatus.clientEmail,
      initializedTabs: sheetStatus.initializedTabs,
      error: sheetStatus.error,
      systemSettings: store.systemSettings,
      storeStats: {
        accounts: store.accounts.size,
        departments: store.departments.size,
        journals: store.journalHeaders.size,
        revenueTransactions: store.revenueTransactions.size,
        spendingTransactions: store.spendingTransactions.size,
      },
    });
  });

  // Google Sheets Live Diagnostics
  app.get('/api/sheets/diagnostics', async (req, res) => {
    try {
      const diag = await store.sheetsClient.getDiagnostics();
      res.json(diag);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to run diagnostics' });
    }
  });

  // System Administration Settings (Hotel profile, Period locks, Currency)
  app.get('/api/admin/settings', (req, res) => {
    res.json(store.systemSettings);
  });

  app.post('/api/admin/settings', (req, res) => {
    try {
      store.systemSettings = {
        ...store.systemSettings,
        ...req.body,
      };
      res.json({ success: true, settings: store.systemSettings });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // --- USER ACCESS CONTROL & RBAC MODULE ---

  app.get('/api/admin/access-control', (req, res) => {
    res.json(store.getAccessControlState());
  });

  // Verify and link logged in email/password to registered SystemUser
  app.post('/api/auth/verify-user', (req, res) => {
    try {
      const email = String(req.body.email || '').trim().toLowerCase();
      const password = req.body.password ? String(req.body.password) : undefined;
      const isGoogleOAuth = Boolean(req.body.isGoogleOAuth);

      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      const users = Array.from(store.users.values());
      const matched = users.find((u) => u.email.toLowerCase() === email);

      if (!matched) {
        return res.status(403).json({
          authorized: false,
          error: `Akses Ditolak: Email "${email}" belum didaftarkan oleh Financial Controller / Administrator. Silakan hubungi laluzayen@gmail.com.`,
        });
      }

      if (matched.status === 'suspended') {
        return res.status(403).json({
          authorized: false,
          error: `Akun Dinonaktifkan: Akses untuk "${email}" sedang dibekukan. Hubungi Administrator.`,
        });
      }

      // If user logs in via email & password (not Google OAuth popup), verify password
      if (!isGoogleOAuth) {
        if (!password) {
          return res.status(400).json({
            authorized: false,
            error: 'Kata sandi (password) diperlukan untuk akun ini.',
          });
        }
        if (matched.password && matched.password !== password) {
          return res.status(401).json({
            authorized: false,
            error: 'Kata sandi (password) salah. Silakan periksa kembali atau hubungi Administrator.',
          });
        }
      }

      // Update user login timestamp and switch active user context
      matched.lastLogin = 'Online now';
      store.users.set(matched.id, matched);
      store.setCurrentUser(matched.id);

      const state = store.getAccessControlState();
      const role = store.roles.get(matched.roleId);

      res.json({
        authorized: true,
        user: matched,
        role: role,
        state,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/access-control/switch-user', (req, res) => {
    try {
      const state = store.setCurrentUser(req.body.userId);
      res.json(state);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/admin/access-control/users', (req, res) => {
    try {
      const savedUser = store.saveUser(req.body);
      res.json({ user: savedUser, state: store.getAccessControlState() });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/admin/access-control/users/:id', (req, res) => {
    try {
      store.deleteUser(req.params.id);
      res.json({ success: true, state: store.getAccessControlState() });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/admin/access-control/roles', (req, res) => {
    try {
      const savedRole = store.saveRole(req.body);
      res.json({ role: savedRole, state: store.getAccessControlState() });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/admin/access-control/roles/:id', (req, res) => {
    try {
      store.deleteRole(req.params.id);
      res.json({ success: true, state: store.getAccessControlState() });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/admin/access-control/reset', (req, res) => {
    try {
      const state = store.resetAccessControlToDefaults();
      res.json(state);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Mock Data Reset & Testing Environment
  app.get('/api/admin/mock-data/status', (req, res) => {
    try {
      const stats = {
        journalHeadersCount: store.journalHeaders.size,
        journalLinesCount: store.journalLines.length,
        revenueTxCount: store.revenueTransactions.size,
        spendingTxCount: store.spendingTransactions.size,
        purchaseOrdersCount: inventoryStore.purchaseOrders.size,
        requisitionsCount: inventoryStore.requisitions.size,
        receiptsCount: inventoryStore.receipts.size,
        inventoryMovementsCount: inventoryStore.movements.length,
        ownerBatchesCount: ownerPoolStore.batches.size,
        serviceChargeCyclesCount: serviceChargeStore.cycles.size,
        serviceChargeCollectionsCount: serviceChargeStore.collections.size,
        taxObligationsCount: taxStore.obligations.size,
        dispatchesCount: ownerEmailStore.dispatches.length,
        isCleanSlate:
          store.journalHeaders.size === 0 &&
          store.revenueTransactions.size === 0 &&
          store.spendingTransactions.size === 0 &&
          inventoryStore.purchaseOrders.size === 0 &&
          ownerPoolStore.batches.size === 0 &&
          serviceChargeStore.cycles.size === 0,
        isMockDataCleared: store.isMockDataCleared,
      };
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/mock-data/reset', (req, res) => {
    try {
      const { clearMaster = false } = req.body || {};

      const storeRes = store.resetMockData();
      const invRes = inventoryStore.resetMockData({ clearMaster });
      const opRes = ownerPoolStore.resetMockData({ clearUnits: clearMaster });
      const scRes = serviceChargeStore.resetMockData({ clearEmployees: clearMaster });
      const taxRes = taxStore.resetMockData();
      const arapRes = arapStore.resetMockData();
      const emailRes = ownerEmailStore.resetMockData();

      res.json({
        success: true,
        message: 'Mock data successfully reset. Clean slate ready for custom testing data.',
        cleared: {
          journals: storeRes.clearedJournals,
          revenue_tx: storeRes.clearedRevenue,
          spending_tx: storeRes.clearedSpending,
          purchase_orders: invRes.clearedOrders,
          requisitions: invRes.clearedRequisitions,
          receipts: invRes.clearedReceipts,
          movements: invRes.clearedMovements,
          owner_batches: opRes.clearedBatches,
          sc_collections: scRes.clearedCollections,
          sc_cycles: scRes.clearedCycles,
          tax_obligations: taxRes.clearedObligations,
          dispatches: emailRes.clearedDispatches,
          ar_payments: arapRes.clearedARPayments,
          ap_payments: arapRes.clearedAPPayments,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/mock-data/seed-demo', async (req, res) => {
    try {
      await store.seedDemoData();
      inventoryStore.seedDefaults();
      ownerPoolStore.reseedDefaults();
      serviceChargeStore.seedDefaults();

      res.json({
        success: true,
        message: 'Demo dataset re-seeded successfully.',
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // PMS Night Audit Ingestion
  app.post('/api/integrations/pms-audit', async (req, res) => {
    try {
      const result = await store.ingestPmsNightAudit(req.body);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Re-initialize / Test Google Sheets connection
  app.post('/api/sheets/init', async (req, res) => {
    try {
      dotenv.config();
      store.sheetsClient = new (await import('./server/sheets')).GoogleSheetsClient();
      const connected = await store.sheetsClient.initialize();
      if (connected) {
        await store.loadFromSheets();
        if (store.accounts.size === 0) {
          await store.seedStandardHotelAccounts();
        }
      }
      res.json({ success: connected, status: store.sheetsClient.getStatus() });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to initialize Google Sheets' });
    }
  });

  // --- CHART OF ACCOUNTS & DEPARTMENTS ---

  app.get('/api/accounts', (req, res) => {
    res.json(store.getAccounts());
  });

  app.post('/api/accounts', async (req, res) => {
    try {
      const saved = await store.saveAccount(req.body);
      res.json(saved);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/accounts/deactivate', async (req, res) => {
    try {
      const { account_code } = req.body;
      const deactivated = await store.deactivateAccount(account_code);
      res.json(deactivated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/accounts/:code', async (req, res) => {
    try {
      await store.deleteAccount(req.params.code);
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/accounts/seed-usali', async (req, res) => {
    try {
      await store.seedStandardHotelAccounts();
      res.json({
        success: true,
        accounts: store.getAccounts(),
        departments: store.getDepartments(),
        mappingConfig: store.mappingConfig,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/departments', (req, res) => {
    res.json(store.getDepartments());
  });

  app.post('/api/departments', async (req, res) => {
    try {
      const saved = await store.saveDepartment(req.body);
      res.json(saved);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // --- MAPPING CONFIGURATION ---

  app.get('/api/mapping', (req, res) => {
    res.json(store.mappingConfig);
  });

  app.post('/api/mapping', (req, res) => {
    store.mappingConfig = {
      ...store.mappingConfig,
      ...req.body,
      confirmed_by_controller: true,
    };
    res.json(store.mappingConfig);
  });

  // --- REPORT CONFIGURATION (FORMAT & STRUCTURE) ---

  app.get('/api/config/reports', (req, res) => {
    res.json(store.getReportConfig());
  });

  app.post('/api/config/reports', (req, res) => {
    try {
      const updated = store.updateReportConfig(req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/config/reports/reset', (req, res) => {
    try {
      const reset = store.resetReportConfig();
      res.json(reset);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // --- REVENUE CYCLE ---

  app.get('/api/revenue', (req, res) => {
    res.json(store.getRevenueTransactions());
  });

  app.post('/api/revenue', async (req, res) => {
    try {
      const result = await store.recordRevenueTransaction(req.body);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // --- SPENDING CYCLE ---

  app.get('/api/spending', (req, res) => {
    res.json(store.getSpendingTransactions());
  });

  app.post('/api/spending', async (req, res) => {
    try {
      const result = await store.recordSpendingTransaction(req.body);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // --- JOURNAL WORKBENCH & WORKFLOW ---

  app.get('/api/journals', (req, res) => {
    res.json(store.getJournals());
  });

  app.get('/api/journals/:id', (req, res) => {
    const journal = store.getJournalById(req.params.id);
    if (!journal) {
      return res.status(404).json({ error: 'Journal not found' });
    }
    res.json(journal);
  });

  // Create manual journal
  app.post('/api/journals', async (req, res) => {
    try {
      const { header, lines } = req.body;
      const journal = await store.createJournal(header, lines);
      res.json(journal);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Validate step
  app.post('/api/journals/:id/validate', async (req, res) => {
    try {
      const validated = await store.validateJournal(req.params.id);
      res.json(validated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Approve step
  app.post('/api/journals/:id/approve', async (req, res) => {
    try {
      const approver = req.body.approver || 'Zayen (Controller)';
      const approved = await store.approveJournal(req.params.id, approver);
      res.json(approved);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Post step (locks journal)
  app.post('/api/journals/:id/post', async (req, res) => {
    try {
      const { autoApprove, approver } = req.body || {};
      const posted = await store.postJournal(req.params.id, { autoApprove, approver });
      res.json(posted);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Reverse step (creates offsetting journal)
  app.post('/api/journals/:id/reverse', async (req, res) => {
    try {
      const { reversalDate } = req.body;
      const result = await store.reverseJournal(req.params.id, reversalDate);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Delete draft journal
  app.delete('/api/journals/:id', async (req, res) => {
    try {
      await store.deleteDraftJournal(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // --- GENERAL LEDGER ---

  app.get('/api/ledger', (req, res) => {
    const { account_code, period, start_date, end_date } = req.query;
    const ledger = store.getGeneralLedger({
      account_code: account_code ? String(account_code) : undefined,
      period: period ? String(period) : undefined,
      start_date: start_date ? String(start_date) : undefined,
      end_date: end_date ? String(end_date) : undefined,
    });
    res.json(ledger);
  });

  // --- TRIAL BALANCE ---

  app.get('/api/trial-balance', (req, res) => {
    const { period } = req.query;
    const tb = store.getTrialBalance(period ? String(period) : undefined);
    res.json(tb);
  });

  // --- DASHBOARD ---

  app.get('/api/dashboard', (req, res) => {
    const { period } = req.query;
    const metrics = store.getDashboardMetrics(period ? String(period) : undefined);
    res.json(metrics);
  });

  // --- REUSABLE REPORT ENGINE ROUTES ---

  // Financial Statements (Balance Sheet & Income Statement)
  app.get('/api/reports/financial-statements', (req, res) => {
    const { period } = req.query;
    const rep = store.getFinancialStatements(period ? String(period) : undefined);
    res.json(rep);
  });

  // USALI 12th Revised Edition Summary Operating Statement
  app.get('/api/reports/usali', (req, res) => {
    const { period } = req.query;
    const rep = store.getUsaliOperatingStatement(period ? String(period) : undefined);
    res.json(rep);
  });

  // Universal Drill-Down
  app.get('/api/reports/drilldown', (req, res) => {
    const { report_type, line_id, account_code, period } = req.query;
    const drilldown = store.getDrilldown({
      report_type: String(report_type || 'USALI'),
      line_id: line_id ? String(line_id) : undefined,
      account_code: account_code ? String(account_code) : undefined,
      period: period ? String(period) : undefined,
    });
    res.json(drilldown);
  });

  // Controls & Exceptions Audit
  app.get('/api/controls/exceptions', (req, res) => {
    const { period } = req.query;
    const exceptions = store.getControlExceptions(period ? String(period) : undefined);
    res.json(exceptions);
  });

  // ==========================================
  // HOTEL INVENTORY MANAGEMENT MODULE APIS
  // ==========================================

  // Dashboard KPIs
  app.get('/api/inventory/dashboard', (req, res) => {
    try {
      res.json(inventoryStore.getDashboardKPIs());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Categories
  app.get('/api/inventory/categories', (req, res) => {
    try {
      res.json(inventoryStore.getCategories());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/inventory/categories', (req, res) => {
    try {
      const cat = inventoryStore.saveCategory(req.body);
      res.json(cat);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Storerooms
  app.get('/api/inventory/storerooms', (req, res) => {
    try {
      res.json(inventoryStore.getStorerooms());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/inventory/storerooms', (req, res) => {
    try {
      const room = inventoryStore.saveStoreroom(req.body);
      res.json(room);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/inventory/storerooms/:id', (req, res) => {
    try {
      const result = inventoryStore.deleteStoreroom(req.params.id);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Item Master Catalog
  app.get('/api/inventory/items', (req, res) => {
    try {
      res.json(inventoryStore.getItems());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/inventory/items/:id', (req, res) => {
    try {
      const item = inventoryStore.getItem(req.params.id);
      if (!item) return res.status(404).json({ error: 'Item not found' });
      res.json(item);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/inventory/items', (req, res) => {
    try {
      const userId = String(req.headers['x-user-id'] || req.body.user_id || 'usr-controller-1');
      const userName = String(req.headers['x-user-name'] || req.body.user_name || 'Admin');
      const saved = inventoryStore.saveItem(req.body, userId, userName);
      res.json(saved);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/inventory/items/:id', (req, res) => {
    try {
      const userId = String(req.headers['x-user-id'] || req.body.user_id || 'usr-controller-1');
      const userName = String(req.headers['x-user-name'] || req.body.user_name || 'Admin');
      const saved = inventoryStore.saveItem({ ...req.body, item_id: req.params.id }, userId, userName);
      res.json(saved);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Stock Card (Item Movement Ledger)
  app.get('/api/inventory/items/:id/stock-card', (req, res) => {
    try {
      const card = inventoryStore.getItemStockCard(req.params.id);
      res.json(card);
    } catch (err: any) {
      res.status(404).json({ error: err.message });
    }
  });

  // Barcode Lookup
  app.get('/api/inventory/barcode/:barcode', (req, res) => {
    try {
      const item = inventoryStore.getItemByBarcode(req.params.barcode);
      if (!item) {
        return res.status(404).json({ error: `No item found matching barcode "${req.params.barcode}"` });
      }
      res.json(item);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Stock Movements
  app.get('/api/inventory/movements', (req, res) => {
    try {
      const { item_id, storeroom_id, movement_type, start_date, end_date } = req.query;
      const list = inventoryStore.getMovements({
        item_id: item_id ? String(item_id) : undefined,
        storeroom_id: storeroom_id ? String(storeroom_id) : undefined,
        movement_type: movement_type ? String(movement_type) : undefined,
        start_date: start_date ? String(start_date) : undefined,
        end_date: end_date ? String(end_date) : undefined,
      });
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Receiving (Goods Receipt)
  app.post('/api/inventory/receiving', async (req, res) => {
    try {
      const userId = String(req.headers['x-user-id'] || req.body.user_id || 'usr-controller-1');
      const userName = String(req.headers['x-user-name'] || req.body.user_name || 'Bambang Soediro (Purchasing)');
      const result = await inventoryStore.processGoodsReceipt(req.body, userId, userName);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/inventory/receipts', (req, res) => {
    try {
      res.json(Array.from(inventoryStore.receipts.values()).reverse());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Department Requisitions
  app.get('/api/inventory/requisitions', (req, res) => {
    try {
      res.json(Array.from(inventoryStore.requisitions.values()).reverse());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/inventory/requisitions', (req, res) => {
    try {
      const reqDoc = inventoryStore.createRequisition(req.body);
      res.json(reqDoc);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/inventory/requisitions/:id/approve', (req, res) => {
    try {
      const approverName = String(req.body.approver_name || 'Department Head');
      const approved = inventoryStore.approveRequisition(req.params.id, approverName, req.body.itemApprovals);
      res.json(approved);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/inventory/requisitions/:id/issue', async (req, res) => {
    try {
      const issuerName = String(req.body.issuer_name || 'Storekeeper');
      const issuerId = String(req.body.issuer_id || 'usr-controller-1');
      const result = await inventoryStore.issueRequisition(req.params.id, issuerName, issuerId);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // ==========================================
  // PURCHASE ORDERS (PROCUREMENT) APIS
  // ==========================================

  app.get('/api/inventory/purchase-orders', (req, res) => {
    try {
      res.json(inventoryStore.getPurchaseOrders());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/inventory/purchase-orders/:id', (req, res) => {
    try {
      const po = inventoryStore.getPurchaseOrder(req.params.id);
      if (!po) return res.status(404).json({ error: 'Purchase Order not found' });
      res.json(po);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/inventory/purchase-orders', (req, res) => {
    try {
      const createdBy = String(req.headers['x-user-name'] || req.body.created_by || 'Procurement Officer');
      const po = inventoryStore.createPurchaseOrder({
        ...req.body,
        created_by: createdBy,
      });
      res.json(po);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/inventory/purchase-orders/:id/journal', async (req, res) => {
    try {
      const userName = String(req.headers['x-user-name'] || req.body.user_name || 'Purchasing Manager');
      const journalMode = (req.body.mode === 'ACCRUAL' ? 'ACCRUAL' : 'COMMITMENT') as 'COMMITMENT' | 'ACCRUAL';
      const result = await inventoryStore.generatePurchaseOrderJournal(req.params.id, journalMode, userName);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.patch('/api/inventory/purchase-orders/:id/status', (req, res) => {
    try {
      const po = inventoryStore.updatePurchaseOrderStatus(req.params.id, req.body.status);
      res.json(po);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/inventory/purchase-orders/:id', (req, res) => {
    try {
      const po = inventoryStore.updatePurchaseOrderDetails(req.params.id, req.body);
      res.json(po);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Automated Receive Goods & Update Inventory from PO
  app.post('/api/inventory/purchase-orders/:id/receive', async (req, res) => {
    try {
      const userId = String(req.headers['x-user-id'] || req.body.user_id || 'usr-controller-1');
      const userName = String(req.headers['x-user-name'] || req.body.user_name || 'Procurement Receiving Officer');
      const result = await inventoryStore.receivePurchaseOrder(req.params.id, {
        ...req.body,
        userId,
        userName,
      });
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // ==========================================
  // ACCOUNTS RECEIVABLE (AR) & ACCOUNTS PAYABLE (AP) APIS
  // ==========================================

  // Accounts Receivable (AR) - Connected to Revenue Cycle
  app.get('/api/ar/items', (req, res) => {
    try {
      res.json(arapStore.getARItems());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/ar/settlements', async (req, res) => {
    try {
      const userName = String(req.headers['x-user-name'] || req.body.userName || 'AR Cashier');
      const result = await arapStore.recordARSettlement({
        ...req.body,
        userName,
      });
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Accounts Payable (AP) - Connected to Procurement & Spending
  app.get('/api/ap/items', (req, res) => {
    try {
      res.json(arapStore.getAPItems());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/ap/payments', async (req, res) => {
    try {
      const userName = String(req.headers['x-user-name'] || req.body.userName || 'AP Accountant');
      const result = await arapStore.recordAPPayment({
        ...req.body,
        userName,
      });
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Direct Department Issue
  app.post('/api/inventory/issues/direct', async (req, res) => {
    try {
      const userId = String(req.headers['x-user-id'] || req.body.user_id || 'usr-controller-1');
      const userName = String(req.headers['x-user-name'] || req.body.user_name || 'Storekeeper');
      const result = await inventoryStore.directStockIssue({
        ...req.body,
        userId,
        userName,
      });
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Stock Transfers
  app.post('/api/inventory/transfers', (req, res) => {
    try {
      const userId = String(req.headers['x-user-id'] || req.body.user_id || 'usr-controller-1');
      const userName = String(req.headers['x-user-name'] || req.body.user_name || 'Storekeeper');
      const moves = inventoryStore.processStockTransfer({
        ...req.body,
        userId,
        userName,
      });
      res.json({ success: true, movements: moves });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Physical Stock Count Sessions
  app.get('/api/inventory/counts', (req, res) => {
    try {
      res.json(Array.from(inventoryStore.countSessions.values()).reverse());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/inventory/counts/:id', (req, res) => {
    try {
      const session = inventoryStore.countSessions.get(req.params.id);
      if (!session) return res.status(404).json({ error: 'Count session not found' });
      res.json(session);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/inventory/counts', (req, res) => {
    try {
      const countedBy = String(req.body.counted_by || 'Inventory Auditor');
      const session = inventoryStore.startStockCount({
        title: req.body.title,
        storeroom_id: req.body.storeroom_id,
        counted_by: countedBy,
      });
      res.json(session);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/inventory/counts/:id', (req, res) => {
    try {
      const session = inventoryStore.updateStockCountItems(req.params.id, req.body.updates || []);
      res.json(session);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/inventory/counts/:id/submit', (req, res) => {
    try {
      const session = inventoryStore.submitStockCount(req.params.id);
      res.json(session);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/inventory/counts/:id/approve', async (req, res) => {
    try {
      const approverName = String(req.body.approver_name || 'Financial Controller');
      const approverId = String(req.body.approver_id || 'usr-controller-1');
      const result = await inventoryStore.approveStockCount(req.params.id, approverName, approverId);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Manual Stock Adjustments
  app.get('/api/inventory/adjustments', (req, res) => {
    try {
      res.json(Array.from(inventoryStore.adjustments.values()).reverse());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/inventory/adjustments', async (req, res) => {
    try {
      const userId = String(req.headers['x-user-id'] || req.body.user_id || 'usr-controller-1');
      const userName = String(req.headers['x-user-name'] || req.body.user_name || 'Financial Controller');
      const result = await inventoryStore.createStockAdjustment({
        ...req.body,
        userId,
        userName,
      });
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Inventory Reports
  app.get('/api/inventory/reports', (req, res) => {
    try {
      const reports = inventoryStore.getInventoryReports({
        period: req.query.period ? String(req.query.period) : undefined,
        storeroom_id: req.query.storeroom_id ? String(req.query.storeroom_id) : undefined,
        category_id: req.query.category_id ? String(req.query.category_id) : undefined,
      });
      res.json(reports);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- STAFF SERVICE CHARGE & GRATUITIES DISTRIBUTION POOL ---

  app.get('/api/service-charge/kpis', (req, res) => {
    try {
      const kpis = serviceChargeStore.getKPIs();
      res.json(kpis);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/service-charge/employees', (req, res) => {
    try {
      const employees = serviceChargeStore.getEmployees();
      res.json(employees);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/service-charge/employees', (req, res) => {
    try {
      const employee = serviceChargeStore.saveEmployee(req.body);
      res.json(employee);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/service-charge/employees/:id', (req, res) => {
    try {
      const result = serviceChargeStore.deleteEmployee(req.params.id);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/service-charge/collections', (req, res) => {
    try {
      const period = req.query.period ? String(req.query.period) : undefined;
      const collections = serviceChargeStore.getCollections(period);
      res.json(collections);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/service-charge/collections', async (req, res) => {
    try {
      const result = await serviceChargeStore.recordCollection(req.body);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/service-charge/cycles', (req, res) => {
    try {
      const cycles = serviceChargeStore.getCycles();
      res.json(cycles);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/service-charge/cycles/:id', (req, res) => {
    try {
      const cycle = serviceChargeStore.getCycle(req.params.id);
      if (!cycle) return res.status(404).json({ error: 'Distribution cycle not found' });
      res.json(cycle);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/service-charge/cycles/calculate', (req, res) => {
    try {
      const cycle = serviceChargeStore.calculateDistribution(req.body);
      res.json(cycle);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/service-charge/cycles/:id/approve', async (req, res) => {
    try {
      const approverName = String(req.body.approver_name || req.headers['x-user-name'] || 'Financial Controller');
      const result = await serviceChargeStore.approveAndPostDistribution(req.params.id, approverName);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/service-charge/seed-defaults', (req, res) => {
    try {
      serviceChargeStore.seedDefaults();
      res.json({ success: true, message: 'Reset and seeded service charge defaults' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- APARTMENT OWNER POOL & RETURN DISTRIBUTION API ROUTES ---

  // Dashboard KPIs
  app.get('/api/owner-pool/kpis', (req, res) => {
    try {
      const period = req.query.period ? String(req.query.period) : '2026-09';
      const kpis = ownerPoolStore.getDashboardKPIs(period);
      res.json(kpis);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Posted Room Revenue query with transaction breakdown
  app.get('/api/owner-pool/room-revenue', (req, res) => {
    try {
      const period = req.query.period ? String(req.query.period) : undefined;
      const rev = store.getPostedRoomRevenue(period);
      res.json(rev);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Units Master Data CRUD & Summary
  app.get('/api/owner-pool/units', (req, res) => {
    try {
      const units = ownerPoolStore.getUnits();
      const summary = ownerPoolStore.getDynamicUnitsSummary();
      res.json({ units, summary });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/owner-pool/units/:id', (req, res) => {
    try {
      const unit = ownerPoolStore.getUnit(req.params.id);
      if (!unit) return res.status(404).json({ error: 'Unit not found' });
      res.json(unit);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/owner-pool/units', (req, res) => {
    try {
      const unit = ownerPoolStore.saveUnit(req.body);
      res.json(unit);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/owner-pool/units/:id', (req, res) => {
    try {
      const result = ownerPoolStore.deleteUnit(req.params.id);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Policy & Configuration
  app.get('/api/owner-pool/config', (req, res) => {
    try {
      res.json({
        config: ownerPoolStore.getRuleConfig(),
        history: ownerPoolStore.getRuleHistory(),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/owner-pool/config', (req, res) => {
    try {
      const updatedBy = String(req.body.updated_by || req.headers['x-user-name'] || 'Financial Controller');
      const updated = ownerPoolStore.updateRuleConfig(req.body, updatedBy);
      res.json({
        success: true,
        config: updated,
        history: ownerPoolStore.getRuleHistory(),
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Distribution Batches
  app.get('/api/owner-pool/batches', (req, res) => {
    try {
      const batches = ownerPoolStore.getBatches();
      res.json(batches);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/owner-pool/batches/:id', (req, res) => {
    try {
      const batch = ownerPoolStore.getBatch(req.params.id);
      if (!batch) return res.status(404).json({ error: 'Distribution batch not found' });
      res.json(batch);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post(['/api/owner-pool/batches/calculate', '/api/owner-pool/calculate'], (req, res) => {
    try {
      const createdBy = String(req.body.created_by || req.headers['x-user-name'] || 'Financial Controller');
      const batch = ownerPoolStore.calculateMonthlyDistribution({
        period: req.body.period,
        custom_room_revenue: req.body.custom_room_revenue !== undefined ? parseFloat(req.body.custom_room_revenue) : undefined,
        title: req.body.title,
        created_by: createdBy,
      });
      res.json(batch);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/owner-pool/batches/:id/review', (req, res) => {
    try {
      const batch = ownerPoolStore.markBatchInReview(req.params.id);
      res.json(batch);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/owner-pool/batches/:id/approve', (req, res) => {
    try {
      const approver = String(req.body.approver_name || req.headers['x-user-name'] || 'Director of Finance');
      const batch = ownerPoolStore.approveBatch(req.params.id, approver);
      res.json(batch);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/owner-pool/batches/:id/post', async (req, res) => {
    try {
      const postedBy = String(req.body.posted_by || req.headers['x-user-name'] || 'Financial Controller');
      const batch = await ownerPoolStore.postBatch(req.params.id, postedBy);
      res.json(batch);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/owner-pool/batches/:id/reverse', async (req, res) => {
    try {
      const reversedBy = String(req.body.reversed_by || req.headers['x-user-name'] || 'Financial Controller');
      const reason = String(req.body.reason || 'Manual reversal / correction');
      const batch = await ownerPoolStore.reverseBatch(req.params.id, reversedBy, reason);
      res.json(batch);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Owner Statement
  app.get('/api/owner-pool/statement', (req, res) => {
    try {
      const unitId = String(req.query.unit_id || '');
      const period = req.query.period ? String(req.query.period) : undefined;
      if (!unitId) {
        return res.status(400).json({ error: 'unit_id query parameter is required' });
      }
      const stmt = ownerPoolStore.getOwnerStatement(unitId, period);
      res.json(stmt);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Pak Scott's Executive Owner Matrix API
  app.get('/api/owner-pool/scotts-matrix', (req, res) => {
    try {
      const period = req.query.period ? String(req.query.period) : '2026-09';
      const matrix = ownerPoolStore.getScottExecutiveMatrix(period);
      res.json(matrix);
    } catch (err: any) {
      console.error('[API /api/owner-pool/scotts-matrix error]:', err);
      res.status(500).json({ error: err.message || 'Failed to generate Scott executive matrix' });
    }
  });

  // Owner Stays & Quota API
  app.get('/api/owner-pool/stays', (req, res) => {
    try {
      const period = req.query.period ? String(req.query.period) : undefined;
      const stays = ownerPoolStore.getStays(period);
      res.json(stays);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/owner-pool/stays', (req, res) => {
    try {
      const stay = ownerPoolStore.recordStay(req.body);
      res.json(stay);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // --- APARTMENT OWNER RETURN DISTRIBUTION EMAIL AUTOMATION API ROUTES ---

  // 1. Get Email Configuration & Template
  app.get('/api/owner-pool/email-config', (req, res) => {
    try {
      res.json(ownerEmailStore.getConfig());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 2. Update Email Configuration & Template
  app.post('/api/owner-pool/email-config', (req, res) => {
    try {
      const updatedBy = String(req.body.updated_by || req.headers['x-user-name'] || 'Financial Controller');
      const updated = ownerEmailStore.updateConfig(req.body, updatedBy);
      res.json({ success: true, config: updated });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // 3. Get Batch Email Drafts (Allows seeing draft of email for each investor)
  app.get('/api/owner-pool/email-drafts', (req, res) => {
    try {
      const batchId = req.query.batch_id ? String(req.query.batch_id) : undefined;
      const period = req.query.period ? String(req.query.period) : '2026-09';
      const drafts = ownerEmailStore.getBatchDrafts(batchId, period);
      res.json(drafts);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 4. Update & Save Email Draft (Allows editing draft of email)
  app.post('/api/owner-pool/email-drafts/:id', (req, res) => {
    try {
      const draft = ownerEmailStore.saveDraft(req.params.id, req.body);
      res.json({ success: true, draft });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // 5. Reset Draft to Default Template
  app.post('/api/owner-pool/email-drafts/:id/reset', (req, res) => {
    try {
      ownerEmailStore.resetDraft(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // 6. Send Single Email Draft (or test preview to user)
  app.post('/api/owner-pool/email-drafts/:id/send', async (req, res) => {
    try {
      const sentBy = String(req.body.sent_by || req.headers['x-user-name'] || 'Financial Controller');
      const testEmail = req.body.test_email ? String(req.body.test_email) : undefined;
      const result = await ownerEmailStore.sendSingleEmail(req.params.id, sentBy, testEmail);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // 7. ONE BUTTON TO EMAIL ALL INVESTORS
  app.post('/api/owner-pool/email-all', async (req, res) => {
    try {
      const period = String(req.body.period || '2026-09');
      const sentBy = String(req.body.sent_by || req.headers['x-user-name'] || 'Financial Controller');
      const unitIds = Array.isArray(req.body.unit_ids) ? req.body.unit_ids : undefined;
      const testOverride = req.body.test_email ? String(req.body.test_email) : undefined;

      const batchResult = await ownerEmailStore.sendBatchEmails(period, sentBy, {
        unitIds,
        testRecipientOverride: testOverride,
      });

      res.json({
        success: true,
        message: `Successfully emailed ${batchResult.successful_count} investors for period ${period}.`,
        result: batchResult,
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // 7b. Test SMTP Connection
  app.post('/api/owner-pool/email-test-connection', async (req, res) => {
    try {
      const result = await ownerEmailStore.testSmtpConnection(req.body.smtp);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // 8. Email Dispatch Logs & Delivery Audit History
  app.get('/api/owner-pool/email-dispatches', (req, res) => {
    try {
      const period = req.query.period ? String(req.query.period) : undefined;
      const logs = ownerEmailStore.getDispatchLogs(period);
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 9. Clear Email Logs
  app.delete('/api/owner-pool/email-dispatches', (req, res) => {
    try {
      const period = req.query.period ? String(req.query.period) : undefined;
      const result = ownerEmailStore.clearDispatchLogs(period);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 10. Document Attachment Preview / Download Content
  app.get('/api/owner-pool/document-preview', (req, res) => {
    try {
      const docType = String(req.query.doc_type || 'STATEMENT_PDF');
      const unitId = String(req.query.unit_id || '');
      const period = String(req.query.period || '2026-09');

      if (!unitId) {
        return res.status(400).json({ error: 'unit_id is required' });
      }

      const doc = ownerEmailStore.renderDocumentContent(docType, unitId, period);
      res.setHeader('Content-Type', doc.contentType);
      res.setHeader('Content-Disposition', `inline; filename="${doc.filename}"`);
      res.send(doc.content);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- TAX MODULE ENDPOINTS ---

  // 1. Tax Settings / Rules
  app.get('/api/tax/rules', (req, res) => {
    try {
      const rules = taxStore.getTaxRules();
      res.json(rules);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/tax/rules/:code', (req, res) => {
    try {
      const taxCode = req.params.code as any;
      const user = String(req.headers['x-user-name'] || req.body.updated_by || 'Financial Controller');
      const updated = taxStore.updateTaxRule(taxCode, req.body, user);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/tax/rules', (req, res) => {
    try {
      const user = String(req.headers['x-user-name'] || req.body.updated_by || 'Financial Controller');
      const created = taxStore.createTaxRule(req.body, user);
      res.status(201).json(created);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/tax/rules/:code', (req, res) => {
    try {
      const result = taxStore.deleteTaxRule(req.params.code);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // 2. Tax Overview / Summary KPIs
  app.get('/api/tax/summary', (req, res) => {
    try {
      const period = String(req.query.period || '2026-09');
      const summary = taxStore.getPeriodSummaryKPIs(period);
      res.json(summary);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 3. Tax Obligations
  app.get('/api/tax/obligations', (req, res) => {
    try {
      const period = String(req.query.period || '2026-09');
      const obligations = taxStore.getObligationsForPeriod(period);
      res.json(obligations);
    } catch (err: any) {
      console.error('[API /api/tax/obligations error]:', err);
      res.status(500).json({ error: err.message || 'Failed to fetch tax obligations' });
    }
  });

  app.post('/api/tax/calculate', (req, res) => {
    try {
      const { period, tax_code } = req.body;
      if (!period || !tax_code) {
        return res.status(400).json({ error: 'period and tax_code are required' });
      }
      const user = String(req.headers['x-user-name'] || req.body.user || 'Financial Controller');
      const calculated = taxStore.calculateObligation(period, tax_code, user);
      res.json(calculated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // 4. Tax Payment & Filing Recording
  app.post('/api/tax/payment', (req, res) => {
    try {
      const { period, tax_code, payment_date, ntpn_reference, amount, payment_bank_account } = req.body;
      const user = String(req.headers['x-user-name'] || req.body.user || 'Financial Controller');
      const item = taxStore.recordPayment({
        period,
        tax_code,
        payment_date,
        ntpn_reference,
        amount: Number(amount),
        payment_bank_account,
        user,
      });
      res.json(item);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/tax/filing', (req, res) => {
    try {
      const { period, tax_code, filing_date, bpe_reference } = req.body;
      const user = String(req.headers['x-user-name'] || req.body.user || 'Financial Controller');
      const item = taxStore.recordFiling({
        period,
        tax_code,
        filing_date,
        bpe_reference,
        user,
      });
      res.json(item);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // 5. Tax Supporting Documents
  app.post('/api/tax/documents', (req, res) => {
    try {
      const { period, tax_code, doc_type, file_name, file_url, notes } = req.body;
      const user = String(req.headers['x-user-name'] || req.body.user || 'Financial Controller');
      const doc = taxStore.attachDocument({
        period,
        tax_code,
        doc_type,
        file_name,
        file_url,
        notes,
        user,
      });
      res.json(doc);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // 6. Tax Reconciliation
  app.get('/api/tax/reconciliation', (req, res) => {
    try {
      const period = String(req.query.period || '2026-09');
      const recons = taxStore.getReconciliationForPeriod(period);
      res.json(recons);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 7. Tax Period Close Validation & Action
  app.get('/api/tax/period-close-check', (req, res) => {
    try {
      const period = String(req.query.period || '2026-09');
      const validation = taxStore.validatePeriodClose(period);
      res.json(validation);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/tax/period-close', (req, res) => {
    try {
      const { period, notes } = req.body;
      const user = String(req.headers['x-user-name'] || req.body.user || 'Financial Controller');
      const result = taxStore.closePeriod(period, user, notes);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/tax/period-reopen', (req, res) => {
    try {
      const { period } = req.body;
      const user = String(req.headers['x-user-name'] || req.body.user || 'Financial Controller');
      const result = taxStore.reopenPeriod(period, user);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // --- KAS KECIL OPERASIONAL (OPERATIONAL PETTY CASH) API ROUTES ---

  app.get('/api/petty-cash/balance', (req, res) => {
    try {
      const balance = pettyCashStore.getBalanceSummary();
      res.json(balance);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/petty-cash/transactions', (req, res) => {
    try {
      const txs = pettyCashStore.getTransactions();
      res.json(txs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/petty-cash/transactions', (req, res) => {
    try {
      const createdBy = String(req.headers['x-user-name'] || req.body.created_by || 'Cashier / Admin');
      const tx = pettyCashStore.addTransaction({
        ...req.body,
        created_by: createdBy,
      });
      res.json(tx);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/petty-cash/transactions/:id', (req, res) => {
    try {
      const result = pettyCashStore.deleteTransaction(req.params.id);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/petty-cash/replenish', async (req, res) => {
    try {
      const approvedBy = String(req.headers['x-user-name'] || req.body.approved_by || 'Financial Controller');
      const result = await pettyCashStore.replenish({
        approved_by: approvedBy,
        notes: req.body.notes,
        bank_account_code: req.body.bank_account_code,
      });
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/petty-cash/config', (req, res) => {
    try {
      const updated = pettyCashStore.updateConfig(req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });


  // --- VITE MIDDLEWARE / STATIC ASSETS ---

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Atrium Finance Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
