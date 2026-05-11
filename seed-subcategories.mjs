
import mongoose from 'mongoose';
import { SubCategory } from './src/models/SubCategory';

const MONGODB_LMS_URI="mongodb://gsb:gsb123@ac-t4awnre-shard-00-00.wk8sgsr.mongodb.net:27017,ac-t4awnre-shard-00-01.wk8sgsr.mongodb.net:27017,ac-t4awnre-shard-00-02.wk8sgsr.mongodb.net:27017/GSB_LMS?ssl=true&replicaSet=atlas-ep3qmd-shard-0&authSource=admin";

const initialData = [
  // SNBT
  { name: 'Matematika', type: 'SNBT', parentLabel: 'SMA / SNBT', order: 1 },
  { name: 'IPA', type: 'SNBT', parentLabel: 'SMA / SNBT', order: 2 },
  { name: 'IPS', type: 'SNBT', parentLabel: 'SMA / SNBT', order: 3 },
  { name: 'Bahasa Indonesia', type: 'SNBT', parentLabel: 'SMA / SNBT', order: 4 },
  { name: 'Bahasa Inggris', type: 'SNBT', parentLabel: 'SMA / SNBT', order: 5 },
  
  // SD
  { name: 'Kelas 1', type: 'OFFLINE', parentLabel: 'Sekolah Dasar (SD)', order: 1 },
  { name: 'Kelas 2', type: 'OFFLINE', parentLabel: 'Sekolah Dasar (SD)', order: 2 },
  { name: 'Kelas 3', type: 'OFFLINE', parentLabel: 'Sekolah Dasar (SD)', order: 3 },
  { name: 'Kelas 4', type: 'OFFLINE', parentLabel: 'Sekolah Dasar (SD)', order: 4 },
  { name: 'Kelas 5', type: 'OFFLINE', parentLabel: 'Sekolah Dasar (SD)', order: 5 },
  { name: 'Kelas 6', type: 'OFFLINE', parentLabel: 'Sekolah Dasar (SD)', order: 6 },
  
  // SMP
  { name: 'Kelas 7', type: 'OFFLINE', parentLabel: 'Sekolah Menengah (SMP)', order: 7 },
  { name: 'Kelas 8', type: 'OFFLINE', parentLabel: 'Sekolah Menengah (SMP)', order: 8 },
  { name: 'Kelas 9', type: 'OFFLINE', parentLabel: 'Sekolah Menengah (SMP)', order: 9 },
  
  // Others
  { name: 'TK', type: 'OFFLINE', parentLabel: 'Lainnya', order: 10 },
  { name: 'DISABILITAS', type: 'OFFLINE', parentLabel: 'Lainnya', order: 11 },
  { name: 'SD', type: 'OFFLINE', parentLabel: 'Lainnya', order: 12 },
  { name: 'SMP', type: 'OFFLINE', parentLabel: 'Lainnya', order: 13 },
];

async function seed() {
  try {
    await mongoose.connect(MONGODB_LMS_URI);
    console.log('Connected to DB');
    
    // Clear existing
    await SubCategory.deleteMany({});
    console.log('Cleared existing subcategories');
    
    // Insert new
    await SubCategory.insertMany(initialData);
    console.log('Successfully seeded subcategories!');
    
  } catch (err) {
    console.error('Error seeding:', err);
  } finally {
    await mongoose.connection.close();
  }
}

seed();
