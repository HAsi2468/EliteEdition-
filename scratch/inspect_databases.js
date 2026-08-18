const { MongoClient } = require('mongodb');

const uri1 = "mongodb+srv://Elite_edition:Elite_edition6070@cluster0.h38kxpm.mongodb.net/elite_edition?retryWrites=true&w=majority";
const uri2 = "mongodb+srv://parth6070_db_user:76YmHfYkBeAdXscH@eliteedition.qq3aqjz.mongodb.net/elite_edition?retryWrites=true&w=majority&appName=EliteEdition";
const localUri = "mongodb://127.0.0.1:27017/elite_edition";

async function inspectDb(name, uri) {
  console.log(`\n================ Inspecting ${name} ================`);
  try {
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db();
    const collections = await db.listCollections().toArray();
    console.log(`Connected! Found ${collections.length} collections.`);
    for (const col of collections) {
      const count = await db.collection(col.name).countDocuments();
      console.log(` - ${col.name.padEnd(30)} : ${count} documents`);
    }
    await client.close();
  } catch (err) {
    console.error(`Error inspecting ${name}:`, err.message);
  }
}

async function run() {
  await inspectDb('URI 1 (Cluster0)', uri1);
  await inspectDb('URI 2 (EliteEdition Alt)', uri2);
  await inspectDb('Local DB (127.0.0.1:27017)', localUri);
}

run();
