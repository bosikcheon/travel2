// Firebase Console > 프로젝트 설정 > 내 앱 > SDK 설정에서 값을 복사합니다.
// 비밀번호, 서비스 계정 키, Admin SDK 비공개 키는 이 파일에 넣지 않습니다.
export const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_WEB_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.REGION.firebasedatabase.app",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Firebase Authentication에 만든 관리자 계정의 이메일을 입력합니다.
// UID 전체 값을 확인했다면 uid에도 입력하면 이메일과 UID를 함께 검사합니다.
// 화면에서는 아이디를 admin으로 표시하지만 실제 인증은 이 이메일로 처리합니다.
export const adminAuthConfig = {
  username: "admin",
  email: "YOUR_ADMIN_EMAIL",
  uid: ""
};
