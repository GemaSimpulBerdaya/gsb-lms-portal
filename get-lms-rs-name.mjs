
import { MongoClient } from 'mongodb';

async function getReplicaSetName() {
  const shard = "ac-t4awnre-shard-00-00.wk8sgsr.mongodb.net:27017";
  const user = "gsb";
  const pass = "gsb123";
  const uri = `mongodb://${user}:${pass}@${shard}/?authSource=admin&ssl=true`;
  
  const client = new MongoClient(uri);

  try {
    console.log('Connecting to LMS shard directly to get RS name...');
    await client.connect();
    const isMaster = await client.db('admin').command({ isMaster: 1 });
    console.log('LMS ReplicaSet Name:', isMaster.setName);
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.close();
  }
}

getReplicaSetName();
