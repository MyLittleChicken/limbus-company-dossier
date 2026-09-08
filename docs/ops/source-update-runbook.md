# 인격·E.G.O 원본 갱신 운영

이 문서는 현재 구현의 운영 제약과 실행 예시를 정의한다. 최종 검수에서 726개 테스트(0 skip), typecheck 통과, 9,886건 upsert(신규·기존 변경), 원본 신규 3건과 이미지 19건을 확인했다. 재실행은 upsert 0/delete 0/이미지 변경 0이었고 114개 테이블 digest와 동시 실행 차단도 검증했다.

대상은 인격·E.G.O와 본체 종속 스킬·패시브·번역·이미지다. 기프트와 팩은 제외한다. 각 run은 durable staging에 원본, source HEAD, manifest 체크섬을 보관한다. 원본에서 사라진 행은 자동 삭제하지 않고 보고한다.

`--staging`은 run별 후보 경로이고, `--database-url` 또는 `.env`의 `DATABASE_URL`은 실제 적용 DB다. `STAGING_DATABASE_URL`을 live 적용 주소로 사용하지 않는다. 원본 raw는 staged manifest에 보존하며 기존 `data/manifest`는 baseline으로 유지한다.

```sh
npm run update:run -- --collect --staging var/updates/<run-id> --database-url "$DATABASE_URL" --apply
```

이미지는 DB transaction보다 먼저 atomic 게시한다. 게시 시 `asset-journal.jsonl`에 기록하고 변경 대상 원본을 backup한다. 이후 DB transaction이 실패하면 게시된 이미지가 남을 수 있다. journal/backup은 필요할 때 수동으로 이전 이미지를 복구하는 자료이며, 재실행 자체가 backup을 복원하지는 않는다. 재실행은 신규 업데이트를 완료하기 위한 절차다. 적용은 검증된 변경만 transaction upsert/sync하고 실패 시 rollback한다. live schema rename, `TRUNCATE`, 전체 DB 교체는 금지한다. CLI 전체 run은 `limbus-source-update-run` advisory lock을 사용하고, 적용 transaction은 별도로 `limbus-source-update` lock을 사용한다. 둘 다 PostgreSQL 잠금이며 디렉터리 lock이 아니다.

예약 예시(OS에는 등록하지 않음):

```cron
17 3 * * 2 cd /srv/limbus && npm run update:run -- --collect --apply
```

운영은 단일 대상 DB, 단일 filesystem 게시 경로, 단일 writer를 전제로 한다. `.env`는 npm 실행 시 자동으로 읽히며 `DATABASE_URL`을 제공한다. 원본 raw는 staged manifest에 보존하고 초기 스냅샷은 `var/updates/2026-09-08-initial`에 보존한다. 운영 전 source별 동일 snapshot, manifest 체크섬, 필수 이름·참조·null/undefined ID·이미지, 부모→자식 FK 순서, 실제 변경 집계, 실패 후 기존 서비스 조회 가능 여부를 확인한다. 통합 테스트는 별도 audit DB만 사용하며 사용자 DB·볼륨은 변경하지 않는다. OS 스케줄 등록은 이 문서 범위에 포함하지 않는다.
