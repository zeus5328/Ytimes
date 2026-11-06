# 유니 타임즈를 Vercel + Neon으로 인터넷에 올리기

집 컴퓨터나 NAS를 켜 두지 않아도, 가족 누구나 `https://bloombox.co.kr` 같은 주소로 들어올 수 있게 하는 방법입니다.

| 맡는 일 | 서비스 | 요금 |
|---|---|---|
| 화면과 서버 | **Vercel** (서울과 가까운 싱가포르 `sin1`에서 실행) | Hobby(무료)로 충분 |
| 글·일정·계정 자료 | **Neon** Postgres 데이터베이스 | 무료 0.5GB |
| 사진·목소리 파일 | **Vercel Blob** | 무료 1GB |

> 같은 코드가 집 서버(`node server.js`)·NAS(도커)에서도 그대로 돌아요. `DATABASE_URL`이 있을 때만 클라우드 모드가 켜집니다.

## 1. GitHub 저장소를 Vercel에 연결
1. https://vercel.com 에 GitHub 계정으로 로그인
2. **Add New… → Project** → `Ytimes` 저장소 **Import**
3. Framework Preset은 **Other** 그대로, 다른 칸은 건드리지 않아도 돼요 (`vercel.json`에 다 적혀 있어요)
4. 아직 **Deploy**는 누르지 말고, 먼저 2·3번으로 저장소를 연결해요 (눌렀어도 괜찮아요. 연결 뒤 다시 배포하면 돼요)

## 2. Neon 데이터베이스 연결 → `DATABASE_URL`
1. Vercel 프로젝트 → **Storage** 탭 → **Create Database** → **Neon** (Serverless Postgres)
2. 지역은 **Singapore (ap-southeast-1)** 를 고르세요 (Vercel 함수와 같은 곳이라 빨라요)
3. 프로젝트에 연결(Connect)하면 `DATABASE_URL` 등이 **환경 변수에 저절로** 들어가요
   - 이미 Neon 계정에 만든 데이터베이스를 쓰려면: Neon 관리 화면 → Connect → **Pooled connection** 주소를 복사해 Vercel → Settings → Environment Variables에 `DATABASE_URL`로 넣어요
4. 표(테이블)는 처음 접속할 때 **자동으로 만들어져요**. 따로 할 일이 없어요.

## 3. Vercel Blob 연결 → `BLOB_READ_WRITE_TOKEN`
1. 같은 **Storage** 탭 → **Create** → **Blob** → 이름 예: `unitimes-photos`, 지역 Singapore
2. 프로젝트에 연결하면 `BLOB_READ_WRITE_TOKEN`이 저절로 들어가요

## 4. 배포
1. **Deployments** → 가장 위 배포의 ⋯ → **Redeploy** (환경 변수를 넣은 뒤에는 꼭 다시 배포)
2. 주어진 주소(예: `ytimes-xxxx.vercel.app`)로 들어가면 **관리자 계정 만들기** 화면이 나와요 (로그인 아이디는 이메일 주소)
3. 설정 → 가족 계정에서 가족 계정을 만들어요

## 5. 지금까지의 자료 옮기기 (집 컴퓨터·미리보기 → 클라우드)
1. 원래 쓰던 유니 타임즈(또는 미리보기)에서 **설정 › 자료 관리 › 전체 백업 내려받기 (사진 포함)**
2. 새 클라우드 사이트에서 **설정 › 자료 관리 › 백업 되돌리기** → 그 파일 고르기 → `되돌리기` 입력
3. 글·일정을 먼저 옮기고, 사진·목소리는 3MB씩 나눠 올려요. 사진이 많으면 몇 분 걸려요
4. 가족 계정은 이메일이 같은 계정이 있으면 그 계정에 포인트·기사·착한 일 기록이 이어지고, 없으면 이름·권한을 살려 새로 만들어 둬요. 새로 만든 계정은 **설정 › 가족 계정 › 비밀번호 초기화**로 비밀번호를 정해 주세요
5. 카카오 장소 검색 키와 가족 영상통화방 링크는 백업에 들어가지 않으니 새 사이트에서 다시 넣어 주세요

## 6. 도메인 `bloombox.co.kr` 연결
1. Vercel 프로젝트 → **Settings → Domains** → `bloombox.co.kr` 입력 → Add (`www.bloombox.co.kr`도 함께 추가하면 좋아요)
2. Vercel이 알려 주는 값을 **도메인을 산 곳**(가비아·후이즈·카페24 등)의 DNS 관리에 넣어요
   | 종류 | 호스트 | 값 |
   |---|---|---|
   | A | `@` (비워 두기) | `76.76.21.21` |
   | CNAME | `www` | `cname.vercel-dns.com` |
   - 위 값은 흔히 쓰는 값이에요. **Vercel 화면에 다른 값이 보이면 그 값을 따르세요.**
   - 원래 있던 같은 이름의 A/CNAME 기록(파킹 페이지 등)은 지워야 해요
3. 몇 분~몇 시간 뒤 Vercel의 Domains 화면이 **Valid Configuration**으로 바뀌면 끝. HTTPS 인증서도 자동이에요
4. 인터넷에 공개되니 **설정 › 신문 정보 › 가족만 보기**를 켜 두는 걸 추천해요

## 클라우드에서 달라지는 점
| 항목 | 집 서버·NAS | 클라우드 (Vercel) |
|---|---|---|
| 사진 한 장 | 12MB까지 | **3MB까지** (휴대폰 사진은 올릴 때 자동으로 줄여서 보통 1MB 안팎) |
| 목소리 파일 | 25MB까지 | **3MB까지** (녹음 약 10분) |
| 자동 백업 | 매일 새벽 `data/backups` | Neon이 지난 시점으로 되돌리기를 지원 — 그래도 한 달에 한 번 **전체 백업 내려받기** 권장 |
| 첫 접속 | 바로 | 한동안 아무도 안 쓰면 첫 화면이 1~3초 늦을 수 있어요 (Neon·Vercel이 잠들었다 깨어남) |

## 문제가 생기면
| 증상 | 확인할 것 |
|---|---|
| 화면에 "서버 오류" | Vercel → 프로젝트 → **Logs**에서 빨간 줄 확인. `DATABASE_URL`이 없거나 틀리면 "데이터베이스에 연결하지 못했어요"가 보여요 |
| 사진을 올리면 오류 | `BLOB_READ_WRITE_TOKEN`이 연결됐는지, 넣은 뒤 **Redeploy** 했는지 |
| 도메인이 안 열림 | DNS 값을 바꾼 지 얼마 안 됐으면 기다리기. https://dnschecker.org 에서 `bloombox.co.kr`의 A 기록이 `76.76.21.21`로 보이는지 |

## 파일 구성 (클라우드용)
```
vercel.json              Vercel 설정 (싱가포르 실행, 주소 연결)
api/index.js             Vercel 서버 함수 입구 → server.js
lib/cloud.js             Neon(Postgres)·Blob 연결, SQLite 문법을 Postgres 문법으로 바꿔 줌
lib/cloud-worker.js      실제 네트워크 작업을 하는 작업 스레드
scripts/vercel-static.js 글꼴·지도·아이콘을 정적 파일로 내보내는 빌드
```
