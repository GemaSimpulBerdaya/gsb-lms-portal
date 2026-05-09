const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://gsb:gsb123@gsb-lms.wk8sgsr.mongodb.net/GSB_LMS?appName=gsb-lms";

async function run() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('GSB_LMS');
    
    console.log("=== USERS DARI KOLEKSI 'relawans' ===");
    const relawans = await db.collection('relawans').find({}).toArray();
    relawans.forEach(u => {
      console.log(`- Email: ${u.email} | Role: ${u.role || 'RELAWAN'} | Nama: ${u.name || u.teamName || '-'}`);
    });

    console.log("\n=== USERS DARI KOLEKSI 'users' ===");
    const users = await db.collection('users').find({}).toArray();
    if (users.length === 0) console.log("Tidak ada data.");
    users.forEach(u => {
      console.log(`- Email: ${u.email} | Role: ${u.role || '-'} | Nama: ${u.name || '-'}`);
    });

  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

run();
