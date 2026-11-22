import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isActiveEntry,dayInSeoul} from './home-content';
const item={startDate:'2026-11-12',endDate:'2026-11-26'};
test('home shows reviewed entries only within date-only source interval',()=>{
 assert.equal(isActiveEntry(item,'2026-11-22'),true);
 assert.equal(isActiveEntry(item,'2026-11-11'),false);
 assert.equal(isActiveEntry(item,'2026-11-27'),false);
 assert.equal(isActiveEntry(item,'2026-11-26'),true);
 assert.equal(isActiveEntry({...item,endDate:null},'2027-01-01'),true);
 assert.equal(isActiveEntry({...item,startDate:'unknown'},'2026-11-22'),false);
});
test('home uses Korean calendar day at midnight, not server timezone',()=>{
 assert.equal(dayInSeoul(new Date('2026-11-21T15:00:00Z')),'2026-11-22');
});
