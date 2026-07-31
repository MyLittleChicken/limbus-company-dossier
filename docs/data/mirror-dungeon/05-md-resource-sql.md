# 회차 5 — `md-resource` 의 `.sql` 2파일

> **DB 스키마** · `md-resource` · **2파일** · 19 KB · 794 + 30 줄
> 출처 `github.com/eldritchtools/limbus-mirror-dungeon-resource` 커밋 `beeb89ea`
> 정리 2026-07-31

## 파일 정체 — **게임 데이터가 아니다**

`data/entities/` 아래 유일한 **`.sql` 파일**이며, 담긴 것은 원본 게임 데이터가 아니라
**다른 도구의 애플리케이션 DB 스키마**다.

```sql
create table public.achievement_progress (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  season_key TEXT NOT NULL,
  progress JSONB NOT NULL DEFAULT '{}'::JSONB,
  …
);
create policy "Users can read own progress" … using (auth.uid() = user_id);
```

`auth.uid()` · RLS 정책 · `public.users` 참조 — **Supabase 스키마**다.

### 의도적 수집이다

```
docs/04-data-inventory.md:21
  md-resource | eldritchtools/limbus-mirror-dungeon-resource | beeb89ea | 151 | 2차 · MD 도구 (DB 스키마)

data/manifest.json:45541
  "path": "entities/mirror-dungeon/md-resource/db__achievements.sql", "source": "md-resource"
```

출처 저장소는 151파일인데 **우리는 2개만 가져왔다.** `manifest.json` 에 경로가 명시돼
있으므로 오염이 아니라 선별이다.

---

## 1. `db__achievements.sql` — 30줄

테이블 1개 · 정책 3개.

```
achievement_progress   user_id · season_key · progress(JSONB) · additional_points · updated_at
정책                    read own · insert own · update own
```

`season_key` 가 회차 3의 `__Season__`(`"7"` · `"6"`)에 대응한다.
`progress` 는 JSONB 자유 형식이며 `jsonb_typeof(progress) = 'object'` 제약이 걸려 있다.

## 2. `db__md_plans.sql` — 794줄

**거울 던전 공략 계획 공유 기능**의 스키마다.

| 테이블 | 뜻 |
| --- | --- |
| `md_plans` | 계획 본문 |
| `md_plan_builds` | 편성(층별) |
| `md_plan_tags` | 태그 |

인덱스 9개 · 정책 7개 · GIN 전문 검색(`search_vector tsvector`)까지 있다.

### `md_plans` 컬럼이 우리 엔티티를 그대로 참조한다

```sql
identity_ids     INT[]     ← 인격
ego_ids          INT[]     ← E.G.O
grace_levels     INT[]     ← 은총 (회차 1의 grace 10종)
keyword_id       INT       ← 기믹/공격 타입
start_gift_ids   INT[]     ← 시작 기프트 (회차 1의 startGiftPool)
observe_gift_ids INT[]
target_gift_ids  INT[]
floors           JSONB
difficulty       TEXT
recommendation_mode TEXT
```

**마스터북이 지금까지 확정한 엔티티가 전부 등장한다.** 다른 도구가 같은 데이터를
어떻게 조합해 쓰는지 보여주는 **소비 방식 참고 자료**다.

`youtube_video_id` · `is_published` · `view_count` · `like_count` · `score` 는
커뮤니티 기능이며 우리 범위 밖이다.

---

## 마스터북에서 갖는 뜻

이 회차는 **원본 필드를 정리하는 회차가 아니다.** 담긴 것이 게임 데이터가 아니기 때문이다.

다만 두 가지를 확인해 준다.

1. **`grace_levels` · `start_gift_ids` 가 배열**이다 — 은총 10종과 시작 기프트 30종을
   조합으로 다루는 것이 실제 도구의 방식이다(회차 1에서 본 구조와 맞는다)
2. **`floors` 가 JSONB** 다 — 층 구조를 정형화하지 않고 자유 형식으로 둔다

`docs/04-data-inventory.md` 가 이 출처를 **「2차 · MD 도구 (DB 스키마)」** 로 분류한 것이
정확하다.

---

## 함정 요약

1. **`.sql` 이다.** `data/entities/` 를 JSON 으로 가정하고 순회하면 파싱이 깨진다
2. **게임 데이터가 아니다.** 원본 필드로 취급하면 안 된다
3. 출처 저장소 151파일 중 **2개만** 가져왔다

## 미해결

없다. 2파일 전부 확정했다.

## 근거 재현

```
data/entities/mirror-dungeon/md-resource/db__achievements.sql    30줄 · 테이블 1
data/entities/mirror-dungeon/md-resource/db__md_plans.sql       794줄 · 테이블 3
data/manifest.json:45541                                        경로 명시
docs/04-data-inventory.md:21                                    출처 분류
```
