const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://parth6070_db_user:76YmHfYkBeAdXscH@eliteedition.qq3aqjz.mongodb.net/elite_edition_local?retryWrites=true&w=majority&appName=EliteEdition";

async function inspectUsers() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();

  const users = await db.collection('user').find({}).toArray();
  console.log(`Found ${users.length} users in 'user' collection:`);

  users.forEach(u => {
    console.log(` - ID: ${u._id} | Email: ${u.email} | Name: ${u.name} | Role: ${u.role}`);
  });

  await client.close();
}

inspectUsers();
