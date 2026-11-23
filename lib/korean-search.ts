/** Match names during Korean IME composition without changing the stored/displayed text. */
const INITIALS=[...'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'];
const VOWELS=[...'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ'];
const FINALS=['ㄱ','ㄲ','ㄱㅅ','ㄴ','ㄴㅈ','ㄴㅎ','ㄷ','ㄹ','ㄹㄱ','ㄹㅁ','ㄹㅂ','ㄹㅅ','ㄹㅌ','ㄹㅍ','ㄹㅎ','ㅁ','ㅂ','ㅂㅅ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
function normalized(value:string):string{return value.normalize('NFKC').toLocaleLowerCase().replace(/\s+/gu,'');}
/** Lowercased, whitespace-free text with every Hangul syllable split into compatibility jamo. */
export function jamo(value:string):string {
 return [...normalized(value).normalize('NFD')].map(c=>{const n=c.codePointAt(0)!;return INITIALS[n-0x1100]??VOWELS[n-0x1161]??FINALS[n-0x11a8]??c}).join('');
}
/** Like `jamo`, but each complete syllable becomes only its initial consonant. */
export function initials(value:string):string {
 return [...normalized(value)].map(c=>{const n=c.codePointAt(0)!;return n>=0xac00&&n<=0xd7a3?INITIALS[Math.floor((n-0xac00)/588)]:jamo(c)}).join('');
}

/** What a query looks for: its jamo, and whether it is initials only (then values are compared by `initials`). */
function needleOf(query:string):{text:string;initialOnly:boolean}|null {
 const text=jamo(query);
 return text?{text,initialOnly:/^[ㄱ-ㅎ]+$/.test(text)}:null;
}

export function createKoreanMatcher(query:string):(value:string|null|undefined)=>boolean {
 const needle=needleOf(query);
 if(!needle)return ()=>false;
 return value=>!!value&&(needle.initialOnly?initials(value):jamo(value)).includes(needle.text);
}

/**
 * Precomputed keys for a group of texts (one record). Building them once lets a cached corpus
 * answer many queries without re-splitting every text; empty texts are dropped (they never match).
 */
export interface SearchKeys { jamo: string[]; initials: string[] }
export function searchKeys(values:ReadonlyArray<string|null|undefined>):SearchKeys {
 const present=values.filter((v):v is string=>!!v);
 return {jamo:present.map(jamo),initials:present.map(initials)};
}
/** Same verdict as `createKoreanMatcher(query)` applied to any of the texts behind `keys`. */
export function createKeysMatcher(query:string):(keys:SearchKeys)=>boolean {
 const needle=needleOf(query);
 if(!needle)return ()=>false;
 return keys=>(needle.initialOnly?keys.initials:keys.jamo).some(k=>k.includes(needle.text));
}

/** One composed character, or at least two initial consonants. */
export function canSearch(value:string):boolean {
 const q=value.normalize('NFC').replace(/\s+/gu,'');
 if(!q)return false;
 const parts=jamo(q);
 if(/^[ㄱ-ㅎ]+$/.test(parts))return [...parts].length>=2;
 return /[가-힣\p{L}\p{N}]/u.test(q.replace(/[\u1100-\u11ff\u3130-\u318f]/g,''));
}
