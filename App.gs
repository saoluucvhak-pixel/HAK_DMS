/**
 * App.gs
 * Điểm khởi chạy Web Application (Entry Point), routing và trigger hệ thống
 * Dự án: Mini DMS (Document Management System)
 */

function doGet(e) {
  // Đảm bảo hệ thống đã được khởi tạo các bảng và dữ liệu cốt lõi
  INIT.autoInitSystem(false);

  var template = HtmlService.createTemplateFromFile("views/index");
  return template.evaluate()
    .setTitle(CONFIG.APP_NAME)
    .addMetaTag("viewport", "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  return ContentService.createTextOutput(JSON.stringify({ status: "ok" }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Hàm nhúng file HTML con linh hoạt (Hỗ trợ cả 'views/filename' và 'filename')
 */
function include(filename) {
  try {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
  } catch (e) {
    if (filename.indexOf("/") === -1) {
      try {
        return HtmlService.createHtmlOutputFromFile("views/" + filename).getContent();
      } catch (e2) {}
    } else {
      var baseName = filename.split("/").pop();
      try {
        return HtmlService.createHtmlOutputFromFile(baseName).getContent();
      } catch (e3) {}
    }
    throw e;
  }
}

/**
 * API kích hoạt khởi tạo cưỡng bức từ giao diện quản trị
 * (Chỉ bổ sung danh mục/quyền còn thiếu, không xóa hoặc ghi đè dữ liệu đã có)
 */
function apiInitSystem(force, token) {
  try {
    var actor = AuthService.validateToken(token);
    if (!actor) return { success: false, message: "Phiên làm việc hết hạn hoặc không hợp lệ." };
    PermissionService.checkPermission(actor.id, "settings.update");

    var res = INIT.autoInitSystem(force === true);
    return res;
  } catch (e) {
    return { success: false, message: e.message || e.toString() };
  }
}

/**
 * Trigger chạy định kỳ quét thời hạn văn bản (08:00 sáng mỗi ngày)
 */
function triggerDailyDeadlineScan() {
  return NotificationService.scanDeadlinesAndNotify();
}
