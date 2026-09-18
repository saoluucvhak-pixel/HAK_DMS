/**
 * DocumentRepository.gs
 * Thao tác dữ liệu bảng DOCUMENTS, WORKFLOW_HISTORY và COMMENTS
 */

var DocumentRepository = {
  /**
   * Tìm văn bản theo ID
   */
  findById: function(docId) {
    return DB.findRow(CONFIG.SHEETS.DOCUMENTS.NAME, function(r) {
      return r.id === docId;
    });
  },

  /**
   * Lấy danh sách văn bản theo điều kiện lọc
   */
  findAll: function(filterFn) {
    return DB.findRows(CONFIG.SHEETS.DOCUMENTS.NAME, filterFn);
  },

  /**
   * Thêm mới một văn bản vào sổ
   */
  insert: function(doc) {
    DB.appendRowsBatch(CONFIG.SHEETS.DOCUMENTS.NAME, [doc]);
    return doc;
  },

  /**
   * Cập nhật thông tin văn bản theo ID
   */
  update: function(docId, updateData) {
    updateData.updated_at = DateUtils.formatDateTime(new Date());
    return DB.updateRowById(CONFIG.SHEETS.DOCUMENTS.NAME, docId, updateData);
  },

  /**
   * Lấy số thứ tự văn bản tiếp theo trong năm
   */
  getNextSequence: function(year) {
    var y = year || DateUtils.getCurrentYear();
    var docs = DB.findRows(CONFIG.SHEETS.DOCUMENTS.NAME, function(r) {
      return r.id && r.id.indexOf("DOC-" + y + "-") === 0;
    });
    var maxSeq = 0;
    for (var i = 0; i < docs.length; i++) {
      var parts = docs[i].id.split("-");
      if (parts.length === 3) {
        var seq = parseInt(parts[2], 10);
        if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
      }
    }
    return maxSeq + 1;
  },

  /**
   * Ghi nhận bước chuyển trạng thái quy trình vào WORKFLOW_HISTORY
   */
  addHistory: function(historyObj) {
    var seq = DB.getAllRows(CONFIG.SHEETS.WORKFLOW_HISTORY.NAME).length + 1;
    historyObj.id = historyObj.id || IdUtils.generateHistoryId(seq);
    historyObj.created_at = historyObj.created_at || DateUtils.formatDateTime(new Date());
    DB.appendRowsBatch(CONFIG.SHEETS.WORKFLOW_HISTORY.NAME, [historyObj]);
    return historyObj;
  },

  /**
   * Lấy lịch sử luân chuyển của 1 văn bản
   */
  getHistories: function(documentId) {
    return DB.findRows(CONFIG.SHEETS.WORKFLOW_HISTORY.NAME, function(h) {
      return h.document_id === documentId;
    });
  },

  /**
   * Thêm ý kiến chỉ đạo / thảo luận vào COMMENTS
   */
  addComment: function(commentObj) {
    var seq = DB.getAllRows(CONFIG.SHEETS.COMMENTS.NAME).length + 1;
    commentObj.id = commentObj.id || IdUtils.generateCommentId(seq);
    commentObj.created_at = commentObj.created_at || DateUtils.formatDateTime(new Date());
    DB.appendRowsBatch(CONFIG.SHEETS.COMMENTS.NAME, [commentObj]);
    return commentObj;
  },

  /**
   * Lấy danh sách bình luận của 1 văn bản
   */
  getComments: function(documentId) {
    return DB.findRows(CONFIG.SHEETS.COMMENTS.NAME, function(c) {
      return c.document_id === documentId;
    });
  }
};
