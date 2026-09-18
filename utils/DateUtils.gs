/**
 * DateUtils.gs
 * Tiện ích xử lý ngày tháng, thời gian và tính toán hạn văn bản (Deadline)
 */

var DateUtils = {
  /**
   * Định dạng Date sang chuỗi YYYY-MM-DD
   */
  formatDate: function(date) {
    if (!date) return "";
    var d = (date instanceof Date) ? date : new Date(date);
    if (isNaN(d.getTime())) return "";
    return Utilities.formatDate(d, CONFIG.TIMEZONE, "yyyy-MM-dd");
  },

  /**
   * Định dạng Date sang chuỗi hiển thị thân thiện DD/MM/YYYY
   */
  formatDateDisplay: function(date) {
    if (!date) return "";
    var d = (date instanceof Date) ? date : new Date(date);
    if (isNaN(d.getTime())) return "";
    return Utilities.formatDate(d, CONFIG.TIMEZONE, "dd/MM/yyyy");
  },

  /**
   * Định dạng DateTime sang chuỗi YYYY-MM-DD HH:mm:ss
   */
  formatDateTime: function(date) {
    if (!date) return "";
    var d = (date instanceof Date) ? date : new Date(date);
    if (isNaN(d.getTime())) return "";
    return Utilities.formatDate(d, CONFIG.TIMEZONE, "yyyy-MM-dd HH:mm:ss");
  },

  /**
   * Lấy năm hiện tại (ví dụ: 2026)
   */
  getCurrentYear: function() {
    return parseInt(Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyy"), 10);
  },

  /**
   * Tính số ngày còn lại đến deadline (trả về số nguyên)
   * Dương: Còn N ngày, 0: Hôm nay là hạn, Âm: Đã quá hạn N ngày
   */
  getDaysRemaining: function(deadlineStr) {
    if (!deadlineStr) return null;
    var target = new Date(deadlineStr);
    if (isNaN(target.getTime())) return null;

    var today = new Date();
    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);

    var diffTime = target.getTime() - today.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
  },

  /**
   * Kiểm tra có quá hạn hay không
   */
  isOverdue: function(deadlineStr) {
    var rem = this.getDaysRemaining(deadlineStr);
    return rem !== null && rem < 0;
  },

  /**
   * Kiểm tra có sắp đến hạn hay không (trong vòng alertDays)
   */
  isDueSoon: function(deadlineStr, alertDays) {
    var days = alertDays || 2;
    var rem = this.getDaysRemaining(deadlineStr);
    return rem !== null && rem >= 0 && rem <= days;
  }
};
