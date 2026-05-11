
import { MongoClient } from 'mongodb';

async function testConnection() {
  // LMS URI from .env
  const uri = "mongodb+srv://gsb:gsb123@gsb-lms.wk8sgsr.mongodb.net/GSB_LMS?retryWrites=true&w=majority&appName=gsb-lms";
  
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });

  try {
    console.log('Testing LMS MongoDB connection...');
    await client.connect();
    console.log('Successfully connected to LMS MongoDB!');
    const databases = await client.db().admin().listDatabases();
    console.log('Databases:', databases.databases.map(db => db.name));
  } catch (error) {
    console.error('LMS Connection Failed:', error.message);
  } finally {
    await client.close();
  }
}

testConnection();
