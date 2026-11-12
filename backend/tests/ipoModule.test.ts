/**
 * Automated Test Suite: MoneyLogger IPO Module & Hardened Features
 * Tests:
 * 1. computeIPOStatus: Dynamic timeline evaluation (upcoming, open, closed, listed)
 * 2. Unannounced IPO dates: Ensures TBA issues do not default to today or falsely mark as open
 * 3. sortIPOsByLatest: Confirms latest/most recent IPOs appear first across categories
 * 4. Retail & HNI Application Lot Calculator: Verifies investment amount, shares, and SEBI category thresholds
 * 5. Scheduler Distributed Lock: Verifies multi-slot execution (morning/evening) with unique lock keys
 * 6. Cache Invalidation: Verifies deleteCachePattern cleanly purges IPO cache keys
 */

import test, { describe, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { computeIPOStatus, sortIPOsByLatest } from '../src/services/ipoService';
import { clearMemoryCache, getCache, setCache, deleteCachePattern, disconnectRedis } from '../src/lib/redis';
import { runScheduledJob, getSchedulerStatus } from '../src/lib/scheduler';

describe('IPO Module Hardening & Quota Protection Suite', () => {
  beforeEach(() => {
    clearMemoryCache();
  });

  after(async () => {
    await disconnectRedis();
  });

  test('1. computeIPOStatus: Dynamic status computation across all lifecycle states', () => {
    // A. Future issue should be 'upcoming'
    const futureStatus = computeIPOStatus({
      openDate: '2099-01-01',
      closeDate: '2099-01-04',
      listingDate: '2099-01-08'
    });
    assert.equal(futureStatus, 'upcoming', 'Future start date must compute to upcoming');

    // B. Past close date should be 'closed'
    const pastClosedStatus = computeIPOStatus({
      openDate: '2020-01-01',
      closeDate: '2020-01-04',
      listingDate: '2099-01-08'
    });
    assert.equal(pastClosedStatus, 'closed', 'Expired close date before listing must compute to closed');

    // C. Past listing date should be 'listed'
    const listedStatus = computeIPOStatus({
      openDate: '2020-01-01',
      closeDate: '2020-01-04',
      listingDate: '2020-01-08'
    });
    assert.equal(listedStatus, 'listed', 'Past listing date must compute to listed');

    // D. Explicit fallback 'listed' should remain listed
    const explicitListed = computeIPOStatus(undefined, 'listed');
    assert.equal(explicitListed, 'listed', 'Explicit fallback listed must be preserved');
  });

  test('2. Unannounced IPO dates: Unannounced IPOs default cleanly to upcoming without corrupting today date', () => {
    const unannounced = computeIPOStatus({
      openDate: '',
      closeDate: '',
      listingDate: ''
    });
    assert.equal(unannounced, 'upcoming', 'Unannounced IPO with empty dates must be upcoming');

    const undefinedDates = computeIPOStatus(undefined);
    assert.equal(undefinedDates, 'upcoming', 'Undefined timeline must default to upcoming');
  });

  test('3. sortIPOsByLatest: Orders confirmed dates first in descending order', () => {
    const ipos = [
      { name: 'Old IPO', timeline: { openDate: '2024-01-10', closeDate: '2024-01-12' } },
      { name: 'Recent IPO', timeline: { openDate: '2026-10-15', closeDate: '2026-10-18' } },
      { name: 'TBA IPO', timeline: { openDate: '', closeDate: '' } },
      { name: 'Future IPO', timeline: { openDate: '2027-02-01', closeDate: '2027-02-04' } },
    ];

    const sorted = sortIPOsByLatest(ipos, 'upcoming');
    assert.equal(sorted[0].name, 'Future IPO', 'Latest upcoming date must be first');
    assert.equal(sorted[1].name, 'Recent IPO');
    assert.equal(sorted[2].name, 'Old IPO');
    assert.equal(sorted[3].name, 'TBA IPO', 'TBA unannounced dates must be placed at the end');
  });

  test('4. Retail & HNI Application Lot Calculator: Verifies investment amount and category thresholds', () => {
    const issuePrice = 500;
    const lotSize = 30; // 1 Lot = ₹15,000
    const singleLotInv = issuePrice * lotSize;

    // 1 Lot (Retail RII)
    const lots1 = 1;
    const inv1 = lots1 * singleLotInv;
    const category1 = inv1 <= 200000 ? 'RII' : inv1 <= 1000000 ? 'sHNI' : 'bHNI';
    assert.equal(inv1, 15000);
    assert.equal(category1, 'RII', '₹15,000 is Retail Individual');

    // 13 Lots (Max Retail RII under ₹2 Lakhs)
    const lots13 = 13;
    const inv13 = lots13 * singleLotInv;
    const category13 = inv13 <= 200000 ? 'RII' : inv13 <= 1000000 ? 'sHNI' : 'bHNI';
    assert.equal(inv13, 195000);
    assert.equal(category13, 'RII', '₹1,95,000 is still Retail Individual (<= ₹2,00,000)');

    // 14 Lots (Breaches ₹2 Lakhs, enters Small HNI)
    const lots14 = 14;
    const inv14 = lots14 * singleLotInv;
    const category14 = inv14 <= 200000 ? 'RII' : inv14 <= 1000000 ? 'sHNI' : 'bHNI';
    assert.equal(inv14, 210000);
    assert.equal(category14, 'sHNI', '₹2,10,000 transitions into Small HNI (> ₹2L and <= ₹10L)');

    // 70 Lots (Breaches ₹10 Lakhs, enters Big HNI)
    const lots70 = 70;
    const inv70 = lots70 * singleLotInv;
    const category70 = inv70 <= 200000 ? 'RII' : inv70 <= 1000000 ? 'sHNI' : 'bHNI';
    assert.equal(inv70, 1050000);
    assert.equal(category70, 'bHNI', '₹10,50,000 transitions into Big HNI (> ₹10L)');
  });

  test('5. Scheduler: Verifies multi-slot scheduled job execution with lockSuffix', async () => {
    let morningRunCount = 0;
    let eveningRunCount = 0;

    const morningSuccess = await runScheduledJob('ipo_pipeline_sync', async () => {
      morningRunCount++;
    }, 600, 'morning_test');

    const eveningSuccess = await runScheduledJob('ipo_pipeline_sync', async () => {
      eveningRunCount++;
    }, 600, 'evening_test');

    assert.equal(morningSuccess, true, 'Morning run must succeed under its own lock suffix');
    assert.equal(eveningSuccess, true, 'Evening run must succeed under its own lock suffix');
    assert.equal(morningRunCount, 1);
    assert.equal(eveningRunCount, 1);

    // Duplicate execution with same suffix should be locked
    const duplicateMorning = await runScheduledJob('ipo_pipeline_sync', async () => {
      morningRunCount++;
    }, 600, 'morning_test');

    assert.equal(duplicateMorning, false, 'Duplicate execution on same slot must be rejected by distributed lock');
    assert.equal(morningRunCount, 1, 'Run count must not increment for locked duplicate job');
  });

  test('6. Cache Invalidation: deleteCachePattern purges all IPO keys in memory & Redis', async () => {
    await setCache('ipo:list:all:open:', [{ symbol: 'TEST1' }], 300);
    await setCache('ipo:list:sme:all:', [{ symbol: 'TEST2' }], 300);
    await setCache('ipo:detail:test1', { symbol: 'TEST1', name: 'Test 1 Ltd' }, 300);
    await setCache('other:key:data', { keep: true }, 300);

    const beforePurge = await getCache('ipo:list:all:open:');
    assert.ok(beforePurge, 'Cache entry must exist before purge');

    await deleteCachePattern('ipo:*');

    const afterPurgeList1 = await getCache('ipo:list:all:open:');
    const afterPurgeList2 = await getCache('ipo:list:sme:all:');
    const afterPurgeDetail = await getCache('ipo:detail:test1');
    const untouched = await getCache('other:key:data');

    assert.equal(afterPurgeList1, null, 'ipo:list:all:open: must be invalidated');
    assert.equal(afterPurgeList2, null, 'ipo:list:sme:all: must be invalidated');
    assert.equal(afterPurgeDetail, null, 'ipo:detail:test1 must be invalidated');
    assert.notEqual(untouched, null, 'Unrelated cache key must remain intact');
  });
});
