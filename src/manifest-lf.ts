/**
 * 매니페스트에 **상류 원본 바이트의 체크섬**(`sha256Lf`)을 채운다.
 *
 * 기존 `sha256` 은 최초 수집이 `core.autocrlf=true` 인 Windows 에서 이루어진 탓에
 * 줄 끝이 CRLF 로 바뀐 로컬 파일의 값이다. 즉 **수집한 기계의 산물**이라 다른 환경에서
 * 재현되지 않는다. 실측으로 확인한 사실은 다음 하나다.
 *
 *     상류 원본 바이트 == 로컬 파일의 CRLF 를 LF 로 되돌린 바이트
 *
 * 그러므로 로컬에서 되돌려 계산한 값을 상류 체크섬으로 쓸 수 있다. 이 값이 정말 상류와
 * 같은지는 `npm run fetch` 가 전수로 증명한다 — 받은 바이트를 이 값과 대조하기 때문이다.
 * 대조 대상을 받은 것에서 만들어 내는 것이 아니라, **받기 전에 로컬에서 독립적으로**
 * 만들어 두고 맞춰 보는 것이므로 자기 확인이 아니다.
 *
 * 한 번 채우면 다시 돌릴 일이 없다. 원본 스냅샷을 새로 수집할 때만 쓴다.
 *
 * 실행: npx tsx src/manifest-lf.ts
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATA, isText, toLf } from './io.js';

interface ManifestFile {
	path: string;
	sha256: string;
	sha256Lf?: string;
}

function main(): void {
	const manifestPath = join(DATA, 'manifest.json');
	const raw = readFileSync(manifestPath, 'utf8');
	const manifest = JSON.parse(raw) as { files: ManifestFile[] };

	let converted = 0;
	let identical = 0;
	let missing = 0;

	for (const file of manifest.files) {
		let bytes: Buffer;
		try {
			bytes = readFileSync(join(DATA, file.path));
		} catch {
			// 로컬에 없는 파일은 기존 값을 그대로 둔다. 지어내지 않는다.
			missing += 1;
			continue;
		}
		if (!isText(bytes)) {
			// 이진 파일은 변환 대상이 아니므로 기존 체크섬이 곧 상류 체크섬이다.
			file.sha256Lf = file.sha256;
			identical += 1;
			continue;
		}
		const lf = toLf(bytes);
		file.sha256Lf = createHash('sha256').update(lf).digest('hex');
		if (lf.length === bytes.length) identical += 1;
		else converted += 1;
	}

	// 들여쓰기를 원본과 맞춘다. 포맷이 달라지면 diff 가 전부 바뀌어 실제 변경이 묻힌다.
	writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
	console.log(`매니페스트 ${manifest.files.length}개 항목`);
	console.log(`  CRLF 를 되돌려 계산 ${converted}`);
	console.log(`  변환이 필요 없던 것 ${identical}`);
	if (missing > 0) console.log(`  로컬에 파일이 없어 건너뜀 ${missing}`);
}

main();
