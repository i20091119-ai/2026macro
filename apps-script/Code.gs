/**
 * 2026. 학교로 찾아가는 SW체험수업 — 사전 협의 응답 수합 (Google Apps Script 웹앱)
 *
 * 사용법: 구글시트 > 확장 프로그램 > Apps Script 에 이 파일을 붙여넣고
 *        배포 > 새 배포 > 유형 "웹 앱", 실행 사용자 "나", 액세스 "모든 사용자" 로 배포.
 *        발급된 /exec URL을 app.js 의 CONFIG.ENDPOINT 에 넣는다.
 *
 * 프론트는 Content-Type: text/plain 으로 JSON 문자열을 POST 한다(CORS preflight 회피).
 * 1행 = 1개교 응답. 같은 학교가 다시 제출하면 새 행을 추가하고, 이전 행의 "최신" 표시는 지운다.
 */

var SHEET_NAME = '응답';

/* app.js 의 FIELD_DEFS 와 순서·키를 일치시킬 것 */
var HEADERS = [
  ['submittedAt', '제출 시각'],
  ['schoolId', '학교 ID'],
  ['schoolName', '학교명'],
  ['resubmit', '재제출 여부'],
  ['latest', '최신'],
  ['opDate', '운영일자'],
  ['program', '신청 프로그램'],
  ['teacherName', '담당교사 성명'],
  ['teacherPhone', '담당교사 연락처'],
  ['p12Time', '1~2교시 시각'],
  ['p34Time', '3~4교시 시각'],
  ['rooms', '교시별 수업 장소'],
  ['floorInfo', '교실 위치(층)'],
  ['elevator', '엘리베이터'],
  ['laptops', '1인 1노트북 구비(교실별)'],
  ['wifi', '무선 인터넷'],
  ['display', '화면 송출 장치'],
  ['displayConn', '연결 방식'],
  ['threeClass', '교시당 3개 학급 동시 수업 확인'],
  ['threeClassActual', '실제 학급 수'],
  ['threeRooms', '교실 3실 확보'],
  ['addClass', '3~4교시 학급 추가'],
  ['addClassDetail', '추가 학급·인원'],
  ['programChange', '프로그램 변경 희망'],
  ['programChangeTo', '변경 희망 프로그램'],
  ['programChangeReason', '변경 사유'],
  ['parking', '주차 가능 위치'],
  ['etcRequest', '기타 요청사항'],
  ['submitId', '제출 ID'],
  ['userAgent', '응답 기기'],
  ['raw', '원본 JSON'],
];

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    var body = JSON.parse(e.postData.contents);
    if (!body || !body.schoolId || !body.schoolName) throw new Error('schoolId/schoolName 누락');

    var sh = getSheet_();
    var idCol = colOf_('schoolId');
    var latestCol = colOf_('latest');
    var submitIdCol = colOf_('submitId');
    var lastRow = sh.getLastRow();

    // 같은 제출 ID가 이미 있으면(브라우저가 응답을 못 받고 재시도한 경우) 다시 적재하지 않는다
    if (body.submitId && lastRow > 1) {
      var sids = sh.getRange(2, submitIdCol, lastRow - 1, 1).getValues();
      for (var k = 0; k < sids.length; k++) {
        if (String(sids[k][0]) === String(body.submitId)) {
          var r = sh.getRange(k + 2, 1, 1, HEADERS.length).getValues()[0];
          return json_({ ok: true, duplicate: true, resubmit: /재제출/.test(String(r[colOf_('resubmit') - 1])), count: 1, submittedAt: String(r[0]), row: k + 2 });
        }
      }
    }

    // 같은 학교의 이전 제출 행 → "최신" 표시 제거
    var prior = 0;
    if (lastRow > 1) {
      var ids = sh.getRange(2, idCol, lastRow - 1, 1).getValues();
      for (var i = 0; i < ids.length; i++) {
        if (String(ids[i][0]) === String(body.schoolId)) {
          prior++;
          sh.getRange(i + 2, latestCol).setValue('');
        }
      }
    }

    body.submittedAt = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
    body.resubmit = prior > 0 ? '재제출(' + (prior + 1) + '회)' : '최초';
    body.latest = '최신';

    var row = HEADERS.map(function (h) {
      var v = body[h[0]];
      if (v === undefined || v === null) return '';
      // 시트 수식 주입 방지
      if (typeof v === 'string' && /^[=+\-@]/.test(v)) v = "'" + v;
      return v;
    });
    sh.appendRow(row);

    return json_({ ok: true, resubmit: prior > 0, count: prior + 1, submittedAt: body.submittedAt, row: sh.getLastRow() });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

/* 브라우저에서 /exec 를 열면 동작 여부를 확인할 수 있다 */
function doGet() {
  return json_({ ok: true, service: 'sw-visit-2026', sheet: SHEET_NAME, columns: HEADERS.length });
}

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() > 0) {
    // 열 구성이 바뀐 경우: 기존 시트를 보존(이름 변경)하고 새 시트를 만든다
    var cur = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0].join('|');
    var want = HEADERS.map(function (h) { return h[1]; }).join('|');
    if (cur !== want) {
      sh.setName(SHEET_NAME + '_구버전_' + Utilities.formatDate(new Date(), 'Asia/Seoul', 'MMdd_HHmm'));
      sh = ss.insertSheet(SHEET_NAME, 0);
    }
  }
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS.map(function (h) { return h[1]; }));
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  }
  return sh;
}

function colOf_(key) {
  for (var i = 0; i < HEADERS.length; i++) if (HEADERS[i][0] === key) return i + 1;
  throw new Error('unknown column: ' + key);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* 편집기에서 직접 실행해 시트·헤더를 미리 만들고 권한을 승인할 때 사용 */
function setup() {
  getSheet_();
}
