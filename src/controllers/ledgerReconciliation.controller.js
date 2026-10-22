const ledgerReconciliationService = require('../services/ledgerReconciliation.service');
const xaiService = require('../services/xai.service');
const LedgerReconciliation = require('../db/models/ledgerReconciliation.model');
const logger = require('../config/logger');

/**
 * Get party list (customers or vendors)
 */
async function getParties(req, res) {
  try {
    const { partyType = 'customer', search = '' } = req.query;
    const parties = await ledgerReconciliationService.getPartiesList({
      partyType,
      search,
      tenantId: req.user?.tenantId,
      companyEntity: req.user?.companyEntity || req.query.companyEntity
    });
    return res.status(200).json({ success: true, parties });
  } catch (error) {
    logger.error('Error fetching parties for reconciliation:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Get ERP Ledger for specific party
 */
async function getErpLedger(req, res) {
  try {
    const { partyType = 'customer', partyName, partyId, startDate, endDate } = req.query;
    if (!partyName) {
      return res.status(400).json({ success: false, message: 'partyName is required' });
    }

    const erpTransactions = await ledgerReconciliationService.fetchErpTransactions({
      partyType,
      partyName,
      partyId,
      startDate,
      endDate,
      companyEntity: req.user?.companyEntity || req.query.companyEntity
    });

    const totalDebit = erpTransactions.reduce((acc, t) => acc + (t.debit || 0), 0);
    const totalCredit = erpTransactions.reduce((acc, t) => acc + (t.credit || 0), 0);
    const closingBalance = totalDebit - totalCredit;

    return res.status(200).json({
      success: true,
      partyName,
      partyType,
      totalDebit,
      totalCredit,
      closingBalance,
      transactions: erpTransactions
    });
  } catch (error) {
    logger.error('Error fetching ERP ledger:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Parse Statement Document via xAI Grok Vision/Text
 */
async function parseStatement(req, res) {
  try {
    const { rawText, imageBase64, partyType, partyName } = req.body;

    if (!rawText && !imageBase64) {
      return res.status(400).json({ success: false, message: 'Either rawText or imageBase64 is required' });
    }

    const parsedData = await xaiService.parseStatementDocument({
      rawText,
      imageBase64,
      partyType,
      partyName
    });

    return res.status(200).json({
      success: true,
      parsedData
    });
  } catch (error) {
    logger.error('Error parsing statement via Grok:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Run Automated 3-Way Reconciliation
 */
async function runReconciliation(req, res) {
  try {
    const {
      partyType = 'customer',
      partyName,
      partyId,
      statementItems = [],
      statementOpeningBalance = 0,
      statementClosingBalance = 0,
      startDate,
      endDate
    } = req.body;

    if (!partyName) {
      return res.status(400).json({ success: false, message: 'partyName is required' });
    }

    // 1. Fetch internal ERP transactions
    const erpTransactions = await ledgerReconciliationService.fetchErpTransactions({
      partyType,
      partyName,
      partyId,
      startDate,
      endDate,
      companyEntity: req.user?.companyEntity
    });

    // 2. Run matching engine
    const matchResults = ledgerReconciliationService.reconcileTransactions(
      statementItems,
      erpTransactions,
      partyType
    );

    // 3. Compute balances
    const erpDebit = erpTransactions.reduce((acc, t) => acc + (t.debit || 0), 0);
    const erpCredit = erpTransactions.reduce((acc, t) => acc + (t.credit || 0), 0);
    const erpClosing = erpDebit - erpCredit;
    const stmtClosing = Number(statementClosingBalance) || 0;
    const variance = erpClosing - stmtClosing;

    return res.status(200).json({
      success: true,
      summary: {
        partyName,
        partyType,
        erpTransactionsCount: erpTransactions.length,
        statementTransactionsCount: statementItems.length,
        erpClosingBalance: erpClosing,
        statementClosingBalance: stmtClosing,
        variance,
        matchedCount: matchResults.matchedItems.length,
        probableCount: matchResults.probableItems.length,
        discrepantCount: matchResults.discrepantItems.length,
        unmatchedStatementCount: matchResults.unmatchedStatementItems.length,
        unmatchedErpCount: matchResults.unmatchedErpItems.length
      },
      ...matchResults
    });
  } catch (error) {
    logger.error('Error executing reconciliation:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Deep Forensic Audit via Grok Reasoning AI
 */
async function aiAuditDiscrepancies(req, res) {
  try {
    const {
      partyName,
      partyType = 'customer',
      erpClosingBalance = 0,
      statementClosingBalance = 0,
      variance = 0,
      unmatchedStatementItems = [],
      unmatchedErpItems = [],
      discrepantItems = []
    } = req.body;

    const auditReport = await xaiService.investigateDiscrepancies({
      partyName,
      partyType,
      erpClosingBalance,
      statementClosingBalance,
      variance,
      unmatchedStatementItems,
      unmatchedErpItems,
      discrepantItems
    });

    return res.status(200).json({
      success: true,
      auditReport
    });
  } catch (error) {
    logger.error('Error running Grok AI audit:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Generate WhatsApp Settlement Notice
 */
async function generateSettlementNotice(req, res) {
  try {
    const {
      partyName,
      partyType = 'customer',
      agreedBalance,
      variance,
      disputedItems,
      tone
    } = req.body;

    const notice = await xaiService.generateSettlementNotice({
      partyName,
      partyType,
      agreedBalance,
      variance,
      disputedItems,
      tone
    });

    return res.status(200).json({
      success: true,
      notice
    });
  } catch (error) {
    logger.error('Error drafting settlement notice:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Grok Financial Copilot Chat
 */
async function copilotChat(req, res) {
  try {
    const { query, conversationHistory = [], erpContext = {} } = req.body;
    if (!query) {
      return res.status(400).json({ success: false, message: 'query is required' });
    }

    const response = await xaiService.copilotChat({
      query,
      conversationHistory,
      erpContext
    });

    return res.status(200).json({
      success: true,
      reply: response.content,
      model: response.model
    });
  } catch (error) {
    logger.error('Error in Grok financial copilot:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Save Reconciliation Session
 */
async function saveSession(req, res) {
  try {
    const sessionData = req.body;
    sessionData.tenantId = req.user?.tenantId || 'default';
    sessionData.companyEntity = req.user?.companyEntity || sessionData.companyEntity;
    sessionData.createdBy = req.user?.name || req.user?.email || 'User';

    const saved = await LedgerReconciliation.create(sessionData);
    return res.status(201).json({ success: true, session: saved });
  } catch (error) {
    logger.error('Error saving reconciliation session:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Get Saved Sessions History
 */
async function getSessionsHistory(req, res) {
  try {
    const query = {};
    if (req.user?.companyEntity) query.companyEntity = req.user.companyEntity;

    const sessions = await LedgerReconciliation.find(query)
      .select('partyName partyType periodStart periodEnd variance status createdAt erpClosingBalance statementClosingBalance')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return res.status(200).json({ success: true, sessions });
  } catch (error) {
    logger.error('Error fetching sessions history:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  getParties,
  getErpLedger,
  parseStatement,
  runReconciliation,
  aiAuditDiscrepancies,
  generateSettlementNotice,
  copilotChat,
  saveSession,
  getSessionsHistory
};
