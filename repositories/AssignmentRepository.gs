/**
 * AssignmentRepository.gs
 * Thao tác dữ liệu bảng ASSIGNMENTS (Phân công nhiệm vụ xử lý văn bản)
 */

var AssignmentRepository = {
  /**
   * Tìm phân công theo ID
   */
  findById: function(assignmentId) {
    return DB.findRow(CONFIG.SHEETS.ASSIGNMENTS.NAME, function(r) {
      return r.id === assignmentId;
    });
  },

  /**
   * Lấy danh sách phân công theo Document ID
   */
  findByDocumentId: function(documentId) {
    return DB.findRows(CONFIG.SHEETS.ASSIGNMENTS.NAME, function(r) {
      return r.document_id === documentId;
    });
  },

  /**
   * Lấy danh sách nhiệm vụ được phân công cho 1 chuyên viên / nhân viên
   */
  findByAssigneeId: function(assigneeId, statusFilter) {
    return DB.findRows(CONFIG.SHEETS.ASSIGNMENTS.NAME, function(r) {
      var matchAssignee = (r.assignee_id === assigneeId);
      if (!matchAssignee) return false;
      if (statusFilter && statusFilter !== "ALL") {
        return r.status === statusFilter;
      }
      return true;
    });
  },

  /**
   * Lấy số thứ tự phân công tiếp theo
   */
  getNextSequence: function() {
    var all = DB.getAllRows(CONFIG.SHEETS.ASSIGNMENTS.NAME);
    var maxSeq = 0;
    for (var i = 0; i < all.length; i++) {
      var parts = (all[i].id || "").split("-");
      if (parts.length === 2) {
        var seq = parseInt(parts[1], 10);
        if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
      }
    }
    return maxSeq + 1;
  },

  /**
   * Thêm mới danh sách phân công (1 chủ trì + N phối hợp)
   */
  insertBatch: function(assignmentsList) {
    if (!assignmentsList || assignmentsList.length === 0) return [];
    var currentSeq = this.getNextSequence();
    var nowStr = DateUtils.formatDateTime(new Date());

    for (var i = 0; i < assignmentsList.length; i++) {
      var item = assignmentsList[i];
      item.id = item.id || IdUtils.generateAssignmentId(currentSeq + i);
      item.assigned_at = item.assigned_at || nowStr;
      item.status = item.status || "PENDING";
    }

    DB.appendRowsBatch(CONFIG.SHEETS.ASSIGNMENTS.NAME, assignmentsList);
    return assignmentsList;
  },

  /**
   * Cập nhật thông tin phân công
   */
  update: function(assignmentId, updateData) {
    return DB.updateRowById(CONFIG.SHEETS.ASSIGNMENTS.NAME, assignmentId, updateData);
  }
};
