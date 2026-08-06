import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/locale';
import { UI } from '@/lib/ui-text';
import { getCounts, getBuildInfo } from '@/lib/queries/canonical/reference';
import { Facts, Panel, SecLabel } from '@/components/ui';

/**
 * 출처 표기와 고지.
 *
 * `01-data-source.md` 7절이 요구하는 항목이다 — 2차 창작물 표시, 출처 크레딧,
 * 기준 버전, 권리 고지. 모든 화면에서 닿을 수 있어야 하므로 푸터가 이 화면을 가리킨다.
 */

const SOURCES = [
	['eldritchtools/limbus-assets', '구조 데이터와 이미지 애셋'],
	['monthofjune/limbus_data', '영·한 병기 정규화 데이터, 팩별 기프트 풀'],
	['x1bViolet/Limbus-Localization-Files', '게임 로컬라이즈 원문 (한국어·영어)'],
] as const;

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
	const { locale } = await params;
	if (!isLocale(locale)) notFound();

	const t = UI[locale];
	const ko = locale === 'ko';
	const [build, counts] = await Promise.all([getBuildInfo(), getCounts()]);

	return (
		<>
			<SecLabel title={t.nav.about} sub={ko ? '출처와 고지' : 'Sources and notices'} />

			<div className="grid2">
				<div>
					<Panel title={ko ? '고지' : 'Notice'}>
						<p>{t.sourceNotice}</p>
						<p>
							{ko
								? 'Limbus Company와 Project Moon의 저작물(게임 데이터·텍스트·이미지·명칭)의 권리는 Project Moon에 있습니다. 이 프로젝트에는 재라이선스 권한이 없습니다.'
								: 'All rights to Limbus Company and Project Moon works — game data, text, images, and names — belong to Project Moon. This project holds no relicensing rights.'}
						</p>
						<p>
							{ko
								? '비영리로 운영하며 서비스로 수익을 얻지 않습니다. 권리자의 요청이 있으면 해당 자료를 제거합니다.'
								: 'Operated non-commercially. Material will be removed at the rights holder’s request.'}
						</p>
					</Panel>

					<Panel title={ko ? '데이터 출처' : 'Data sources'}>
						<ul className="plain">
							{SOURCES.map(([name, role]) => (
								<li key={name}>
									<code className="idcode">{name}</code>
									<span className="absent"> — {role}</span>
								</li>
							))}
						</ul>
						<p className="absent">
							{ko
								? '원본 파일은 재호스팅하지 않습니다. 우리 스키마로 변환한 결과만 사용합니다.'
								: 'Source files are not rehosted. Only our transformed schema is served.'}
						</p>
					</Panel>

					<Panel title={ko ? '알려진 한계' : 'Known limits'}>
						<ul className="plain">
							<li>
								{ko
									? '기프트–팩 관계 10,115행은 대조할 다른 출처가 없습니다. 전체 관계의 81%입니다.'
									: 'The 10,115 gift–pack rows come from a single source with nothing to cross-check against.'}
							</li>
							<li>
								{ko
									? '원본을 게임 클라이언트와 직접 대조한 적은 없습니다. 상류 저장소가 정확히 추출했다는 전제 위에 있습니다.'
									: 'The data has never been checked against the game client directly.'}
							</li>
							<li>
								{ko
									? '한국어가 없어 영문을 노출하는 항목이 있습니다 — 소속 7 · 스킬 이름 3 · 코인 설명 3.'
									: 'Some entries fall back to English: 7 affiliations, 3 skill names, 3 coin descriptions.'}
							</li>
							<li>
								{ko
									? '팩의 기프트 등장 확률은 어느 출처에도 없어 표시하지 않습니다.'
									: 'Gift drop rates are absent from every source and are not shown.'}
							</li>
						</ul>
					</Panel>
				</div>

				<aside>
					<Panel title={ko ? '기준 버전' : 'Dataset'}>
						{build ? (
							<Facts
								rows={[
									[ko ? '게임 버전' : 'Game version', build.gameAnchor ?? '—'],
									[ko ? '거울 던전' : 'Mirror Dungeon', build.mdVersion ?? '—'],
									[ko ? '스냅샷' : 'Snapshot', build.snapshotId],
								]}
							/>
						) : null}
					</Panel>

					<Panel title={ko ? '적재 규모' : 'Loaded rows'}>
						<Facts
							rows={[
								[ko ? '기프트' : 'Gifts', counts.gifts],
								[ko ? '테마 팩' : 'Packs', counts.packs],
								[ko ? '인격' : 'Identities', counts.identities],
								['E.G.O', counts.egos],
								[ko ? '스킬' : 'Skills', counts.skills],
								[ko ? '상태' : 'Statuses', counts.statuses],
								[ko ? '소속' : 'Affiliations', counts.affiliations],
								[ko ? '기프트–팩 관계' : 'Gift–pack rows', counts.relations],
							]}
						/>
					</Panel>

					<Panel title={ko ? '라이선스' : 'License'}>
						<p className="absent">
							{ko
								? '이 서비스의 코드와 문서는 MIT License를 따릅니다. 게임 저작물에는 적용되지 않습니다.'
								: 'The code and documentation are MIT licensed. This does not extend to the game’s works.'}
						</p>
					</Panel>
				</aside>
			</div>
		</>
	);
}
