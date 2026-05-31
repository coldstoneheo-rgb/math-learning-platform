# Kakao Alimtalk Roadmap

현재 학부모 알림의 운영 지원 범위는 이메일과 인앱 알림이다. 카카오 알림톡은 `kakao` 채널과 provider 확장 지점만 준비되어 있으며, 실제 발송은 아직 연결하지 않는다.

## 현재 상태

- `/api/notifications/send`는 `email`, `in_app`, `kakao`, `push` 채널 값을 구분한다.
- `email`은 Resend provider를 사용한다.
- `in_app`은 `notifications` 테이블 레코드를 생성하고 발송 성공으로 처리한다.
- `kakao`는 명시적으로 실패 응답을 반환한다.
- 교사 화면의 수동 발송 버튼은 현재 인앱/이메일만 요청한다.

## 카카오 알림톡 연동 전 필수 조건

1. 카카오 비즈니스 채널 준비
2. 알림톡 템플릿 심사 및 template id 관리
3. 학부모 전화번호 저장 필드와 검증 정책
4. 학부모 수신 동의 이력
5. 발송 provider API key 및 서버 환경변수
6. 발송 결과 webhook과 실패/재시도 정책

## 운영 원칙

- 위 조건이 충족되기 전까지 카카오 알림톡을 사용자에게 발송 가능 기능처럼 노출하지 않는다.
- `kakao` 요청은 실패 상태로 `notifications` 기록을 남기고, provider response에 `not_implemented`를 남긴다.
- 베타 기간에는 이메일과 인앱 알림의 성공/실패를 교사가 명확히 확인할 수 있는 것을 우선한다.
