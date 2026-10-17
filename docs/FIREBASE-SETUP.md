# Firebase 연결 준비 안내

## 1. Firebase 프로젝트 만들기

1. Firebase Console에서 새 프로젝트를 만든다.
2. 프로젝트에 웹 앱을 추가한다.
3. 프로젝트 설정에서 웹 앱의 Firebase 설정 객체를 확인한다.
4. Firebase Authentication에서 이메일/비밀번호 로그인을 활성화한다.
5. Realtime Database를 만들고 리전을 선택한다. 실제 Database URL을 기록한다.

## 2. 웹 설정값 입력

js/firebase-config.example.js를 js/firebase-config.js로 복사한 다음 Firebase 콘솔의 실제 값으로 바꾼다. databaseURL은 Realtime Database 콘솔에서 확인한 주소를 사용한다.

현재 프로젝트의 js/firebase-config.js에는 제공된 travel-7ceb1 웹 앱 설정이 입력되어 있다. 다른 Firebase 프로젝트를 사용할 때만 해당 값을 교체한다.

Firebase 웹 설정은 브라우저에서 Firebase 프로젝트를 식별한다. 서비스 계정 JSON, Admin SDK 비공개 키, 비밀번호를 이 파일에 복사하지 않는다.

## 3. 최초 관리자 지정

1. Firebase Authentication에서 운영자 계정을 만든다.
2. 이메일/비밀번호 제공자가 활성화되어 있는지 확인하고, 운영자 계정의 이메일을 Authentication 사용자 목록에서 확인한다.
3. js/firebase-config.js의 adminAuthConfig.email을 실제 운영자 계정 이메일로 바꾼다. UID 전체 값을 확인했다면 adminAuthConfig.uid에도 입력해 브라우저 측에서 이메일과 UID를 함께 검사한다. 관리자 비밀번호는 이 파일에 적지 않는다.
4. firebase/database.rules.json의 관리자 이메일을 같은 실제 이메일로 바꾼다. Database Rules는 브라우저 설정값을 신뢰하지 않고 Firebase 인증 토큰의 이메일을 직접 검사한다.
5. 규칙을 적용하기 전 일반 회원이 관리자 전용 경로를 읽거나 쓸 수 없는지 Rules Simulator 또는 Firebase Emulator에서 확인한다.

관리자 로그인 화면의 아이디는 admin으로 고정되어 있지만 Firebase Authentication은 이메일/비밀번호 방식이므로, 실제 인증 요청에는 adminAuthConfig.email에 설정한 이메일을 사용한다. 로그인 후 인증된 이메일이 관리자 이메일과 일치해야 html/admin/admin.html에 접근할 수 있다. adminAuthConfig.uid가 입력되어 있으면 UID도 추가로 일치해야 한다.

현재 규칙은 최초 관리자 한 명의 인증 토큰 이메일을 확인하는 방식이다. 운영자가 여러 명이 되면 Admin SDK로 부여한 custom claims와 신뢰할 수 있는 관리자 계정 관리 방식으로 확장한다. 회원 프로필 데이터만 바꾸어 관리자 권한을 얻을 수 없다. 회원을 suspended로 바꾸면 Database 접근은 제한되지만 Firebase Authentication 로그인 계정 자체를 비활성화하지는 않는다. 로그인을 차단해야 한다면 신뢰할 수 있는 관리자 도구에서 Authentication 계정도 별도로 정지한다.

회원가입 시 members/{uid}에는 uid, name, email, phone, status, createdAt, updatedAt만 저장한다. 비밀번호는 Authentication에만 저장한다. 일반 회원은 자신의 경로만 생성·조회할 수 있고 uid, email, status, createdAt은 가입 후 직접 변경할 수 없다. 관리자는 전체 회원을 조회하고 status를 active 또는 suspended로 변경할 수 있다.

## 4. 초기 데이터 구조

- destinations/{destinationId}: 공개 여행지 정보
- stays/{stayId}: 숙소 정보, destinationId로 여행지 연결
- members/{uid}: Firebase Authentication 사용자 프로필
- reservations/{reservationId}: 신청·확정·취소 상태가 있는 예약 정보

Database Rules는 목록 검색에 필요한 쿼리 조건을 확인한다. 공개 여행지 목록은 status가 published인 쿼리, 숙소 목록은 status가 active인 쿼리로 읽는다. 회원 예약 목록은 memberId가 로그인 사용자 UID와 같은 쿼리로 읽는다.

## 5. 예약 확인 정책

첫 버전은 예약을 requested 상태로 신청하고 관리자가 숙소의 날짜별 가능 여부와 신청 금액을 확인한 뒤 confirmed로 바꾼다. 신청 화면은 예약 확정 전임을 알린다. 실시간 객실 수량 차감, 동시 예약 방지, 자동 결제는 첫 버전에서 보장하지 않는다.

이 설정과 보안 규칙은 시작용 예시다. 실제 프로젝트 UID와 URL을 입력하고 Firebase Rules Simulator 또는 Emulator로 읽기·쓰기 권한을 확인한 뒤 적용한다. 기본 차단 규칙을 유지하고 규칙 오류로 전체 데이터가 공개되지 않게 한다.
