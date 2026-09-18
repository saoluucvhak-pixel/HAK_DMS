/**
 * Init.gs
 * Tự động kiểm tra và khởi tạo hệ thống Mini DMS (Idempotent Auto-Init)
 * Đảm bảo 15 bảng, cột tiêu đề, quyền hạn 2 tầng, vai trò, tài khoản Root và danh mục cơ sở
 */

var INIT = {
  isInitialized: function() {
    try {
      var cache = CacheService.getScriptCache();
      var cached = cache.get("DMS_INIT_FLAG_V1");
      if (cached === "true") return true;

      var props = PropertiesService.getScriptProperties();
      var propVal = props.getProperty("DMS_INIT_FLAG_V1");
      if (propVal === "true") {
        cache.put("DMS_INIT_FLAG_V1", "true", 21600);
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  },

  markInitialized: function() {
    try {
      PropertiesService.getScriptProperties().setProperty("DMS_INIT_FLAG_V1", "true");
      CacheService.getScriptCache().put("DMS_INIT_FLAG_V1", "true", 21600);
    } catch (e) {}
  },

  /**
   * Khởi tạo toàn diện hệ thống: Bảng, Tiêu đề cột, Quyền hạn, Vai trò, Admin và Danh mục chuẩn
   */
  autoInitSystem: function(force) {
    var self = this;
    if (!force && self.isInitialized()) {
      return {
        initialized: true,
        message: "Hệ thống Mini DMS đã được khởi tạo và đang sẵn sàng."
      };
    }

    return SheetUtils.withLock(function() {
      var ss = DB.getSpreadsheet();
      var allSheets = ss.getSheets();
      var sheetMap = {};
      for (var s = 0; s < allSheets.length; s++) {
        var sh = allSheets[s];
        sheetMap[sh.getName()] = sh;
        DB._cachedSheets[sh.getName()] = sh;
      }

      var createdSheets = [];

      // 1. Tạo tất cả các Sheet trong CONFIG.SHEETS
      for (var sheetKey in CONFIG.SHEETS) {
        var sheetConfig = CONFIG.SHEETS[sheetKey];
        var sheetName = sheetConfig.NAME;
        var headers = sheetConfig.HEADERS;

        var sheet = sheetMap[sheetName];
        if (!sheet) {
          sheet = ss.insertSheet(sheetName);
          sheetMap[sheetName] = sheet;
          DB._cachedSheets[sheetName] = sheet;
          createdSheets.push(sheetName);
        }

        var lastRow = sheet.getLastRow();
        var lastCol = sheet.getLastColumn();

        if (lastRow === 0 || lastCol === 0) {
          sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
          sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#e0e7ff");
          sheet.setFrozenRows(1);
        }
      }

      // 2. Khởi tạo Danh mục 2 Tầng Quyền hạn (PERMISSIONS)
      self.initPermissions();

      // 3. Khởi tạo 5 Vai trò & Ma trận Quyền mặc định
      self.initRolesAndPermissions();

      // 4. Khởi tạo Phòng ban mặc định
      self.initDepartments();

      // 5. Khởi tạo Loại văn bản mặc định
      self.initDocumentTypes();

      // 6. Khởi tạo Sổ cấp số ban đầu cho năm hiện tại
      self.initDocumentNumbering();

      // 7. Khởi tạo Tài khoản Quản trị viên tối cao (Super Admin)
      self.initSuperAdmin();

      // 8. Khởi tạo Cấu hình hệ thống mặc định (APP_SETTINGS)
      self.initAppSettings();

      self.markInitialized();

      return {
        success: true,
        message: "Khởi tạo hệ thống Mini DMS thành công!",
        created_sheets: createdSheets
      };
    }, 20000);
  },

  /**
   * Khởi tạo danh mục quyền vào PERMISSIONS
   */
  initPermissions: function() {
    var existing = DB.getAllRows(CONFIG.SHEETS.PERMISSIONS.NAME);
    var existingCodes = {};
    for (var i = 0; i < existing.length; i++) {
      existingCodes[existing[i].code] = true;
    }

    var nowStr = DateUtils.formatDateTime(new Date());
    var newPerms = [];

    // Nạp Quyền Menu
    for (var m = 0; m < CONFIG.DEFAULT_MENU_PERMISSIONS.length; m++) {
      var pMenu = CONFIG.DEFAULT_MENU_PERMISSIONS[m];
      if (!existingCodes[pMenu.code]) {
        newPerms.push({
          id: "PERM_" + pMenu.code.replace(/\./g, "_").toUpperCase(),
          code: pMenu.code,
          name: pMenu.name,
          module_group: pMenu.module_group,
          perm_type: "MENU",
          description: pMenu.description,
          created_at: nowStr
        });
      }
    }

    // Nạp Quyền Action
    for (var a = 0; a < CONFIG.DEFAULT_ACTION_PERMISSIONS.length; a++) {
      var pAction = CONFIG.DEFAULT_ACTION_PERMISSIONS[a];
      if (!existingCodes[pAction.code]) {
        newPerms.push({
          id: "PERM_" + pAction.code.replace(/\./g, "_").toUpperCase(),
          code: pAction.code,
          name: pAction.name,
          module_group: pAction.module_group,
          perm_type: "ACTION",
          description: pAction.description,
          created_at: nowStr
        });
      }
    }

    if (newPerms.length > 0) {
      DB.appendRowsBatch(CONFIG.SHEETS.PERMISSIONS.NAME, newPerms);
    }
  },

  /**
   * Khởi tạo vai trò và phân quyền
   */
  initRolesAndPermissions: function() {
    var existingRoles = DB.getAllRows(CONFIG.SHEETS.ROLES.NAME);
    var roleCodeMap = {};
    for (var i = 0; i < existingRoles.length; i++) {
      roleCodeMap[existingRoles[i].code] = existingRoles[i];
    }

    var nowStr = DateUtils.formatDateTime(new Date());
    var newRoles = [];

    for (var r = 0; r < CONFIG.DEFAULT_ROLES.length; r++) {
      var rDef = CONFIG.DEFAULT_ROLES[r];
      if (!roleCodeMap[rDef.code]) {
        var rObj = {
          id: rDef.id,
          code: rDef.code,
          name: rDef.name,
          description: rDef.description,
          created_at: nowStr,
          updated_at: nowStr,
          created_by_id: CONFIG.INITIAL_ADMIN.id
        };
        newRoles.push(rObj);
        roleCodeMap[rDef.code] = rObj;
      }
    }

    if (newRoles.length > 0) {
      DB.appendRowsBatch(CONFIG.SHEETS.ROLES.NAME, newRoles);
    }

    // Gán quyền mặc định
    var allPerms = DB.getAllRows(CONFIG.SHEETS.PERMISSIONS.NAME);
    var permCodeMap = {};
    for (var p = 0; p < allPerms.length; p++) {
      permCodeMap[allPerms[p].code] = allPerms[p].id;
    }

    var existingRolePerms = DB.getAllRows(CONFIG.SHEETS.ROLE_PERMISSIONS.NAME);
    var rolePermSet = {};
    for (var rp = 0; rp < existingRolePerms.length; rp++) {
      var key = existingRolePerms[rp].role_id + "_" + existingRolePerms[rp].permission_id;
      rolePermSet[key] = true;
    }

    var newRolePerms = [];
    for (var rCode in CONFIG.DEFAULT_ROLE_PERMISSIONS) {
      var targetRole = roleCodeMap[rCode];
      if (!targetRole) continue;

      var permList = CONFIG.DEFAULT_ROLE_PERMISSIONS[rCode];
      if (permList.indexOf("*") !== -1) {
        for (var pIdx = 0; pIdx < allPerms.length; pIdx++) {
          var pId = allPerms[pIdx].id;
          var k = targetRole.id + "_" + pId;
          if (!rolePermSet[k]) {
            newRolePerms.push({
              id: IdUtils.generateUUID(),
              role_id: targetRole.id,
              permission_id: pId,
              assigned_at: nowStr,
              assigned_by_id: CONFIG.INITIAL_ADMIN.id
            });
            rolePermSet[k] = true;
          }
        }
      } else {
        for (var c = 0; c < permList.length; c++) {
          var code = permList[c];
          var mappedPId = permCodeMap[code];
          if (mappedPId) {
            var k2 = targetRole.id + "_" + mappedPId;
            if (!rolePermSet[k2]) {
              newRolePerms.push({
                id: IdUtils.generateUUID(),
                role_id: targetRole.id,
                permission_id: mappedPId,
                assigned_at: nowStr,
                assigned_by_id: CONFIG.INITIAL_ADMIN.id
              });
              rolePermSet[k2] = true;
            }
          }
        }
      }
    }

    if (newRolePerms.length > 0) {
      DB.appendRowsBatch(CONFIG.SHEETS.ROLE_PERMISSIONS.NAME, newRolePerms);
    }
  },

  /**
   * Khởi tạo phòng ban mặc định
   */
  initDepartments: function() {
    var existing = DB.getAllRows(CONFIG.SHEETS.DEPARTMENTS.NAME);
    var map = {};
    for (var i = 0; i < existing.length; i++) {
      map[existing[i].id] = true;
    }

    var nowStr = DateUtils.formatDateTime(new Date());
    var newDepts = [];
    for (var d = 0; d < CONFIG.DEFAULT_DEPARTMENTS.length; d++) {
      var item = CONFIG.DEFAULT_DEPARTMENTS[d];
      if (!map[item.id]) {
        item.created_at = nowStr;
        item.updated_at = nowStr;
        newDepts.push(item);
      }
    }

    if (newDepts.length > 0) {
      DB.appendRowsBatch(CONFIG.SHEETS.DEPARTMENTS.NAME, newDepts);
    }
  },

  /**
   * Khởi tạo danh mục loại văn bản
   */
  initDocumentTypes: function() {
    var existing = DB.getAllRows(CONFIG.SHEETS.DOCUMENT_TYPES.NAME);
    var map = {};
    for (var i = 0; i < existing.length; i++) {
      map[existing[i].code] = true;
    }

    var nowStr = DateUtils.formatDateTime(new Date());
    var newTypes = [];
    for (var dt = 0; dt < CONFIG.DEFAULT_DOCUMENT_TYPES.length; dt++) {
      var item = CONFIG.DEFAULT_DOCUMENT_TYPES[dt];
      if (!map[item.code]) {
        item.created_at = nowStr;
        newTypes.push(item);
      }
    }

    if (newTypes.length > 0) {
      DB.appendRowsBatch(CONFIG.SHEETS.DOCUMENT_TYPES.NAME, newTypes);
    }
  },

  /**
   * Khởi tạo sổ cấp số nhảy năm hiện tại
   */
  initDocumentNumbering: function() {
    var currentYear = DateUtils.getCurrentYear();
    var nowStr = DateUtils.formatDateTime(new Date());
    var orgCode = ConfigRepository.getSetting("COMPANY_CODE", "DMS");
    var docTypes = DB.getAllRows(CONFIG.SHEETS.DOCUMENT_TYPES.NAME);
    var existing = DB.getAllRows(CONFIG.SHEETS.DOCUMENT_NUMBERING.NAME);

    var map = {};
    for (var i = 0; i < existing.length; i++) {
      var r = existing[i];
      if (r.year == currentYear) {
        map[r.document_type] = true;
      }
    }

    var newRows = [];
    for (var j = 0; j < docTypes.length; j++) {
      var dt = docTypes[j];
      if (dt.status === "DELETED") continue;
      if (!map[dt.code] && !map[dt.id]) {
        var prefix = (dt.prefix || dt.code) + "-" + orgCode;
        newRows.push({
          year: currentYear,
          document_type: dt.code,
          prefix: prefix,
          current_number: 0,
          updated_at: nowStr
        });
      }
    }

    if (newRows.length > 0) {
      DB.appendRowsBatch(CONFIG.SHEETS.DOCUMENT_NUMBERING.NAME, newRows);
    }
  },

  /**
   * Khởi tạo tài khoản Quản trị viên tối cao
   */
  initSuperAdmin: function() {
    var admin = CONFIG.INITIAL_ADMIN;
    var existingUser = DB.findRow(CONFIG.SHEETS.USERS.NAME, function(u) {
      return u.username === admin.username || u.id === admin.id;
    });

    var nowStr = DateUtils.formatDateTime(new Date());

    if (!existingUser) {
      DB.appendRowsBatch(CONFIG.SHEETS.USERS.NAME, [{
        id: admin.id,
        username: admin.username,
        password_hash: admin.password_hash,
        full_name: admin.full_name,
        phone: admin.phone,
        email: admin.email,
        department_id: admin.department_id,
        status: admin.status,
        created_at: nowStr,
        updated_at: nowStr,
        created_by_id: "SYSTEM"
      }]);
    }

    var adminRole = DB.findRow(CONFIG.SHEETS.ROLES.NAME, function(r) {
      return r.code === "Admin";
    });

    if (adminRole) {
      var existingUserRole = DB.findRow(CONFIG.SHEETS.USER_ROLES.NAME, function(ur) {
        return ur.user_id === admin.id && ur.role_id === adminRole.id;
      });

      if (!existingUserRole) {
        DB.appendRowsBatch(CONFIG.SHEETS.USER_ROLES.NAME, [{
          id: IdUtils.generateUUID(),
          user_id: admin.id,
          role_id: adminRole.id,
          assigned_at: nowStr,
          assigned_by_id: "SYSTEM"
        }]);
      }
    }
  },

  /**
   * Khởi tạo tham số cấu hình chung
   */
  initAppSettings: function() {
    var existingSettings = DB.getAllRows(CONFIG.SHEETS.APP_SETTINGS.NAME);
    var keyMap = {};
    for (var i = 0; i < existingSettings.length; i++) {
      if (existingSettings[i].key) keyMap[existingSettings[i].key] = true;
    }

    var nowStr = DateUtils.formatDateTime(new Date());
    var newSettings = [];

    for (var s = 0; s < CONFIG.DEFAULT_SETTINGS.length; s++) {
      var item = CONFIG.DEFAULT_SETTINGS[s];
      if (!keyMap[item.key]) {
        newSettings.push({
          key: item.key,
          value: item.value,
          description: item.description,
          updated_at: nowStr,
          updated_by_id: CONFIG.INITIAL_ADMIN.id
        });
      }
    }

    if (newSettings.length > 0) {
      DB.appendRowsBatch(CONFIG.SHEETS.APP_SETTINGS.NAME, newSettings);
    }
  }
};
