import type { NextConfig } from 'next';

/**
 * 결정 근거는 docs/adr/05-web-serving.md 에 있다.
 *
 * 사전 렌더를 쓰지 않으므로(3.2) 프레임워크가 조용히 응답을 고정하지 않게 하는 것이
 * 구현의 책임이다(7절). 라우트 단위 강제는 app/[locale]/layout.tsx 가 맡는다.
 */
const config: NextConfig = {
	// 이미지 애셋은 저장소에 없다. `npm run fetch -- --assets` 로 받아 public/assets 에 배치한다
	// (docs/adr/05-web-serving.md 5절). 로컬 파일이므로 원격 도메인을 열지 않는다.
	images: {
		remotePatterns: [],
	},
};

export default config;
