const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

const uri = "mongodb+srv://gsb:gsb123@gsb-lms.wk8sgsr.mongodb.net/GSB_LMS?appName=gsb-lms";

async function run() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('GSB_LMS');
    
    // Hash passwords
    const adminHash = await bcrypt.hash("admin123", 10);
    const aditHash = await bcrypt.hash("adit123", 10);

    // Update admin
    const adminRes = await db.collection('relawans').updateOne(
      { email: "admin@gsb.com" },
      { $set: { password: adminHash } }
    );
    console.log(`Password admin@gsb.com diubah menjadi: admin123 (Modified: ${adminRes.modifiedCount})`);

    // Update adit
    const aditRes = await db.collection('relawans').updateOne(
      { email: "adit@gsb.com" },
      { $set: { password: aditHash } }
    );
    console.log(`Password adit@gsb.com diubah menjadi: adit123 (Modified: ${aditRes.modifiedCount})`);

  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

run();
