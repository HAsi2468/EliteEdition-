const db = require('../src/db/models');

async function resetExpenseData() {
  try {
    console.log('🧹 Clearing all expense records from MongoDB...');
    const result = await db.Expense.deleteMany({});
    console.log(`✅ Cleared ${result.deletedCount} expense records. Sequence reset to EDP-EXP-1001!`);
  } catch (err) {
    console.error('❌ Error resetting expense records:', err.message);
  } finally {
    process.exit(0);
  }
}

resetExpenseData();
