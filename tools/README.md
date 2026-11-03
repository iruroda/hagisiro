# 테스트 도구 (개발용, 배포 안 됨)
- 서버: `python3 -m http.server 8765` (저장소 루트)
- fakefb/: 가짜 Firebase 모듈(app/auth/fs). Playwright에서 gstatic 주소를 route로 이 파일들로 대체 → 로그인 상태 테스트. 패턴: `page.route(url, lambda r,_q=None,f=f: r.fulfill(path=f, content_type="text/javascript"))`
- 크롬: `/usr/bin/google-chrome --no-sandbox`, 접속 `http://localhost:8765/index.html?widget=1`
- icon-path-gen.py: 둥근 다각형 SVG 경로 생성기(수화기 대칭 아이콘용)
- example-playwright-test.py: 테스트 스크립트 예시
