import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import prisma from '../lib/prisma';
import { getFundDetailsFromIndianAPI, upsertFundToDatabase } from '../services/indianApiService';

// Top verified Indian mutual fund schemes across major AMCs and categories
const TARGET_FUNDS = [
  'Quant Small Cap Fund',
  'Quant Mid Cap Fund',
  'Quant ELSS Tax Saver Fund',
  'Parag Parikh Flexi Cap Fund',
  'Nippon India Small Cap Fund',
  'Tata Small Cap Fund',
  'Tata Digital India Fund',
  'UTI Nifty 50 Index Fund',
  'Mirae Asset ELSS Tax Saver Fund',
  'SBI Balanced Advantage Fund',
  'SBI Small Cap Fund',
  'SBI Contra Fund',
  'SBI Liquid Fund',
  'ICICI Prudential Multi Asset Allocation Fund',
  'ICICI Prudential Value Fund',
  'ICICI Prudential Large & Mid Cap Fund',
  'Motilal Oswal Midcap Fund',
  'Kotak Small Cap Fund',
  'Axis Small Cap Fund'
];

async function seed() {
  console.log('🌱 Starting Mutual Funds PostgreSQL Seeder with IndianAPI (100% Live)...');

  let successCount = 0;
  for (const fundName of TARGET_FUNDS) {
    try {
      console.log(`📡 Fetching live data from IndianAPI for: "${fundName}"...`);
      const apiDetail = await getFundDetailsFromIndianAPI(fundName);

      if (apiDetail && apiDetail.basic_info && apiDetail.nav_info) {
        await upsertFundToDatabase(apiDetail);
        successCount++;
        console.log(`✅ Successfully saved real API data for: ${fundName}`);
      } else {
        console.warn(`⚠️ IndianAPI did not return valid details for: "${fundName}"`);
      }
    } catch (err: any) {
      console.error(`❌ Error fetching/saving ${fundName}:`, err.message);
    }
  }

  const count = await prisma.mutualFund.count();
  console.log(`\n🎉 Mutual Funds Seeding Completed! Ingested ${successCount} live funds. Total in DB: ${count} funds.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error('Fatal seed error:', err);
  process.exit(1);
});
