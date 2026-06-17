const mongoose = require('mongoose');
const uri = 'mongodb+srv://Elite_edition:Elite_edition6070@cluster0.h38kxpm.mongodb.net/elite_edition?retryWrites=true&w=majority';

async function run() {
  try {
    await mongoose.connect(uri);
    const stats = await mongoose.connection.db.stats();
    console.log(JSON.stringify(stats, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    mongoose.disconnect();
  }
}
run();
