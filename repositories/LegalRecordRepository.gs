/**
 * LegalRecordRepository.gs
 * Lưu trữ và tra cứu Hồ sơ pháp lý doanh nghiệp:
 * Giấy phép ĐKKD, Điều lệ, Biên bản họp HĐTV, Quyết định, Giấy phép môi trường...
 */

var LegalRecordRepository = {
  /**
   * Lấy toàn bộ hồ sơ pháp lý còn hiệu lực lưu trữ (loại trừ đã xóa)
   */
  getAll: function() {
    return DB.getAllRows(CONFIG.SHEETS.LEGAL_RECORDS.NAME).filter(function(r) {
      return r.status !== "DELETED";
    });
  },

  findById: function(id) {
    return DB.findRow(CONFIG.SHEETS.LEGAL_RECORDS.NAME, function(r) {
      return r.id === id;
    });
  },

  /**
   * Lấy danh sách hồ sơ pháp lý có lọc, tìm kiếm, phân trang và trạng thái hiệu lực
   */
  getListWithFilters: function(params) {
    var p = params || {};
    var alertDays = parseInt(ConfigRepository.getSetting("LEGAL_EXPIRY_ALERT_DAYS", "30"), 10) || 30;
    var all = this.getAll();

    var filtered = all.filter(function(r) {
      if (p.type && p.type !== "ALL" && r.type !== p.type) return false;
      if (p.status && p.status !== "ALL" && r.status !== p.status) return false;
      if (p.search) {
        var s = p.search.toLowerCase();
        var matchTitle = (r.title || "").toLowerCase().indexOf(s) !== -1;
        var matchNumber = (r.number || "").toLowerCase().indexOf(s) !== -1;
        var matchAuthority = (r.issuing_authority || "").toLowerCase().indexOf(s) !== -1;
        if (!matchTitle && !matchNumber && !matchAuthority) return false;
      }
      return true;
    });

    var enriched = filtered.map(function(r) {
      var daysRemaining = r.expiry_date ? DateUtils.getDaysRemaining(r.expiry_date) : null;
      var expiryStatus = "NO_EXPIRY";
      if (r.expiry_date) {
        if (DateUtils.isOverdue(r.expiry_date)) {
          expiryStatus = "EXPIRED";
        } else if (DateUtils.isDueSoon(r.expiry_date, alertDays)) {
          expiryStatus = "DUE_SOON";
        } else {
          expiryStatus = "VALID";
        }
      }

      return {
        id: r.id,
        type: r.type,
        title: r.title || "",
        number: r.number || "",
        issuing_authority: r.issuing_authority || "",
        issue_date: r.issue_date || "",
        issue_date_display: r.issue_date ? DateUtils.formatDateDisplay(r.issue_date) : "",
        expiry_date: r.expiry_date || "",
        expiry_date_display: r.expiry_date ? DateUtils.formatDateDisplay(r.expiry_date) : "",
        days_remaining: daysRemaining,
        expiry_status: expiryStatus,
        file_id: r.file_id || "",
        file_name: r.file_name || "",
        status: r.status || "ACTIVE",
        notes: r.notes || "",
        created_at: r.created_at || "",
        updated_at: r.updated_at || ""
      };
    });

    // Sắp xếp ưu tiên hồ sơ sắp/đã hết hạn lên đầu
    enriched.sort(function(a, b) {
      var da = (a.days_remaining === null) ? Infinity : a.days_remaining;
      var db = (b.days_remaining === null) ? Infinity : b.days_remaining;
      return da - db;
    });

    return SheetUtils.paginate(enriched, p.page, p.pageSize || 10);
  },

  /**
   * Lấy các hồ sơ sắp/đã hết hiệu lực (phục vụ quét cảnh báo định kỳ)
   */
  getExpiringSoon: function(alertDays) {
    var days = alertDays || parseInt(ConfigRepository.getSetting("LEGAL_EXPIRY_ALERT_DAYS", "30"), 10) || 30;
    return this.getAll().filter(function(r) {
      if (!r.expiry_date) return false;
      var rem = DateUtils.getDaysRemaining(r.expiry_date);
      return rem !== null && rem <= days;
    });
  },

  /**
   * Thêm mới hoặc cập nhật hồ sơ pháp lý
   */
  save: function(data, actorId) {
    if (!data || !data.type) throw new Error("Vui lòng chọn loại hồ sơ pháp lý.");
    if (!data.title || !data.title.trim()) throw new Error("Vui lòng nhập tên/trích yếu hồ sơ pháp lý.");

    var nowStr = DateUtils.formatDateTime(new Date());

    if (data.id) {
      var existing = this.findById(data.id);
      if (!existing) throw new Error("Không tìm thấy hồ sơ pháp lý cần cập nhật.");

      var updateData = {
        type: data.type,
        title: data.title.trim(),
        number: (data.number || "").trim(),
        issuing_authority: (data.issuing_authority || "").trim(),
        issue_date: data.issue_date || "",
        expiry_date: data.expiry_date || "",
        status: data.status || existing.status || "ACTIVE",
        notes: (data.notes || "").trim(),
        updated_at: nowStr
      };
      if (data.file_id) {
        updateData.file_id = data.file_id;
        updateData.file_name = data.file_name || "";
      }

      DB.updateRowById(CONFIG.SHEETS.LEGAL_RECORDS.NAME, data.id, updateData);
      return Object.assign({}, existing, updateData);
    }

    var newRow = {
      id: "LGL_" + IdUtils.generateUUID(),
      type: data.type,
      title: data.title.trim(),
      number: (data.number || "").trim(),
      issuing_authority: (data.issuing_authority || "").trim(),
      issue_date: data.issue_date || "",
      expiry_date: data.expiry_date || "",
      file_id: data.file_id || "",
      file_name: data.file_name || "",
      status: data.status || "ACTIVE",
      notes: (data.notes || "").trim(),
      created_by_id: actorId || "SYSTEM",
      created_at: nowStr,
      updated_at: nowStr
    };

    DB.appendRowsBatch(CONFIG.SHEETS.LEGAL_RECORDS.NAME, [newRow]);
    return newRow;
  },

  /**
   * Xóa hồ sơ pháp lý (không xóa tệp đã lưu trên Drive)
   */
  deleteRecord: function(id) {
    var existing = this.findById(id);
    if (!existing) throw new Error("Không tìm thấy hồ sơ pháp lý cần xóa.");
    return DB.deleteRowById(CONFIG.SHEETS.LEGAL_RECORDS.NAME, id);
  }
};
