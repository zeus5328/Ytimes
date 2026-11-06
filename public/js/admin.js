/* 로그인·초기 설정·관리·이용 안내 */
(function () {
  'use strict';
  const { esc } = YT;
  // 7단계 권한 — 높은 순서. 위 단계는 아래 단계가 할 수 있는 일을 모두 할 수 있어요.
  const ROLES = {
    admin: '관리자 · 모든 권한 (가족 계정·신문 정보·사진관·자료 관리)',
    editor: '편집장 · 모든 기사 승인·발행·수정, 휴지통 복원',
    senior: '시니어기자 · 내 기사 바로 발행, 다른 기자 기사 승인·수정 요청',
    staff: '평기자 · 기사 작성 + 일정·생일·기념일 등록·수정, 인물 프로필 편집',
    reporter: '수습기자 · 기사 작성·승인 요청, 편지·카드 쓰기, 사진 올리기',
    subscriber: '구독자 · 모든 기사 읽기, 댓글, 오늘의 한마디, 가족 투표 올리기·참여, 할 일·행사 준비 함께 보기',
  };

  const afterLogin = async (user) => {
    YT.state.user = user; YT.clearCache(); YT.renderChrome();
    const next = YT.query().next; YT.go(next && next.startsWith('#/') ? next : '#/');
  };

  YT.addRoute('/setup', async (view) => {
    if (!YT.state.needsSetup) return YT.go('#/');
    view.innerHTML = `<div class="auth-box"><div class="sec-kicker">처음 오셨네요</div><h1 class="page-title">편집국을 열어볼까요?</h1>
      <p class="page-desc">먼저 신문 전체를 관리할 <b>관리자 계정</b>을 만들어요. 가족 기자 계정은 이후 ‘관리’ 화면에서 추가할 수 있어요.</p>
      <form class="form" id="setupForm">
        <label class="block">이름 (신문에 표시)<input class="input" name="display_name" required maxlength="30" placeholder="아빠"></label>
        <label class="block">이메일 (로그인 아이디)<input class="input" type="email" name="username" required autocomplete="username email" autocapitalize="off" spellcheck="false" placeholder="dad@gmail.com"></label>
        <label class="block">비밀번호<input class="input" type="password" name="password" required minlength="6" autocomplete="new-password"></label>
        <button class="btn primary wide">관리자 계정 만들기</button></form></div>`;
    YT.$('#setupForm').onsubmit = async (e) => {
      e.preventDefault();
      try { const r = await YT.post('/api/setup', Object.fromEntries(new FormData(e.target))); YT.state.needsSetup = false; YT.toast('편집국이 열렸습니다.'); afterLogin(r.user); } catch (err) { YT.err(err); }
    };
  });

  YT.addRoute('/login', async (view) => {
    if (YT.state.user) return YT.go('#/');
    view.innerHTML = `<div class="auth-box"><div class="sec-kicker">FAMILY LOGIN</div><h1 class="page-title">로그인</h1>
      <p class="page-desc">가족 계정으로 로그인하면 기사 쓰기, 댓글, 카드 보내기를 할 수 있어요.</p>
      <form class="form" id="loginForm">
        <label class="block">이메일<input class="input" name="username" required autocomplete="username email" inputmode="email" autocapitalize="off" spellcheck="false" placeholder="dad@gmail.com"></label>
        <label class="block">비밀번호<input class="input" type="password" name="password" required autocomplete="current-password"></label>
        <button class="btn primary wide">로그인</button></form>
      <p class="muted small">계정이 없다면 관리자(가족 편집장)에게 만들어 달라고 요청하세요.</p></div>`;
    YT.$('#loginForm').onsubmit = async (e) => {
      e.preventDefault();
      try { const r = await YT.post('/api/login', Object.fromEntries(new FormData(e.target))); YT.toast(`${r.user.display_name}님, 반가워요!`); afterLogin(r.user); } catch (err) { YT.err(err); }
    };
  });

  // 예전 주소는 설정 화면으로 보냅니다
  YT.addRoute('/account', async () => { location.replace('#/settings/me'); });
  YT.addRoute('/admin', async () => { location.replace('#/settings/family'); });
  YT.ROLES = ROLES;

  YT.addRoute('/guide', async (view) => {
    const S = YT.state.settings;
    view.innerHTML = YT.pageHead('', '이용 안내', `${esc(S.site_name)}는 가족 모두가 기자이자 독자인 신문이에요.`)
      + `<div class="guide">
        <section><h2>신문 읽기</h2><p>1면에는 이달의 톱기사와 최근 소식, 네 가지 코너(우리 집 날씨 · 일반 기사 · 인(人)터뷰 · 포토제닉)가 실려요. ‘전체 기사’에서 분류·코너·발행월로 찾아볼 수 있어요.</p></section>
        <section><h2>기사 쓰기와 발행</h2><ol><li><b>초안 작성</b> — 편집실 → 기사 작성. 코너를 고르고 ‘작성 틀 넣기’로 시작하면 쉬워요.</li><li><b>승인 요청</b> — 수습기자·평기자가 다 쓴 기사를 요청해요.</li><li><b>검토·승인</b> — 편집장 또는 시니어기자가 읽고 승인하거나 수정을 요청해요.</li><li><b>신문 발행</b> — 편집장이 발행해요. 시니어기자는 자기 기사를 바로 발행할 수 있어요. 발행된 기사만 1면에 공개돼요.</li></ol></section>
        <section><h2>반응과 댓글 <span class="new">NEW</span></h2><p>기사 아래 이모지를 눌러 응원을 남겨요(누구나). 댓글은 가족 계정으로 로그인한 뒤 남길 수 있어요.</p></section>
        <section><h2>오늘의 축하 · D-day <span class="new">NEW</span></h2><p>생일·기념일이 오늘이면 1면 위에 축하 띠가 나타나고, 45일 안의 기념일은 D-day로 보여줘요. 축하 띠에서 바로 축하 카드를 쓸 수 있어요.</p></section>
        <section><h2>메뉴 한눈에</h2><ul>
          <li><b>신문</b> — 1면 · 기사(코너별 목록 · 크게 읽기 · 레시피북 · 여행 지도) · 지면(이달의 지면 · 합본호 · 우편 발송)</li>
          <li><b>일정</b> — 일정(오늘 · 달력 월간/주간 · 생일·기념일, 위쪽 가로 메뉴로 오가요) · 시간표 · 할 일(한눈에 · 행사 준비 · 집안일 당번 · 가족회의 · 버킷리스트)</li>
          <li><b>가족</b> — 가족 광장(투표 · 한마디 · 기분 날씨 달력) · 가족 앨범(인물 · 가계도 · 성장 기록 · 가족 연표) · 우체국(편지·카드 · 타임캡슐) · 사진관</li>
          <li><b>편집국</b>(기자 이상) — 편집실(기사 쓰기 · 검토 · 발행) · 기자단(배지 · 시상식)</li>
          <li>위쪽에는 검색 · 알림 · 화면 설정을 두었어요. 톱니바퀴를 누르면 화면 밝기 · 글자 크기 · 움직임 줄이기를 바로 바꿀 수 있어요.</li></ul></section>
        <section><h2>원고료 · 쿠폰 <span class="new">NEW</span></h2><p>기사가 처음 신문에 실리면 기자에게 <b>원고료 포인트</b>가 들어와요(기본: 대표 기자 2,000P, 함께 쓴 기자 500P). 편집국 › <b>원고료</b>에서 모은 포인트로 가족이 정한 쿠폰(용돈, 게임 시간, 설거지 면제권…)을 사요. 산 쿠폰은 부모님께 보여 주고, 관리자가 ‘사용 완료’를 눌러요. 쓰기 전에는 취소하면 포인트를 돌려받아요. 관리자는 ‘쿠폰 관리’에서 쿠폰을 만들고, 원고료 금액을 바꾸고, 보너스 포인트를 줄 수 있어요.</p></section>
        <section><h2>새로 생긴 것 <span class="new">NEW</span></h2><ul>
          <li><b>친척에게 링크 보내기</b>(지면, 편집장 이상) — 계정 없는 친척에게 이번 호만 읽을 수 있는 링크를 보내요. 3일~석 달 중 기간을 고르고, 언제든 ‘링크 끄기’로 막을 수 있어요. 몇 번 열어 봤는지도 보여요.</li>
          <li><b>가족만 보기</b>(설정 › 신문 정보) — 켜면 가족 계정으로 로그인해야 신문을 볼 수 있어요. 친척 링크는 그대로 열려요.</li>
          <li><b>목소리 기사</b> — 기사 쓰기의 ‘소리 넣기’로 바로 녹음하거나 녹음 파일을 넣어요. 기사에서 바로 듣고, 인쇄한 지면에는 QR 코드로 실려 휴대폰으로 찍으면 들려요.</li>
          <li><b>가계도</b>(가족 앨범) — 인물 프로필에 아버지·어머니·배우자를 적으면 세대별로 이어져요.</li>
          <li><b>행사 준비</b>(할 일) — 생신·여행·명절마다 준비물 체크와 비용 나누기. 낸 돈을 적으면 누가 누구에게 얼마를 보내면 되는지 계산해 줘요.</li>
          <li><b>기분 날씨 달력</b>(가족 광장) — 한마디에 고른 기분을 날씨(맑음·흐림·비…)와 색으로 한 달 달력에 모아요. 이달의 지면에도 실려요.</li>
          <li><b>장보기 목록</b>(레시피북) — 요리를 고르면 레시피의 ‘■ 재료’를 모아 같은 재료끼리 합쳐 줘요. 체크·복사·인쇄할 수 있어요.</li>
          <li><b>서버로 옮기기용 전체 백업</b>(설정 › 자료 관리, 관리자) — 글 자료에 사진·목소리 파일까지 한 파일로 받아요. 새 서버(NAS)의 ‘백업 되돌리기’에 올리면 그대로 옮겨져요. 가족 계정은 새 서버에서 다시 만들어요.</li>
          <li><b>크게 읽기</b>(기사 › 크게 읽기, 위쪽 톱니바퀴) — 큰 글씨로 기사를 한 편씩 넘겨 읽어요. 글자 크기 세 단계, ‘소리로 듣기’와 다음 기사 이어 듣기, 휴대폰은 옆으로 쓸어 넘기기.</li>
          <li><b>우편 발송</b>(지면, 편집장 이상) — 친척 주소록을 모아 두고 A4 라벨지(16·14·21칸)에 주소 라벨을 인쇄해요.</li></ul></section>
        <section><h2>가족 앨범 <span class="new">NEW</span></h2><p>기사에 넣은 <b>등장 인물</b>과 등록한 생일로 가족 명부가 자동으로 만들어져요. 사람마다 생일, 기념일, 관련 기사, 함께 등장하는 가족을 모아 보여줘요.</p></section>
        <section><h2>이달의 지면 <span class="new">NEW</span></h2><p>한 달 동안 발행한 기사를 진짜 신문처럼 한 장에 배치해요. A4·A3로 인쇄하거나 PDF로 저장해 할머니 댁에 보내보세요.</p></section>
        <section><h2>가족 광장 <span class="new">NEW</span></h2><p>‘가족에게 물어보기’로 저녁 메뉴, 여행지 같은 투표를 올리고, 오늘 기분과 한마디를 남겨요. 1면에도 진행 중인 투표와 최근 한마디가 보여요.</p></section>
        <section><h2>검색 · 보기 설정</h2><p>위쪽 돋보기(또는 Ctrl+K)로 기사·일정·가족·카드를 한 번에 찾아요. 위쪽 톱니바퀴를 누르면 화면 밝기·글자 크기·움직임 줄이기를 바로 바꿀 수 있고, 이 기기에 기억돼요.</p></section>
        <section><h2>휴대폰 홈 화면에 추가 <span class="new">NEW</span></h2><p>아이폰은 사파리 공유 버튼 → ‘홈 화면에 추가’, 안드로이드는 크롬 메뉴 → ‘홈 화면에 추가’를 누르면 앱처럼 열려요.</p></section>
        <section><h2>자동 임시 저장 · 조회수 <span class="new">NEW</span></h2><p>기사를 쓰는 동안 이 브라우저에 자동으로 임시 저장돼요. 창을 닫았다 다시 열면 이어서 쓸 수 있어요. 기사마다 조회수와 읽는 시간이 표시되고, 1면에 ‘많이 읽은 기사’가 생겨요.</p></section>
        <section><h2>캘린더</h2><p>일반 일정과 매년 반복되는 생일(양력·음력)·기념일을 기록해요. 음력 생일은 매년 양력 날짜로 자동 변환되고, 한국식 나이와 주년 수도 함께 표시돼요.</p>
          <ul><li><b>한 줄 입력</b> — ‘토요일 오후 6시 가족 외식 @소담촌’처럼 쓰고 Enter를 누르면 칸이 채워져요.</li>
          <li><b>친구 생일</b> — 생일 → ‘가족의 친구·지인 생일’에서 누구의 친구인지 고르면 ‘황윤수 생일 (김신중의 친구)’로 저장돼요.</li>
          <li><b>바로 고치기</b> — 달력의 일정을 누르면 수정·복제·삭제할 수 있어요. 아래 ‘생일·기념일 모아 보기’에서도 고칠 수 있어요.</li>
          <li><b>내 캘린더로</b> — 휴대폰·구글 캘린더에 넣을 수 있는 파일을 내려받아요.</li>
          <li><b>반복 일정</b> — ‘반복’에서 매주·격주·매월(날짜 또는 첫째 일요일처럼)·매년을 고르면 달력에 저절로 채워져요.</li>
          <li><b>하루 전 알림</b> — 일정마다 켜 두면 전날 가족 모두에게 알림으로 알려줘요. 반복 일정은 기본으로 꺼져 있어요.</li></ul></section>
        <section><h2>함께 쓰기 · 답글 <span class="new">NEW</span></h2><p>기사를 쓸 때 오른쪽 ‘함께 쓴 기자’에서 가족 기자를 고르면 바이라인에 ‘엄마·윤서 기자’처럼 함께 실리고, 함께 쓴 기자도 고치고 승인 요청할 수 있어요. 댓글에는 ‘답글’로 대화를 이어갈 수 있어요.</p></section>
        <section><h2>N년 전 오늘 · 합본호 <span class="new">NEW</span></h2><p>1면에 작년 이맘때 기사가 ‘1년 전 오늘’로 떠요. 이달의 지면에서 ‘합본호’를 누르면 한 해 기사를 표지·차례와 함께 한 권으로 엮어 인쇄하거나 PDF로 저장할 수 있어요. 기사가 적은 달은 가족 투표·한마디로 지면을 채워요.</p></section>
        <section><h2>마감 알림 <span class="new">NEW</span></h2><p>매달 마지막 3일 동안 기자들에게 알림으로 ‘이번 호 마감까지 N일’과 남은 초안·승인 대기 기사 수를 알려줘요.</p></section>
        <section><h2>앱으로 설치 · 공유 <span class="new">NEW</span></h2><p>설정 → 화면 설정 → ‘앱으로 설치’로 홈 화면에 아이콘을 만들 수 있어요. 인터넷이 끊겨도 마지막으로 본 신문은 볼 수 있어요. 기사의 ‘공유’로 보낸 링크는 카카오톡·문자에서 제목과 사진이 카드로 보여요(사이트가 인터넷 주소로 열려 있어야 해요).</p></section>
        <section><h2>기록과 살림 <span class="new">NEW</span></h2><p>각 메뉴 안의 탭에서 만나요.</p>
          <ul><li><b>가족 연표</b>(가족 앨범) — 이사·입학·여행 같은 큰일을 한 줄씩. 헤드라인 기사, 생일, 기념일도 저절로 들어와요.</li>
          <li><b>성장 기록</b>(가족 앨범) — 키·몸무게를 적으면 그래프로, ‘처음 한 일’도 함께 모아요.</li>
          <li><b>레시피북</b>(기사) — 분류를 ‘요리’로 고르면 레시피 틀이 들어가고 여기에 모여요. 책처럼 인쇄할 수 있어요.</li>
          <li><b>여행 지도</b>(기사) — 기사 쓰기 오른쪽 ‘장소’에서 고르면 지도에 핀이 꽂혀요.</li>
          <li><b>버킷리스트 · 집안일 당번 · 가족회의</b>(일정 › 할 일) — 함께 하고 싶은 일, 매주 돌아가는 당번(월요일 알림), 회의에서 정한 일을 기록해요.</li>
          <li><b>기자단</b>(편집국) — 기자마다 기사·사진·댓글 기록과 배지 9개. 12월 합본호에는 시상식과 ‘올해의 기사’ 가족 투표가 실려요.</li></ul></section>
        <section><h2>말로 쓰기 · 소리로 듣기 <span class="new">NEW</span></h2><p>기사 쓰기의 ‘말로 쓰기’를 누르고 말하면 글로 받아 적어요(“마침표”, “줄 바꿈”도 돼요). 기사 위의 ‘소리로 듣기’는 기사를 읽어 줘요. 크롬·사파리·삼성 인터넷에서 돼요.</p></section>
        <section><h2>이번 주 취재 질문 · 그림 일기 · 타임캡슐 <span class="new">NEW</span></h2><p>1면 오른쪽에 매주 바뀌는 질문이 떠요. 누르면 인터뷰 기사 틀이 열려요. ‘그림 일기’ 코너에는 아이 그림을 사진으로 찍어 올려요. 우체국의 ‘타임캡슐’은 정한 날까지 아무도 열 수 없는 편지예요.</p></section>
        <section><h2>시간표</h2><p>학교 교시와 방과후, 학원·활동을 한 주에 모아 봐요. 관리자와 지정된 가족만 볼 수 있어요.</p></section>
        <section><h2>사진관</h2><p>가족 사진을 모아 여러 디자인의 앨범으로 만들고 인쇄해요. 발행된 기사 사진은 ‘달마다 모인 기사 사진’에 저절로 모여서, 버튼 한 번으로 그 달 앨범을 만들 수 있어요. 관리자 전용이에요.</p></section>
        <section><h2>우체국</h2><p>편지·생일카드·기념일카드·크리스마스카드·연하장을 종류마다 다른 디자인 4가지(편지: 편지지·항공우편·원고지·테이프 메모, 생일: 케이크·풍선·컨페티·가랜드, 기념일: 아치·리스·숫자·폴라로이드, 크리스마스: 라인 트리·솔잎 리스·눈 오는 밤·오너먼트, 연하장: 일출·복주머니·창살 문양·매화)와 색 4가지 중에서 골라 써요. 저장하면 비공개, ‘공개하기’를 누르면 모두가 볼 수 있어요.</p></section>
        <section><h2>권한</h2><table class="table"><tbody>${Object.entries(ROLES).map(([k, l]) => `<tr><th>${l.split(' · ')[0]}</th><td>${l.split(' · ')[1]}</td></tr>`).join('')}<tr><th>방문자</th><td>발행된 기사·공개 카드·일정 읽기, 반응 남기기</td></tr></tbody></table></section>
      </div>`;
  });
})();
