# ⛳ 골프 조 편성기

스마트폰 앱처럼 설치해서 사용할 수 있는 골프 동호회 조 편성기입니다.

## 기능
- 👥 회원 관리 (닉네임, 실명, 성별, 전화 뒷자리, 슬로우 플레이어)
- 🏌️ 조 편성 (남/여 균형 · 슬로우 분리 · 최근 3개월 동일팀 회피)
- ✋ 드래그로 팀원 이동
- 📋 편성 이력 저장 및 조회
- 📲 PWA - 홈 화면에 설치 가능 (오프라인 사용 가능)

---

## 🚀 무료 배포 방법 (GitHub Pages)

### 1단계 - GitHub 계정 만들기
https://github.com 에서 무료 가입

### 2단계 - 새 저장소 만들기
1. GitHub 로그인 후 우측 상단 **+** → **New repository**
2. Repository name: `golf-app` (또는 원하는 이름)
3. **Public** 선택 ✓
4. **Create repository** 클릭

### 3단계 - 파일 업로드
1. 저장소 메인 페이지에서 **uploading an existing file** 클릭
2. 이 폴더의 파일을 모두 드래그 업로드:
   - `index.html`
   - `app.js`
   - `manifest.json`
   - `sw.js`
   - `icons/` 폴더 (icon-192.png, icon-512.png)
   - `.github/workflows/deploy.yml`
3. **Commit changes** 클릭

### 4단계 - GitHub Pages 활성화
1. 저장소 상단 **Settings** 탭 클릭
2. 왼쪽 메뉴 **Pages** 클릭
3. Source: **GitHub Actions** 선택
4. 잠시 기다리면 자동 배포 완료!

### 5단계 - URL 확인
`https://[내GitHub아이디].github.io/golf-app/`

예시: `https://mygolfclub.github.io/golf-app/`

---

## 📲 스마트폰에 설치하기

### 아이폰 (Safari)
1. Safari에서 URL 접속
2. 하단 **공유** 버튼(□↑) 탭
3. **홈 화면에 추가** 탭
4. **추가** 탭

### 안드로이드 (Chrome)
1. Chrome에서 URL 접속
2. 상단 점 3개 메뉴 탭
3. **앱 설치** 또는 **홈 화면에 추가** 탭

---

## 💡 팁
- 데이터는 각 기기의 로컬 저장소에 저장됩니다
- 회원 데이터는 **내보내기** 기능으로 백업 후 다른 기기에서 **가져오기** 가능
- 인터넷 없이도 사용 가능 (오프라인 PWA)
