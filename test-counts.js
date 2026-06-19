const { MongoClient } = require('mongodb');
const uri = "mongodb+srv://Elite_edition:Elite_edition6070@cluster0.h38kxpm.mongodb.net/elite_edition?retryWrites=true&w=majority";

async function run() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('elite_edition');
    
    const dStart = new Date("2026-06-18T00:00:00.000Z");
    const dEnd = new Date("2026-06-18T23:59:59.999Z");
    
    const oldC = await db.collection('sales_list').countDocuments({ orderDate: { $gte: dStart, $lte: dEnd } });
    const newC = await db.collection('sale_orders').countDocuments({ orderDate: { $gte: dStart, $lte: dEnd } });
    
    console.log(`SalesList count: ${oldC}`);
    console.log(`SaleOrder count: ${newC}`);
  } finally {
    await client.close();
  }
}
run().catch(console.dir);
