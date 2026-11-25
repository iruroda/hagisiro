# 테스트 도구 (개발용, 배포 안 됨)
- 서버: `python3 -m http.server 8765` (저장소 루트)
- fakefb/: 가짜 Firebase 모듈(app/auth/fs). Playwright에서 gstatic 주소를 route로 이 파일들로 대체 → 로그인 상태 테스트. 패턴: `page.route(url, lambda r,_q=None,f=f: r.fulfill(path=f, content_type="text/javascript"))`
- 크롬: `/usr/bin/google-chrome --no-sandbox`, 접속 `http://localhost:8765/index.html?widget=1`
- icon-path-gen.py: 둥근 다각형 SVG 경로 생성기(수화기 대칭 아이콘용)
- example-playwright-test.py: 테스트 스크립트 예시
- shots/: 스크린샷·동작 확인용 Playwright 스크립트 (서버 포트 8770 기준, `python3 -m http.server 8770`을 저장소 루트에서 실행). mkshot.py = 가짜 Firebase로 로그인된 앱 화면(시계 2026-05-13 고정, 시드 데이터 포함) 캡처 · tourtest.py = 첫 안내(출결) 동작 확인 · att.py = 소개 페이지 출결 예시가 움직일 때 표 위치가 밀리는지 측정 · hero.py = 소개 페이지 첫 그림 PC/모바일 캡처 · bookshot.py = 학생 상담 신청 화면 캡처. 출력은 /tmp/sb/shots/ 로 가정하고 있어서 경로는 환경에 맞게 바꿔 쓸 것.
