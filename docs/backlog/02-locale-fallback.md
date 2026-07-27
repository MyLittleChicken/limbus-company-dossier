# 한국어 폴백이 화면에 표기되지 않는다

> 상태: 미착수 / 확인 2026-07-27
> ADR-03 5절이 요구한 폴백 표기가 한 번도 발동하지 않는다. 원인은 웹이 아니라 파이프라인이다.

## 1. 증상

한국어 상세 페이지 867쪽 전부에서 폴백 표기(`EN`)가 **0건**이다. 목록·용어·던전·층에서도 0이다.
그런데 한국어 화면에 영문이 실제로 노출되는 항목은 존재한다.

## 2. 원인

한국어가 없을 때 **`ko` 행에 영문을 채워 넣는다.** 같은 패턴이 6곳이다.

| 파일 | 코드 | 대상 |
| --- | --- | --- |
| `src/entities/basics.ts:154` | `name: korean ?? id` | 소속 |
| `src/entities/basics.ts:95` | `name: ko ?? v.name` | 키워드 |
| `src/entities/skills.ts:327` | `mjLevel?.nameKo ?? merged.name` | 스킬 이름 |
| `src/entities/skills.ts:329` | `mjLevel?.descKo ?? merged.desc` | 스킬 설명 |
| `src/entities/skills.ts:398,400` | `mjPassive?.nameKo ?? entry.name` | 패시브 |
| `src/text.ts:166` | `terms[key]?.nameKo ?? en` | 발동 시점 표기 |

결과로 모든 표시 문자열 테이블의 `ko` 와 `en` 행 수가 정확히 같다.

```
skill_stage_text  2386 / 2386      gift_text          673 / 673
affiliation_text    93 / 93        skill_coin_text   5118 / 5118
```

`lib/locale.ts` 의 `pickLocale` 은 요청 로케일의 행이 없을 때 영어로 물러나며 그 사실을 함께 돌려준다.
그런데 `ko` 행이 언제나 존재하므로 폴백 판정이 성립하지 않는다.

## 3. 파이프라인은 알고 있으나 남기지 않는다

`src/entities/skills.ts:330-337` 이 그 지점이다.

```ts
// 한국어가 없으면 정본의 영문이 그대로 나간다(ADR-03 5절). 결손이므로 눈에 보이게 남긴다.
if (locale === 'ko' && !mjLevel?.nameKo) {
    ctx.report.note('스킬 이름 한국어 없음(영문 유지)', String(skillId), `동기화 ${uptie}`);
}
stageText.push({ skillId, uptie, locale, name: stripMarkup(rawName), ... });
```

리포트에는 남기고 데이터베이스에는 남기지 않는다. 소비 측이 알 방법이 없다.

## 4. 어긋나는 문서

- **ADR-03 5절** — "폴백이 발생한 항목은 그 사실을 소비 측이 알 수 있어야 한다.
  한국어 화면에 영문이 섞이는 것은 결손의 결과이지 설계 의도가 아니다."
- **02-data-model 6절** — "없는 표기를 만들어내지 않는다." 한국어 칸에 영문을 채우는 것은
  없는 표기를 만든 것에 가깝다.

## 5. 영향 범위 — 28행

| 대상 | 규모 | 실제 값 |
| --- | ---: | --- |
| 소속 | 7종 | `Base Identity` · `Butler` · `Great Sister` · `L Corp.` · `Le Sette Famiglie` · `Pequod Captain` · `Sottocapo` |
| 스킬 이름 | 3종 8행 | 1021207 `Ascendant Heishou - Mao Technique: Cloudsplitting Manifestation` (동기화 3·4) · 1101205 `Payback with Interest` (1–4) · 1101206 `Write 'em all down` (3·4) |
| 코인 설명 | 3종 18행 | 같은 스킬 3종. 한 문장 안에서 한국어와 영어가 섞인다 — `[적중시] Inflict 2 출혈`, `At 4+ Reson. that includes this Skill, deal +10% damage` |

코인 설명이 가장 눈에 띈다. 치환표가 `출혈` · `파열` · `[적중시]` 는 한국어로 바꾸는데
문장의 골격(`Inflict`, `At … deal … damage`)은 영문 원문 그대로다.

노출 빈도는 행 수보다 높다. `Base Identity` 와 `L Corp.` 은 인격 수십 명이 달고 있어
한국어 화면 어디서나 보인다.

## 6. 적재 후에는 복원할 수 없다

데이터베이스만으로는 어느 항목이 폴백이었는지 가려낼 수 없다. `ko = en` 인 소속 행을 세면
12종이 잡히는데 `LCB` · `L Corp.` 처럼 한국어 표기가 원래 영문인 것이 섞여 있기 때문이다.
실제 폴백은 7종이며, 그 사실은 변환기 리포트에만 있고 그마저 개수만 세고 id 는 남기지 않는다
(`src/entities/basics.ts:150` 의 `missingKo += 1`).

## 7. 지금 미루는 이유

**텍스트 자체는 보인다.** 못 보는 데이터가 아니라 구분 표기가 없는 것이다.
2단계 성공 기준("데이터 전체를 웹에서 조회·검색")에는 걸리지 않는다.

## 8. 고치는 법

**한국어가 없으면 `ko` 행을 만들지 않는다.** 웹의 `pickLocale` 이 이미
`ko 없음 → en 사용 + 폴백 표시` 로 처리하도록 되어 있어 **웹 코드 수정 없이** 표기가 살아난다.
어느 출처에도 이름이 없는 3종(`1090704` · `1100804` · `1100904`)과도 자연스럽게 구분된다 —
그쪽은 두 로케일 모두 없으므로 `pickLocale` 이 `null` 을 돌려준다.

파이프라인 6곳을 고치고 `convert` → `load` 를 다시 돌린다. 마이그레이션은 없다.
