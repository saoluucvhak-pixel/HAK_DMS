/**
 * IdUtils.gs
 * Tiện ích sinh mã định danh duy nhất (Unique IDs) chuẩn hóa
 */

var IdUtils = {
  /**
   * Sinh UUID ngẫu nhiên v4
   */
  generateUUID: function() {
    return Utilities.getUuid();
  },

  /**
   * Định dạng số tự tăng với padding 0 phía trước
   */
  padZero: function(num, size) {
    var s = num + "";
    while (s.length < (size || 6)) s = "0" + s;
    return s;
  },

  /**
   * Sinh mã Văn bản chuẩn: DOC-[NĂM]-[6 CHỮ SỐ] (ví dụ: DOC-2026-000123)
   */
  generateDocId: function(year, sequenceNumber) {
    var y = year || DateUtils.getCurrentYear();
    return "DOC-" + y + "-" + this.padZero(sequenceNumber, 6);
  },

  /**
   * Sinh mã Phân công chuẩn: ASN-[6 CHỮ SỐ] (ví dụ: ASN-000123)
   */
  generateAssignmentId: function(sequenceNumber) {
    return "ASN-" + this.padZero(sequenceNumber, 6);
  },

  /**
   * Sinh mã Lịch sử Luân chuyển: WFH-[6 CHỮ SỐ]
   */
  generateHistoryId: function(sequenceNumber) {
    return "WFH-" + this.padZero(sequenceNumber, 6);
  },

  /**
   * Sinh mã Kiểm toán: AUD-[6 CHỮ SỐ]
   */
  generateAuditId: function(sequenceNumber) {
    return "AUD-" + this.padZero(sequenceNumber, 6);
  },

  /**
   * Sinh mã Ý kiến / Bình luận: CMT-[6 CHỮ SỐ]
   */
  generateCommentId: function(sequenceNumber) {
    return "CMT-" + this.padZero(sequenceNumber, 6);
  }
};
