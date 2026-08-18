const db = require('../src/db/models');

async function fixDuplicateExpenseVouchers() {
  try {
    console.log('🔄 Checking for duplicate expense voucher numbers...');
    const allExpenses = await db.Expense.find({}).sort({ createdAt: 1 }).lean();
    const seen = new Set();
    let fixedCount = 0;

    const prefixMap = {
      'Elite Edition': 'EE-EXP-',
      'Elite Fabtex': 'EF-EXP-',
      'Elite Stitching': 'ES-EXP-',
      'Elite Online': 'EO-EXP-',
      'Elite Digital Print': 'EDP-EXP-'
    };

    for (const exp of allExpenses) {
      let vNo = exp.voucherNo;
      if (!vNo || seen.has(vNo)) {
        const companyEntity = exp.companyEntity || 'Elite Digital Print';
        const prefix = prefixMap[companyEntity] || 'EDP-EXP-';
        
        let counter = 1001;
        let newVoucher = `${prefix}${counter}`;
        while (seen.has(newVoucher) || (await db.Expense.exists({ _id: { $ne: exp._id }, voucherNo: newVoucher }))) {
          counter++;
          newVoucher = `${prefix}${counter}`;
        }

        await db.Expense.updateOne({ _id: exp._id }, { $set: { voucherNo: newVoucher } });
        console.log(`Fixed Expense #${exp._id}: Old "${vNo}" -> New "${newVoucher}"`);
        seen.add(newVoucher);
        fixedCount++;
      } else {
        seen.add(vNo);
      }
    }

    console.log(`✅ Duplicate Expense Voucher Fix Completed! Cleaned ${fixedCount} records.`);
  } catch (err) {
    console.error('❌ Error fixing duplicate expense vouchers:', err.message);
  } finally {
    process.exit(0);
  }
}

fixDuplicateExpenseVouchers();
