/**
 * SheetUtils.gs
 * Tiện ích truy cập mảng dữ liệu, phân trang và khóa giao dịch
 */

var SheetUtils = {
  /**
   * Băm chuỗi văn bản với thuật toán SHA-256
   */
  sha256: function(str) {
    if (!str) return "";
    var rawHash = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      str,
      Utilities.Charset.UTF_8
    );
    var txtHash = "";
    for (var i = 0; i < rawHash.length; i++) {
      var byteVal = rawHash[i];
      if (byteVal < 0) byteVal += 256;
      var byteHex = byteVal.toString(16);
      if (byteHex.length === 1) byteHex = "0" + byteHex;
      txtHash += byteHex;
    }
    return txtHash;
  },

  /**
   * Phân trang dữ liệu mảng chuẩn Mandatory Pagination
   */
  paginate: function(items, page, pageSize) {
    var p = parseInt(page, 10);
    if (isNaN(p) || p < 1) p = 1;

    var ps = parseInt(pageSize, 10);
    if (isNaN(ps) || ps < 1) ps = 10;
    if (ps > 100) ps = 100;

    var totalItems = items ? items.length : 0;
    var totalPages = Math.ceil(totalItems / ps) || 1;
    if (p > totalPages) p = totalPages;

    var startIndex = (p - 1) * ps;
    var endIndex = Math.min(startIndex + ps, totalItems);
    var pageItems = items ? items.slice(startIndex, endIndex) : [];

    return {
      items: pageItems,
      pagination: {
        page: p,
        pageSize: ps,
        totalItems: totalItems,
        totalPages: totalPages,
        hasNext: p < totalPages,
        hasPrev: p > 1
      }
    };
  },

  /**
   * Khóa giao dịch độc quyền an toàn với LockService
   */
  withLock: function(callback, timeoutMs) {
    var lock = LockService.getScriptLock();
    var waitMs = timeoutMs || 10000;
    var hasLock = false;
    try {
      hasLock = lock.tryLock(waitMs);
      if (!hasLock) {
        throw new Error("Hệ thống đang bận xử lý giao dịch đồng thời. Vui lòng thử lại sau giây lát.");
      }
      return callback();
    } finally {
      if (hasLock) {
        try {
          SpreadsheetApp.flush();
          lock.releaseLock();
        } catch (e) {}
      }
    }
  },

  /**
   * Parse chuỗi JSON an toàn với giá trị fallback
   */
  parseJSON: function(str, fallback) {
    if (!str) return fallback;
    try {
      return JSON.parse(str);
    } catch (e) {
      return fallback;
    }
  }
};

// Khai báo bí danh UTILS tương thích ngược
var UTILS = {
  sha256: SheetUtils.sha256,
  paginate: SheetUtils.paginate,
  withLock: SheetUtils.withLock,
  parseJSON: SheetUtils.parseJSON,
  formatDate: DateUtils.formatDate,
  formatDateDisplay: DateUtils.formatDateDisplay,
  formatDateTime: DateUtils.formatDateTime,
  generateUUID: IdUtils.generateUUID
};
