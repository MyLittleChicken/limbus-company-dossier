-- canonical 의 수동 제약.
--
-- `schema.sql` 은 `prisma migrate diff --from-empty` 산물이라 손으로 못 고치고,
-- Prisma 스키마 언어는 CHECK 를 못 낸다. 그래서 여기 두고 적재기가 마지막에
-- 적용한다 — `views.sql` 과 같은 처지다.
--
-- **파일 하나에 문장 하나다.** Prisma 의 `$executeRawUnsafe` 는 확장 프로토콜을
-- 쓰므로 다중 문장을 못 받는다. 제약을 뷰와 같은 파일에 두면 그 자리에서 깨진다.

-- build_info 는 한 행만 존재한다. 두 행이 생기면 「어느 판이 진짜냐」에 답이 없다.
-- 이미 있으면 넘어간다 — v2:build 는 빈 스키마에 굽지만, 살아있는 DB 에 적재기를
-- 다시 돌리는 경로에서도 안 깨져야 한다.
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		 WHERE conname = 'build_info_single_row'
		   AND conrelid = 'canonical.build_info'::regclass
	) THEN
		ALTER TABLE canonical.build_info
			ADD CONSTRAINT build_info_single_row CHECK (id = 1);
	END IF;
END $$;
