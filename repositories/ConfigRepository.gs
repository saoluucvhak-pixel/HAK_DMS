/**
 * ConfigRepository.gs
 * Thao tác dữ liệu cấu hình hệ thống, danh mục loại văn bản và sổ cấp số
 */

var ConfigRepository = {
  /**
   * Lấy giá trị tham số cấu hình theo key
   */
  getSetting: function(key, defaultValue) {
    var row = DB.findRow(CONFIG.SHEETS.APP_SETTINGS.NAME, function(s) {
      return s.key === key;
    });
    return row && row.value !== undefined ? row.value : defaultValue;
  },

  /**
   * Lưu hoặc cập nhật tham số cấu hình
   */
  setSetting: function(key, value, actorId) {
    var nowStr = DateUtils.formatDateTime(new Date());
    var row = DB.findRow(CONFIG.SHEETS.APP_SETTINGS.NAME, function(s) {
      return s.key === key;
    });
    if (row) {
      DB.updateRowByMatch(CONFIG.SHEETS.APP_SETTINGS.NAME, function(s) {
        return s.key === key;
      }, {
        value: value,
        updated_at: nowStr,
        updated_by_id: actorId || "SYSTEM"
      });
    } else {
      DB.appendRowsBatch(CONFIG.SHEETS.APP_SETTINGS.NAME, [{
        key: key,
        value: value,
        description: "",
        updated_at: nowStr,
        updated_by_id: actorId || "SYSTEM"
      }]);
    }
  },

  /**
   * Lấy tất cả cấu hình hệ thống
   */
  getAllSettings: function() {
    return DB.getAllRows(CONFIG.SHEETS.APP_SETTINGS.NAME);
  },

  SYSTEM_DOCUMENT_TYPES: ["DT_CV", "DT_QD", "DT_TT", "DT_TB"],

  /**
   * Lấy danh mục loại văn bản / loại sổ (loại trừ đã xóa)
   */
  getAllDocumentTypes: function() {
    var all = DB.getAllRows(CONFIG.SHEETS.DOCUMENT_TYPES.NAME);
    return all.filter(function(dt) {
      return dt.status !== "DELETED";
    });
  },

  /**
   * Lấy danh mục loại văn bản kèm thống kê số lượng văn bản đang dùng
   */
  getDocumentTypesWithStats: function() {
    var docTypes = this.getAllDocumentTypes();
    var docs = DB.getAllRows(CONFIG.SHEETS.DOCUMENTS.NAME);

    // Đếm số lượng văn bản theo từng category_id
    var countMap = {};
    docs.forEach(function(d) {
      var cat = d.category_id || "";
      countMap[cat] = (countMap[cat] || 0) + 1;
    });

    var self = this;
    return docTypes.map(function(dt) {
      var isSystem = self.SYSTEM_DOCUMENT_TYPES.indexOf(dt.id) !== -1 ||
        ["CONG_VAN", "QUYET_DINH", "TO_TRINH", "THONG_BAO"].indexOf(dt.code) !== -1;
      
      var count = (countMap[dt.id] || 0) + (countMap[dt.code] || 0);

      return {
        id: dt.id,
        code: dt.code || "",
        name: dt.name || "",
        prefix: dt.prefix || "",
        description: dt.description || "",
        status: dt.status || "ACTIVE",
        created_at: dt.created_at || "",
        document_count: count,
        is_system: isSystem
      };
    });
  },

  /**
   * Thêm hoặc sửa loại văn bản
   */
  saveDocumentType: function(typeObj, actorId) {
    var nowStr = DateUtils.formatDateTime(new Date());
    var docTypes = this.getAllDocumentTypes();

    if (typeObj.id) {
      var existing = DB.findRow(CONFIG.SHEETS.DOCUMENT_TYPES.NAME, function(dt) {
        return dt.id === typeObj.id;
      });
      if (!existing) throw new Error("Không tìm thấy loại sổ cần cập nhật.");

      var updateData = {
        name: typeObj.name.trim(),
        prefix: (typeObj.prefix || "").trim().toUpperCase(),
        description: (typeObj.description || "").trim(),
        status: typeObj.status || existing.status || "ACTIVE",
        updated_at: nowStr,
        updated_by_id: actorId || "SYSTEM"
      };

      // Nếu không phải loại sổ hệ thống thì cho sửa cả code
      var isSystem = this.SYSTEM_DOCUMENT_TYPES.indexOf(existing.id) !== -1;
      if (!isSystem && typeObj.code) {
        updateData.code = typeObj.code.trim().toUpperCase();
      }

      DB.updateRowById(CONFIG.SHEETS.DOCUMENT_TYPES.NAME, typeObj.id, updateData);
      return Object.assign({}, existing, updateData);
    } else {
      var code = (typeObj.code || "").trim().toUpperCase();
      var prefix = (typeObj.prefix || "").trim().toUpperCase();
      var name = (typeObj.name || "").trim();

      if (!code || !name) throw new Error("Vui lòng điền đầy đủ mã và tên loại sổ.");

      // Kiểm tra trùng mã code
      var duplicate = docTypes.find(function(dt) {
        return dt.code === code;
      });
      if (duplicate) throw new Error("Mã loại sổ [" + code + "] đã tồn tại trong hệ thống.");

      var newId = "DT_" + (prefix || code || IdUtils.generateUUID().substring(0, 4));
      // Kiểm tra nếu ID đã có thì thêm hậu tố ngẫu nhiên
      var idExists = docTypes.some(function(dt) { return dt.id === newId; });
      if (idExists) newId += "_" + Math.floor(Math.random() * 1000);

      var newRow = {
        id: newId,
        code: code,
        name: name,
        prefix: prefix || "VB",
        description: (typeObj.description || "").trim(),
        status: typeObj.status || "ACTIVE",
        created_at: nowStr,
        created_by_id: actorId || "SYSTEM"
      };

      DB.appendRowsBatch(CONFIG.SHEETS.DOCUMENT_TYPES.NAME, [newRow]);
      return newRow;
    }
  },

  /**
   * Xóa an toàn loại văn bản (Safe Delete)
   */
  deleteDocumentType: function(typeId, actorId) {
    if (this.SYSTEM_DOCUMENT_TYPES.indexOf(typeId) !== -1) {
      throw new Error("Đây là loại sổ cốt lõi của hệ thống, không thể xóa.");
    }

    // Kiểm tra có văn bản nào đang dùng không
    var docs = DB.findRows(CONFIG.SHEETS.DOCUMENTS.NAME, function(d) {
      return d.category_id === typeId;
    });
    if (docs.length > 0) {
      throw new Error("Không thể xóa vì đang có " + docs.length + " văn bản thuộc loại sổ này. Bạn có thể chuyển sang trạng thái 'Tạm khóa' thay vì xóa.");
    }

    var nowStr = DateUtils.formatDateTime(new Date());
    return DB.updateRowById(CONFIG.SHEETS.DOCUMENT_TYPES.NAME, typeId, {
      status: "DELETED",
      deleted_at: nowStr,
      deleted_by_id: actorId || "SYSTEM"
    });
  },

  /**
   * Bật / Tắt trạng thái hoạt động của loại sổ
   */
  toggleDocumentTypeStatus: function(typeId, status, actorId) {
    var nowStr = DateUtils.formatDateTime(new Date());
    return DB.updateRowById(CONFIG.SHEETS.DOCUMENT_TYPES.NAME, typeId, {
      status: status,
      updated_at: nowStr,
      updated_by_id: actorId || "SYSTEM"
    });
  },

  /**
   * Lấy danh sách cấu hình cấp số nhảy văn bản đi
   */
  getAllNumbering: function() {
    return DB.getAllRows(CONFIG.SHEETS.DOCUMENT_NUMBERING.NAME);
  }
};
