# 유니 타임즈를 시놀로지 NAS에서 돌리기

가족 모두가 휴대폰·컴퓨터에서 접속할 수 있도록, 집의 시놀로지 NAS에서 24시간 돌리는 방법입니다.
(NAS주소 자리에 우리 NAS의 주소를 넣으세요. 예: 192.168.0.10 또는 Tailscale 주소 100.x.x.x)

## 0. 준비물
- 시놀로지 DSM **7.2 이상**, 패키지 센터에서 **Container Manager** 설치
- NAS 관리자 계정 (DSM에 로그인할 수 있는 계정)
- 이 폴더 `unitimes-nas` (또는 `unitimes-nas.zip`)

## 1. NAS에 폴더 만들기
1. 브라우저에서 `http://NAS주소:5000` (DSM) 로그인
2. **File Station** → `docker` 공유 폴더 안에 **`unitimes`** 폴더 만들기
   - `docker` 공유 폴더는 Container Manager를 설치하면 생겨요. 없으면 제어판 → 공유 폴더에서 만들어요.

## 2. 파일 올리기 (둘 중 편한 방법)
**A. File Station으로 (가장 쉬움)**
1. File Station → `docker/unitimes` 폴더 열기 → **업로드** → `unitimes-nas.zip` 올리기
2. 올린 zip을 오른쪽 클릭 → **압축 풀기 → 여기에 압축 풀기**
3. `docker/unitimes` 바로 안에 `Dockerfile`, `docker-compose.yml`, `server.js`, `public` 폴더가 보이면 성공
   (한 단계 더 들어간 폴더가 생겼다면, 그 안의 파일들을 `docker/unitimes`로 옮겨 주세요. 다 풀었으면 zip 파일은 지워도 돼요)

**B. Mac Finder로**
1. Finder → 이동 → **서버에 연결** (⌘K) → `smb://NAS주소` → NAS 계정으로 로그인
2. `docker` → `unitimes` 폴더에 `unitimes-nas` 폴더 **안의 파일들**을 끌어다 놓기
   - SMB가 꺼져 있으면: DSM 제어판 → 파일 서비스 → SMB 켜기

## 3. 실행
1. **Container Manager** → 왼쪽 **프로젝트** → **생성**
2. 프로젝트 이름: `unitimes`
3. 경로: **`docker/unitimes`** 선택 → "기존 docker-compose.yml 사용" (자동으로 선택돼요)
4. 다음 → (웹 포털 설정은 건너뜀) → 다음 → **완료**
5. 처음에는 이미지를 만드느라 1~3분 걸려요. 상태가 **실행 중**(초록)이 되면 끝
6. 접속: **`http://NAS주소:3000`**
7. 처음 접속하면 **관리자 계정 만들기** 화면이 나와요 → 아빠(관리자) 계정 만들기
   - 우리 가족 기사·생일 자료(`data-seed.json`)는 처음 실행할 때 자동으로 들어가요.
8. 설정 → 가족 계정에서 가족들 계정을 만들어 아이디·임시 비밀번호를 알려 주세요.

> 안 켜지면: Container Manager → 컨테이너 → `unitimes` → **로그**를 보세요.
> "유니 타임즈 서버가 시작되었습니다"가 보이면 정상이에요.

## 4. 가족이 접속하는 방법
`NAS주소`은 **Tailscale** 주소예요. 이 주소는 Tailscale에 들어와 있는 기기에서만 열려요.

| 방법 | 누가 볼 수 있나 | 하는 법 |
|---|---|---|
| **Tailscale (지금 그대로, 가장 안전)** | Tailscale에 초대한 가족 기기만 | 가족 휴대폰에 **Tailscale 앱** 설치 → 같은 Tailscale 계정으로 로그인하거나, 관리 페이지(login.tailscale.com) → Users/Share에서 NAS를 공유 → `http://NAS주소:3000` 접속 |
| **시놀로지 DDNS + 역방향 프록시** | 주소를 아는 누구나 (로그인·가족만 보기로 보호) | 아래 5번 참고. 친척에게 보내는 **‘친척에게 링크 보내기’ 링크**는 이 방법이어야 계정·Tailscale 없는 친척도 열 수 있어요 |
| **Tailscale Funnel** | 주소를 아는 누구나 | NAS의 Tailscale에서 Funnel을 켜 `https://NAS이름.꼬리이름.ts.net` 주소로 공개 (공유기 설정 필요 없음) |

## 5. (선택) 인터넷에 공개하기 — DDNS + 역방향 프록시 + HTTPS
1. 제어판 → 외부 액세스 → **DDNS** → 추가 → 서비스: Synology → 예: `unitimes.synology.me`
2. 제어판 → 보안 → **인증서** → 추가 → Let's Encrypt로 `unitimes.synology.me` 인증서 받기
3. 제어판 → 로그인 포털 → 고급 → **역방향 프록시** → 생성
   - 소스: 프로토콜 `HTTPS`, 호스트 이름 `unitimes.synology.me`, 포트 `443`
   - 대상: 프로토콜 `HTTP`, 호스트 이름 `localhost`, 포트 `3000`
   - 사용자 지정 머리글 → 생성 → **WebSocket** (있어도 되고 없어도 돼요)
4. 집 공유기에서 **443 포트**를 NAS 내부 주소(192.168.x.x)로 포트 포워딩
5. 이제 `https://unitimes.synology.me` 로 어디서나 접속
- **3000 포트를 공유기에서 바로 열지 마세요.** 꼭 HTTPS(443)로만 공개하세요.
- 인터넷에 공개했다면 설정 → 신문 정보 → **가족만 보기**를 켜 두는 걸 추천해요.

## 6. 백업
- 글·일정·사진·자동 백업은 모두 **`docker/unitimes/data`** 폴더에 있어요.
- 유니 타임즈가 매일 새벽 3시 무렵 `data/backups`에 자동 백업을 만들어요 (설정 → 자료 관리).
- 시놀로지 **Hyper Backup**으로 `docker/unitimes/data` 폴더를 외장 하드나 클라우드에 매일 백업하면 더 안전해요.

## 7. 업데이트 (새 버전이 나왔을 때)
1. 새 파일을 `docker/unitimes`에 덮어쓰기 — **`data` 폴더는 절대 지우지 마세요**
2. Container Manager → 프로젝트 → `unitimes` → **작업 → 빌드** (또는 정지 → 빌드) → **시작**
3. 휴대폰에서 한 번 새로 열면 새 화면으로 바뀌어요

## 8. 휴대폰 홈 화면에 추가
- 아이폰: 사파리로 접속 → 공유 → **홈 화면에 추가** (알림을 받으려면 이 아이콘으로 열어야 해요)
- 갤럭시: 크롬으로 접속 → 메뉴(⋮) → **앱 설치** 또는 홈 화면에 추가

## 문제가 생기면
| 증상 | 확인할 것 |
|---|---|
| `http://NAS주소:3000`이 안 열림 | 내 기기에 Tailscale이 켜져 있는지, 컨테이너가 ‘실행 중’인지 |
| 프로젝트 생성 시 빌드 실패 | `docker/unitimes` 바로 안에 `Dockerfile`이 있는지 (한 단계 더 들어가 있지 않은지) |
| 3000 포트가 이미 사용 중 | `docker-compose.yml`의 `"3000:3000"`을 `"3080:3000"`으로 바꾸고 `http://…:3080`으로 접속 |
| 로그에 권한 오류 | 프로젝트를 정지 → 다시 시작 (시작할 때 data 폴더 권한을 자동으로 맞춰요) |
