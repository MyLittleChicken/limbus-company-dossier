import {test} from 'node:test';import assert from 'node:assert/strict';import {createKoreanMatcher} from './korean-search';
test('one character, unfinished final syllables and consonant initials find Wedge Office',()=>{
 for(const q of ['쐐','쐑','쐐깃','쐐기','쐐기사무소','ㅆ','ㅆㄱ','ㅆㄱㅅㅁㅅ','쐐ㄱ'])assert(createKoreanMatcher(q)('쐐기 사무소 해결사'),q);
});
test('whitespace, case and canonically equivalent Hangul',()=>{
 assert(createKoreanMatcher('WEDGEoffice')('Wedge Office'));assert(createKoreanMatcher('쐐기'.normalize('NFD'))('쐐기 사무소'));assert(createKoreanMatcher(' ㅆ ㄱ ')('쐐기 사무소'));
});
test('empty input and unrelated syllables do not match',()=>{
 for(const q of ['', '   ','쐐깁','ㄴㄷ','쐐기사무소없는글'])assert.equal(createKoreanMatcher(q)('쐐기 사무소 해결사'),false,q);
});

test('live search requires two initials or one complete character',async()=>{
 const {canSearch}=await import('./korean-search');
 for(const q of ['', ' ', 'ㄱ', 'ㅆ', 'ㅏ', 'ᄀ'])assert.equal(canSearch(q),false,q);
 for(const q of ['ㅆㄱ','ㄱ ㄴ','쐐','쐑','쐐깃','쐐ㄱ','a','1'])assert.equal(canSearch(q),true,q);
});
