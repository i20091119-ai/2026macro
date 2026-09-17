# 2026. 학교로 찾아가는 SW체험수업 — 사전 협의 응답 웹앱

참여 13개교 담당교사가 링크 하나로 접속해 휴대폰으로 3분 안에 사전 협의 정보를 응답하고, 응답이 구글시트에 1행씩 쌓이는 정적 웹앱입니다.

- 프론트: 순수 HTML/CSS/JS (빌드 없음) → GitHub Pages
- 데이터: `data/schools.json` (13개교 신청서 정보 + 확인코드)
- 백엔드: Google Apps Script 웹앱 (`apps-script/Code.gs`) → 구글시트 적재

```
index.html            화면 골격
style.css             모바일 우선 스타일
app.js                로직 (학교 확인 → 신청서 카드 → 응답 폼 → 임시저장 → 제출 → 요약)
data/schools.json     학교 정보(하드코딩)
apps-script/Code.gs   구글시트 적재용 Apps Script
assets/logo.png       상단 로고(선택). 없으면 글자로 대체
```

## 화면 흐름

1. 학교 선택 + 확인코드 4자리 입력 → 본인 학교 확인 (`?school=<id>`로 학교를 미리 선택한 링크도 가능)
2. 신청서 기재 내용(운영일·프로그램·교시별 학급·장소·담당자)을 읽기 전용 카드로 표시
3. 응답 항목 A~G. 입력 중 내용은 `localStorage`에 자동 임시저장되어 새로고침해도 유지
4. 제출 후 응답 요약 화면. 같은 링크로 다시 제출하면 새 행이 추가되고 이전 행의 "최신" 표시가 지워짐

학교별 조건부 문항은 `schools.json`의 `flags`로 제어합니다.

| flag | 노출 문항 |
|---|---|
| `threeClass: true` | 교시당 3개 학급 동시 수업 확인 → 맞음(교실 3실 확보 여부) / 아님(실제 학급 수) |
| `canAddClass: true` | 3~4교시 1개 학급 추가 운영 여부 → 추가함(학급명·인원) / 추가 안 함 |
| `periods.p34`가 빈 배열 | 3~4교시 시각 문항 숨김(1~2교시만 운영) |

---

## 1. Apps Script(구글시트) 배포

1. 구글 드라이브에서 새 **구글 스프레드시트**를 만듭니다. (파일명 예: `2026 SW체험수업 사전협의 응답`)
2. 시트 메뉴 **확장 프로그램 > Apps Script** 를 엽니다.
3. 편집기의 `Code.gs` 내용을 모두 지우고 이 저장소의 `apps-script/Code.gs` 내용을 붙여넣고 저장합니다.
4. 편집기 상단에서 함수 `setup`을 선택하고 **실행**합니다. 권한 승인 창이 뜨면 본인 계정으로 승인합니다.
   → 시트에 `응답` 탭과 헤더 행이 생깁니다.
5. **배포 > 새 배포** → 유형 선택(톱니바퀴)에서 **웹 앱**
   - 설명: 아무거나
   - 다음 사용자 인증 정보로 실행: **나**
   - 액세스 권한이 있는 사용자: **모든 사용자**
   - **배포** 클릭 → 발급된 **웹 앱 URL**(`https://script.google.com/macros/s/…/exec`)을 복사
6. `app.js` 맨 위 `CONFIG.ENDPOINT`에 URL을 붙여넣고 커밋/푸시합니다.

   ```js
   const CONFIG = {
     ENDPOINT: 'https://script.google.com/macros/s/XXXX/exec',
     ...
   ```

7. 동작 확인: 브라우저에서 웹 앱 URL을 열면 `{"ok":true,"service":"sw-visit-2026",...}`가 보여야 합니다.
   터미널에서 실제 적재 테스트:

   ```bash
   curl -L -X POST -H "Content-Type: text/plain" \
     -d '{"schoolId":"test","schoolName":"테스트학교","teacherName":"홍길동"}' \
     "https://script.google.com/macros/s/XXXX/exec"
   ```

   시트에 행이 추가되면 성공입니다. 테스트 행은 지워도 됩니다.

**코드를 고친 뒤에는** 배포 > **배포 관리** > 연필 아이콘 > 버전 **새 버전** > 배포 를 해야 반영됩니다. URL은 그대로 유지됩니다.

### 시트 열 구성
1행 = 1개교 응답. 열 순서는 `Code.gs`의 `HEADERS`(= `app.js`의 `FIELD_DEFS`) 순서입니다.
앞쪽에 `제출 시각`, `학교 ID`, `학교명`, `재제출 여부`(최초 / 재제출(n회)), `최신`(가장 마지막 제출 행에만 `최신`) 열이 있어 필터로 학교별 최신 응답만 볼 수 있습니다. 마지막 `원본 JSON` 열에는 폼 입력값 전체가 그대로 들어 있습니다.

---

## 2. GitHub Pages 배포

1. 이 저장소를 GitHub에 푸시합니다(기본 브랜치 `main`).
2. 저장소 **Settings > Pages**
   - Source: **Deploy from a branch**
   - Branch: **main** / **/(root)** → Save
3. 1~2분 뒤 `https://<계정>.github.io/<저장소명>/` 에서 접속됩니다.
4. 학교에 보낼 링크
   - 공통: `https://<계정>.github.io/<저장소명>/`
   - 학교별(드롭다운 미리 선택): `https://<계정>.github.io/<저장소명>/?school=pyeongsan`
   - 확인코드는 링크와 **별도로**(문자·공문) 안내합니다.

`data/schools.json`이나 `app.js`를 수정해 푸시하면 자동으로 다시 배포됩니다. 브라우저 캐시 때문에 바로 안 보이면 새로고침하세요.

---

## 3. `data/schools.json` 수정 방법

`schools` 배열의 항목 하나가 학교 하나입니다. 운영일 순으로 정렬되어 있으며 드롭다운에도 그 순서로 나옵니다.

```jsonc
{
  "id": "pyeongsan",                 // 영문 고유 ID. 시트의 학교 ID, ?school= 링크, 임시저장 키에 사용. 변경 금지 권장
  "name": "평산초등학교",
  "code": "4721",                    // 확인코드 4자리(문자열). 배포 전 반드시 학교마다 다른 값으로 변경
  "level": "초",
  "date": "2026-10-06", "dow": "화", // 운영일자·요일
  "programCode": "P1",
  "program": "① 컬러코드로 여는 길, 오조봇 미로 대탈출",
  "classCount": 4, "studentCount": 82,
  "periods": {
    "p12": [ { "class": "6-3", "n": 20, "room": "6-3 교실" }, { "class": "6-4", "n": 21, "room": "6-4 교실" } ],
    "p34": [ { "class": "6-1", "n": 21, "room": "6-1 교실" }, { "class": "6-2", "n": 20, "room": "6-2 교실" } ]
  },
  "contact": [ { "name": "이지은", "role": "담당자", "phone": "010-2780-7769" } ],
  "cooperation": { "guideTeacher": "possible", "schoolLaptop": "possible" },
  "flags": { "threeClass": false, "canAddClass": false },
  "notes": ""                        // 내부 메모. 화면에 표시되지 않음
}
```

- **확인코드 바꾸기**: `code` 값을 4자리 숫자 문자열로 수정합니다. 확인코드는 정적 파일에 들어 있으므로 본인 확인용 최소 장치일 뿐 보안 수단이 아닙니다.
- **수업 장소가 비어 있으면**(`"room": ""`) 응답 화면에서 필수 입력으로 표시됩니다.
- **1~2교시만 운영하는 학교**는 `"p34": []` 로 두면 3~4교시 시각 문항이 숨겨집니다.
- **학급별 문항**(장소, 노트북, 확정 인원, 인솔 교사)은 `periods` 안의 학급마다 자동 생성됩니다. 3개 반을 한 줄로 묶은 경우(예: `"class": "1학년 1~3반"`)는 한 묶음으로 질문합니다.
- **담당자**의 첫 번째 연락처가 휴대폰(01x)이면 담당교사 연락처 칸에 미리 채워집니다.
- `_meta.programs`의 6종 목록은 "프로그램 변경 희망" 드롭다운에 사용됩니다.
- JSON 문법(쉼표, 따옴표)이 깨지면 화면 상단에 "학교 정보를 불러오지 못했습니다"가 뜹니다. 수정 후 https://jsonlint.com 등으로 검사하세요.

---

## 4. 기타 설정 (`app.js` 상단 `CONFIG`)

| 키 | 설명 |
|---|---|
| `ENDPOINT` | Apps Script 웹 앱 URL |
| `ADMIN` | 하단 고지·제출 실패 안내에 표시되는 담당자(경남수학문화관 이상우 055-713-2197) |
| `RETENTION` | 하단 고지의 보유 기간 문구 |
| `STORAGE_PREFIX` | localStorage 키 접두어. 임시저장/제출 기록은 `접두어 + draft|done + : + 학교 id` |

## 로컬에서 확인하기

`fetch`로 JSON을 읽으므로 파일을 직접 열지 말고 간단한 정적 서버로 띄웁니다.

```bash
python3 -m http.server 8080
# http://localhost:8080
```
