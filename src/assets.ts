/**
 * 이미지 애셋을 웹이 서빙할 수 있는 자리에 놓는다.
 *
 * 애셋 4,737개(204 MB)는 `data/assets/` 에 있고 저장소에 커밋하지 않는다
 * (`docs/01-data-source.md` 7절). Next.js 는 `public/` 아래만 정적으로 내보내므로
 * 그 자리를 만들어 줘야 한다.
 *
 * **복사가 아니라 링크를 먼저 시도한다.** 204 MB 를 두 벌 두면 원본과 사본이
 * 어긋날 수 있고, 스냅샷을 다시 받을 때마다 같은 양을 다시 쓴다.
 * 링크를 만들 수 없는 환경에서만 복사로 물러난다.
 */
import {
	cpSync,
	existsSync,
	lstatSync,
	mkdirSync,
	readlinkSync,
	rmSync,
	symlinkSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { ROOT, DATA } from './io.js';

const SOURCE = join(DATA, 'assets');
const PUBLIC = join(ROOT, 'public');
const TARGET = join(PUBLIC, 'assets');

function alreadyLinked(): boolean {
	if (!existsSync(TARGET)) return false;
	const stat = lstatSync(TARGET);
	if (!stat.isSymbolicLink()) return false;
	return resolve(PUBLIC, readlinkSync(TARGET)) === resolve(SOURCE);
}

function main(): void {
	if (!existsSync(SOURCE)) {
		console.error(`애셋이 없다: ${SOURCE}`);
		console.error('`npm run fetch -- --assets` 로 먼저 받아야 한다.');
		process.exit(1);
	}

	mkdirSync(PUBLIC, { recursive: true });

	if (alreadyLinked()) {
		console.log(`이미 연결되어 있다: public/assets → ${SOURCE}`);
		return;
	}

	if (existsSync(TARGET)) rmSync(TARGET, { recursive: true, force: true });

	// 'junction' 은 Windows 에서 관리자 권한 없이 디렉토리를 잇는다. 다른 OS 는 이 인자를 무시한다.
	try {
		symlinkSync(SOURCE, TARGET, 'junction');
		console.log(`연결했다: public/assets → ${SOURCE}`);
		return;
	} catch (error) {
		console.warn(`링크 실패 — 복사로 물러난다: ${(error as Error).message}`);
	}

	cpSync(SOURCE, TARGET, { recursive: true });
	console.log(`복사했다: public/assets (${SOURCE} 의 사본)`);
}

main();
