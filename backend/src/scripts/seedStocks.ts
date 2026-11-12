import prisma from '../lib/prisma';
import { syncAllCuratedStocks, CURATED_STOCK_SYMBOLS } from '../services/stockSyncService';

async function seed() {
  console.log('🌱 Starting Stock Screener Seeder for MoneyLogger...');
  console.log(`Targeting ${CURATED_STOCK_SYMBOLS.length} curated stocks across all sectors.`);

  try {
    const res = await syncAllCuratedStocks(CURATED_STOCK_SYMBOLS);
    console.log('🎉 Seeding completed:', res);

    const totalInDb = await prisma.stock.count();
    console.log(`📊 Total stocks now in PostgreSQL database: ${totalInDb}`);
  } catch (error: any) {
    console.error('❌ Seeding failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
