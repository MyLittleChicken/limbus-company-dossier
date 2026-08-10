-- canonical 파생 뷰.
--
-- **왜 뷰인가.** 「편성을 넣으면 어느 트리거가 켜지는가」를 애플리케이션 코드가
-- 아니라 데이터 구조가 답해야 한다. 아래 뷰가 인격의 성질을 `trigger_ref` 와
-- **같은 어휘**로 정규화하므로, 판정이 분기 없는 조인 하나가 된다.
--
--   SELECT tr.trigger_id,
--          (SELECT count(DISTINCT ic.identity_id)
--             FROM canonical.v_identity_capability ic
--            WHERE ic.ref_kind = tr.ref_kind AND ic.ref_id = tr.ref_id
--              AND ic.identity_id = ANY($1))
--     FROM canonical.trigger_ref tr
--
-- 새 축·새 특수 상태·새 E.G.O 가 나와도 **행만 늘고 질의는 그대로다.**
--
-- schema.sql 은 `prisma migrate diff --from-empty` 산물이라 손으로 못 고친다.
-- 그래서 뷰는 이 파일에 두고 적재기가 마지막에 적용한다.

-- ── 인격 능력 ────────────────────────────────────────────────
-- `trigger_ref(ref_kind, ref_id)` 와 짝이 맞는 (인격, 종류, 값) 관계.
--
-- identity_axis 갈래만 게이트가 실제 값을 갖는다. `gate_kind <> 'always'` 인
-- 행은 그 조건(에고 장착 · 기프트 보유 · 로스터 인원 · 상태 보유)이 실제로
-- 충족됐을 때만 유효하므로 소비자가 걸러야 한다. 무조건 세면 조건을
-- 충족하지 않은 이상까지 해당 축의 인격이 된다.
--
-- identity_axis 갈래만 `affects` 도 실제 값을 갖는다 — 인격 취급(tag)과
-- 스킬 취급(skill)이 갈리는 자리가 거기뿐이다(예: 10104는 VIBRATION이
-- skill이라 「진동 인격 5인」조건에는 안 들지만 「진동 부여 스킬」조건은
-- 받는다). 나머지 갈래는 그 구분이 없으므로 `both` 로 둔다.
CREATE OR REPLACE VIEW canonical.v_identity_capability AS
        SELECT identity_id, 'axis'::text AS ref_kind, axis_id AS ref_id,
               gate_kind, gate_ref, gate_min, affects
          FROM canonical.identity_axis
  UNION SELECT identity_id, 'association', association_id,
               'always'::text, ''::text, NULL::integer, 'both'::text
          FROM canonical.identity_association
  UNION SELECT identity_id, 'unit_keyword', keyword,
               'always'::text, ''::text, NULL::integer, 'both'::text
          FROM canonical.identity_unit_keyword
  UNION SELECT isk.identity_id, 'sin', lower(s.sin::text),
               'always'::text, ''::text, NULL::integer, 'both'::text
          FROM canonical.identity_skill isk
          JOIN canonical.skill s ON s.id = isk.skill_id
         WHERE s.sin IS NOT NULL
  UNION SELECT isk.identity_id, 'attack_type', lower(s.attack_type::text),
               'always'::text, ''::text, NULL::integer, 'both'::text
          FROM canonical.identity_skill isk
          JOIN canonical.skill s ON s.id = isk.skill_id
         WHERE s.attack_type IS NOT NULL
  UNION SELECT isk.identity_id, 'skill_kind', lower(s.kind::text),
               'always'::text, ''::text, NULL::integer, 'both'::text
          FROM canonical.identity_skill isk
          JOIN canonical.skill s ON s.id = isk.skill_id
         WHERE s.kind IS NOT NULL
  -- 공명은 **공격 스킬**만 센다. 방어·패닉 스킬은 합에 안 들어간다.
  -- 죄악과 같은 근거를 쓰지만 트리거가 다르고(Wrath Skill Used vs Wrath
  -- Resonance) 임계값이 다르므로 별도 종류로 둔다.
  -- `Any Resonance` · `Any Absolute Resonance` 둘은 ref_id 가 비어 있다 —
  -- 죄악별 수의 **최댓값**을 봐야 해서 이 조인으로는 안 닿는다. 평가기 몫이다.
  UNION SELECT isk.identity_id, 'resonance', lower(s.sin::text),
               'always'::text, ''::text, NULL::integer, 'both'::text
          FROM canonical.identity_skill isk
          JOIN canonical.skill s ON s.id = isk.skill_id
         WHERE s.sin IS NOT NULL AND isk.role = 'attack'
  -- 코인 부호는 skill_stage.coin_value 에 있다. skill_coin.type 은
  -- unbreakable/normal 이라 다른 축이다
  UNION SELECT isk.identity_id, 'coin',
               CASE WHEN ss.coin_value > 0 THEN 'plus' ELSE 'minus' END,
               'always'::text, ''::text, NULL::integer, 'both'::text
          FROM canonical.identity_skill isk
          JOIN canonical.skill_stage ss ON ss.skill_id = isk.skill_id
         WHERE ss.coin_value IS NOT NULL AND ss.coin_value <> 0
  UNION SELECT isk.identity_id, 'coin', 'single',
               'always'::text, ''::text, NULL::integer, 'both'::text
          FROM canonical.identity_skill isk
          JOIN (SELECT skill_id, uptie FROM canonical.skill_coin
                 WHERE locale = 'ko' GROUP BY 1, 2 HAVING count(*) = 1) c
            ON c.skill_id = isk.skill_id;
