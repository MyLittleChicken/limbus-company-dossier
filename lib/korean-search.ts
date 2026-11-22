/** Match names during Korean IME composition without changing the stored/displayed text. */
const INITIALS=[...'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'];
const VOWELS=[...'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ'];
const FINALS=['ㄱ','ㄲ','ㄱㅅ','ㄴ','ㄴㅈ','ㄴㅎ','ㄷ','ㄹ','ㄹㄱ','ㄹㅁ','ㄹㅂ','ㄹㅅ','ㄹㅌ','ㄹㅍ','ㄹㅎ','ㅁ','ㅂ','ㅂㅅ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
function normalized(value:string):string{return value.normalize('NFKC').toLocaleLowerCase().replace(/\s+/gu,'');}
function jamo(value:string):string {
 return [...normalized(value).normalize('NFD')].map(c=>{const n=c.codePointAt(0)!;return INITIALS[n-0x1100]??VOWELS[n-0x1161]??FINALS[n-0x11a8]??c}).join('');
}
function initials(value:string):string {
 return [...normalized(value)].map(c=>{const n=c.codePointAt(0)!;return n>=0xac00&&n<=0xd7a3?INITIALS[Math.floor((n-0xac00)/588)]:jamo(c)}).join('');
}
export function createKoreanMatcher(query:string):(value:string|null|undefined)=>boolean {
 const needle=jamo(query);
 if(!needle)return ()=>false;
 const initialOnly=/^[ㄱ-ㅎ]+$/.test(needle);
 return value=>!!value&&(initialOnly?initials(value):jamo(value)).includes(needle);
}

/** One composed character, or at least two initial consonants. */
export function canSearch(value:string):boolean {
 const q=value.normalize('NFC').replace(/\s+/gu,'');
 if(!q)return false;
 const parts=jamo(q);
 if(/^[ㄱ-ㅎ]+$/.test(parts))return [...parts].length>=2;
 return /[가-힣\p{L}\p{N}]/u.test(q.replace(/[\u1100-\u11ff\u3130-\u318f]/g,''));
}
