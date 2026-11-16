const db = require('../db/models');
const logger = require('../config/logger');
const { normalizeImageUrl } = require('../utils/imageUrlHelper');
const { invalidateBooksLockCache } = require('../utils/booksLockGuard');

const ROLE_TEMPLATES = {
  Accountant: ['dashboard', 'billing', 'expense', 'ledger', 'reports', 'gst', 'invoices', 'challan'],
  Designer: ['dashboard', 'jobcards_sample', 'designer_screen', 'jobcards_catalogue', 'communication'],
  Dispatch: ['dashboard', 'inventory', 'scan_pack', 'challan', 'elite_online', 'communication'],
  Sales: ['dashboard', 'sales', 'billing', 'invoices', 'customer_profiles', 'communication'],
  Manager: ['dashboard', 'inventory', 'billing', 'expense', 'ledger', 'reports', 'sales', 'jobcards_catalogue', 'task_management', 'communication'],
};

function isAdminReq(req) {
  const u = req.user || {};
  const roleStr = String(u.role || '').toLowerCase();
  const uname = String(u.username || '').toLowerCase();
  return Boolean(
    u.isMainAdmin ||
    u.isAdmin === true ||
    roleStr === 'admin' ||
    roleStr === 'master_admin' ||
    roleStr === 'master' ||
    uname === 'admin' ||
    uname === 'master'
  );
}

async function getAdminSettingDoc() {
  if (!db.PrintConfig) return null;
  return db.PrintConfig.findOne({ key: 'admin_control_settings' }).lean().catch(() => null);
}

async function saveAdminSettingPatch(patch) {
  if (!db.PrintConfig) return null;
  const existing = await db.PrintConfig.findOne({ key: 'admin_control_settings' });
  const nextVal = { ...(existing?.value || {}), ...patch, updatedAt: new Date().toISOString() };
  if (existing) {
    existing.value = nextVal;
    await existing.save();
    return existing.value;
  }
  const created = await db.PrintConfig.create({ key: 'admin_control_settings', value: nextVal });
  return created.value;
}

const getOverview = async (req, res) => {
  try {
    if (!isAdminReq(req)) {
      return res.status(403).json({ error: 'Admin access required.' });
    }

    const now = new Date();
    const [
      userCount,
      inventoryCount,
      designCount,
      pendingSamples,
      overdueTasks,
      recentUsers,
      settingsDoc,
      expenseCount,
      invoiceCount,
      chatMsgCount,
    ] = await Promise.all([
      db.User ? db.User.countDocuments({}).catch(() => 0) : 0,
      db.Inventory ? db.Inventory.countDocuments({}).catch(() => 0) : 0,
      db.Design ? db.Design.countDocuments({}).catch(() => 0) : 0,
      db.DesignerTask
        ? db.DesignerTask.find({
            isCatalogUploaded: { $ne: true },
            status: { $nin: ['Approved', 'Rejected', 'Cancelled'] },
          })
            .sort({ createdAt: -1 })
            .limit(25)
            .lean()
            .catch(() => [])
        : [],
      db.Task
        ? db.Task.find({
            status: { $nin: ['Completed', 'Done', 'Cancelled'] },
            dueDate: { $lt: now },
          })
            .sort({ dueDate: 1 })
            .limit(20)
            .select('title status priority dueDate assignedToName department companyEntity')
            .lean()
            .catch(() => [])
        : [],
      db.User
        ? db.User.find({})
            .sort({ updatedAt: -1 })
            .limit(12)
            .select('name username role companyEntity isActive lastLoginAt updatedAt')
            .lean()
            .catch(() => [])
        : [],
      getAdminSettingDoc(),
      db.Expense ? db.Expense.countDocuments({}).catch(() => 0) : 0,
      db.BillingInvoice ? db.BillingInvoice.countDocuments({}).catch(() => 0) : 0,
      db.ChatMessage ? db.ChatMessage.countDocuments({}).catch(() => 0) : 0,
    ]);

    const mem = process.memoryUsage();
    return res.json({
      success: true,
      data: {
        systemHealth: {
          uptimeSeconds: Math.floor(process.uptime()),
          rssMb: Math.round(mem.rss / 1024 / 1024),
          heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
          nodeVersion: process.version,
          counts: {
            users: userCount,
            inventory: inventoryCount,
            designs: designCount,
            expenses: expenseCount,
            invoices: invoiceCount,
            chatMessages: chatMsgCount,
          },
        },
        pendingSamples,
        overdueTasks,
        recentUsers,
        roleTemplates: Object.keys(ROLE_TEMPLATES),
        settings: settingsDoc?.value || {
          booksLockDate: '',
          gstApiProvider: 'gstincheck',
          lastBroadcast: null,
        },
      },
    });
  } catch (err) {
    logger.error('adminControl.getOverview error: %o', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
};

const approveSampleDesign = async (req, res) => {
  try {
    if (!isAdminReq(req)) return res.status(403).json({ error: 'Admin access required.' });
    const { taskId } = req.params;
    const task = await db.DesignerTask.findById(taskId);
    if (!task) return res.status(404).json({ error: 'Sample design not found.' });

    const designName = String(req.body?.designName || task.designNo || task.designName || `ED-${Date.now().toString().slice(-4)}`).trim();
    let createdDesign = await db.Design.findOne({ designName }).lean();
    if (!createdDesign) {
      createdDesign = await db.Design.create({
        designName,
        category: task.category || 'ALLOWER',
        fabricName: task.fabricName || '',
        colourMatching: task.colourMatching || '',
        colors: task.colors || '',
        parties: Array.isArray(task.parties) ? task.parties : (task.party ? [task.party] : []),
        party: task.party || '',
        imageUrl: normalizeImageUrl(task.imageUrl || task.finalDesignImage || '', designName),
        imageUrl2: normalizeImageUrl(task.imageUrl2 || '', `${designName}-2`),
        notes: task.notes || '',
        status: 'Active',
        department: task.department || 'digital_print',
      });
    }

    task.isCatalogUploaded = true;
    task.catalogDesignId = String(createdDesign._id);
    task.status = 'Approved';
    task.finalDesignStatus = 'Approved';
    await task.save();

    return res.json({ success: true, design: createdDesign, task });
  } catch (err) {
    logger.error('adminControl.approveSampleDesign error: %o', err);
    return res.status(500).json({ error: err.message || 'Failed to approve sample design' });
  }
};

const rejectSampleDesign = async (req, res) => {
  try {
    if (!isAdminReq(req)) return res.status(403).json({ error: 'Admin access required.' });
    const { taskId } = req.params;
    const task = await db.DesignerTask.findById(taskId);
    if (!task) return res.status(404).json({ error: 'Sample design not found.' });
    task.status = 'Rejected';
    task.finalDesignStatus = 'Rejected';
    if (req.body?.reason) {
      task.notes = `${task.notes ? task.notes + '\n' : ''}[Admin Review]: ${String(req.body.reason).trim()}`;
    }
    await task.save();
    return res.json({ success: true, task });
  } catch (err) {
    logger.error('adminControl.rejectSampleDesign error: %o', err);
    return res.status(500).json({ error: err.message || 'Failed to reject sample design' });
  }
};

const triggerSync = async (req, res) => {
  try {
    if (!isAdminReq(req)) return res.status(403).json({ error: 'Admin access required.' });
    const { runCatalogAndImageSync } = require('../services/catalogImageSync.service');
    setImmediate(() => {
      runCatalogAndImageSync({ triggerSource: 'MANUAL' }).catch((e) => {
        logger.error('[AdminControl] Manual catalog sync error: %o', e);
      });
    });
    return res.json({ success: true, message: 'Catalog & Uniware image sync started in background.' });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to start sync' });
  }
};

const saveBooksLock = async (req, res) => {
  try {
    if (!isAdminReq(req)) return res.status(403).json({ error: 'Admin access required.' });
    const { booksLockDate = '', gstApiProvider = 'gstincheck' } = req.body || {};
    const saved = await saveAdminSettingPatch({
      booksLockDate: String(booksLockDate).trim(),
      gstApiProvider: String(gstApiProvider).trim(),
    });
    invalidateBooksLockCache();
    return res.json({ success: true, data: saved });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to save lock settings' });
  }
};

const sendBroadcast = async (req, res) => {
  try {
    if (!isAdminReq(req)) return res.status(403).json({ error: 'Admin access required.' });
    const { title = 'Admin Announcement', message = '', targetCompany = 'ALL' } = req.body || {};
    if (!String(message).trim()) {
      return res.status(400).json({ error: 'Broadcast message is required.' });
    }
    const payload = {
      title: String(title).trim(),
      message: String(message).trim(),
      targetCompany: String(targetCompany).trim() || 'ALL',
      sentBy: req.user?.name || req.user?.username || 'Admin',
      sentAt: new Date().toISOString(),
    };
    await saveAdminSettingPatch({ lastBroadcast: payload });
    const io = req.app?.get('io');
    if (io) {
      io.emit('admin_broadcast', payload);
    }
    return res.json({ success: true, data: payload });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to send broadcast' });
  }
};

const applyRoleTemplate = async (req, res) => {
  try {
    if (!isAdminReq(req)) return res.status(403).json({ error: 'Admin access required.' });
    const { userId, templateName } = req.body || {};
    const perms = ROLE_TEMPLATES[templateName];
    if (!userId || !perms) {
      return res.status(400).json({ error: 'Valid userId and templateName are required.' });
    }
    const user = await db.User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    user.permissions = perms;
    await user.save();
    return res.json({ success: true, user: { _id: user._id, name: user.name, permissions: user.permissions } });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to apply role template' });
  }
};

const getCompanyFinancials = async (req, res) => {
  try {
    if (!isAdminReq(req)) return res.status(403).json({ error: 'Admin access required.' });
    const [invAgg, expAgg] = await Promise.all([
      db.BillingInvoice
        ? db.BillingInvoice.aggregate([
            {
              $group: {
                _id: { $ifNull: ['$companyEntity', 'Unknown'] },
                invoiceCount: { $sum: 1 },
                totalSales: { $sum: { $ifNull: ['$grandTotal', { $ifNull: ['$totalAmount', 0] }] } },
                totalTax: { $sum: { $ifNull: ['$totalTax', 0] } },
              },
            },
          ]).catch(() => [])
        : [],
      db.Expense
        ? db.Expense.aggregate([
            {
              $match: { entryType: { $nin: ['contra', 'income'] } },
            },
            {
              $group: {
                _id: { $ifNull: ['$companyEntity', 'Unknown'] },
                expenseCount: { $sum: 1 },
                totalExpenses: { $sum: { $ifNull: ['$amount', 0] } },
              },
            },
          ]).catch(() => [])
        : [],
    ]);

    const byCompany = new Map();
    const ensure = (name) => {
      const k = String(name || 'Unknown').trim();
      if (!byCompany.has(k)) {
        byCompany.set(k, { companyEntity: k, invoiceCount: 0, totalSales: 0, totalTax: 0, expenseCount: 0, totalExpenses: 0 });
      }
      return byCompany.get(k);
    };

    invAgg.forEach((r) => {
      const row = ensure(r._id);
      row.invoiceCount += r.invoiceCount || 0;
      row.totalSales += Number(r.totalSales || 0);
      row.totalTax += Number(r.totalTax || 0);
    });
    expAgg.forEach((r) => {
      const row = ensure(r._id);
      row.expenseCount += r.expenseCount || 0;
      row.totalExpenses += Number(r.totalExpenses || 0);
    });

    const rows = Array.from(byCompany.values())
      .map((r) => ({ ...r, netPosition: Number((r.totalSales - r.totalExpenses).toFixed(2)) }))
      .sort((a, b) => b.totalSales - a.totalSales);

    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to compute company financials' });
  }
};

const forceLogoutUser = async (req, res) => {
  try {
    if (!isAdminReq(req)) return res.status(403).json({ error: 'Admin access required.' });
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    const io = req.app?.get('io');
    if (io) {
      io.emit('force_logout', {
        userId: String(userId),
        reason: 'Your session was ended by Master Admin.',
        at: new Date().toISOString(),
      });
    }
    return res.json({ success: true, message: 'Force logout signal sent to user.' });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to force logout user' });
  }
};

const getChatStorage = async (req, res) => {
  try {
    if (!isAdminReq(req)) return res.status(403).json({ error: 'Admin access required.' });
    if (!db.ChatMessage) return res.json({ success: true, data: { totalMessages: 0, mediaMessages: 0, oldMedia90d: 0 } });
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const hasAttCond = { $or: [{ 'attachment.url': { $exists: true, $ne: '' } }, { 'attachments.0': { $exists: true } }] };
    const [totalMessages, mediaMessages, oldMedia90d] = await Promise.all([
      db.ChatMessage.countDocuments({}),
      db.ChatMessage.countDocuments(hasAttCond),
      db.ChatMessage.countDocuments({ ...hasAttCond, createdAt: { $lt: cutoff } }),
    ]);
    return res.json({ success: true, data: { totalMessages, mediaMessages, oldMedia90d } });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to check chat storage' });
  }
};

const cleanupChatStorage = async (req, res) => {
  try {
    if (!isAdminReq(req)) return res.status(403).json({ error: 'Admin access required.' });
    if (!db.ChatMessage) return res.json({ success: true, cleared: 0 });
    const days = Math.max(30, Math.min(365, parseInt(req.body?.days || '90', 10) || 90));
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const result = await db.ChatMessage.updateMany(
      {
        createdAt: { $lt: cutoff },
        $or: [{ 'attachment.url': { $exists: true, $ne: '' } }, { 'attachments.0': { $exists: true } }],
      },
      {
        $unset: { attachment: 1 },
        $set: { attachments: [] },
      }
    );
    return res.json({ success: true, cleared: result.modifiedCount || 0, days });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to clean chat storage' });
  }
};

module.exports = {
  getOverview,
  approveSampleDesign,
  rejectSampleDesign,
  triggerSync,
  saveBooksLock,
  sendBroadcast,
  applyRoleTemplate,
  getCompanyFinancials,
  forceLogoutUser,
  getChatStorage,
  cleanupChatStorage,
};
