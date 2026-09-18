/**
 * PermissionService.gs
 * Bộ máy kiểm tra và thực thi phân quyền 2 Tầng (2-Tier RBAC Engine)
 */

var PermissionService = {
  _cachedUserPerms: {},

  /**
   * Lấy danh sách toàn bộ mã quyền của 1 người dùng (cả Menu và Action)
   */
  getUserPermissions: function(userId) {
    if (!this._cachedUserPerms) this._cachedUserPerms = {};
    if (this._cachedUserPerms[userId]) return this._cachedUserPerms[userId];

    var userRoles = UserRepository.getUserRolesMap()[userId] || [];
    if (userRoles.length === 0) {
      this._cachedUserPerms[userId] = [];
      return [];
    }

    var allPerms = DB.getAllRows(CONFIG.SHEETS.PERMISSIONS.NAME);
    var permIdMap = {};
    for (var p = 0; p < allPerms.length; p++) {
      permIdMap[allPerms[p].id] = allPerms[p].code;
    }

    var rolePerms = DB.getAllRows(CONFIG.SHEETS.ROLE_PERMISSIONS.NAME);
    var userPermSet = {};

    for (var r = 0; r < userRoles.length; r++) {
      var rObj = userRoles[r];
      // Admin luôn có toàn bộ quyền
      if (rObj.code === "Admin") {
        for (var ap = 0; ap < allPerms.length; ap++) {
          userPermSet[allPerms[ap].code] = true;
        }
        break;
      }

      for (var rp = 0; rp < rolePerms.length; rp++) {
        if (rolePerms[rp].role_id === rObj.id) {
          var code = permIdMap[rolePerms[rp].permission_id];
          if (code) userPermSet[code] = true;
        }
      }
    }

    var result = Object.keys(userPermSet);
    this._cachedUserPerms[userId] = result;
    return result;
  },

  /**
   * Kiểm tra người dùng có quyền thực hiện hành vi hay không
   */
  hasPermission: function(userOrId, permCode) {
    if (!userOrId || !permCode) return false;
    var userId = (typeof userOrId === "object") ? userOrId.id : userOrId;
    var userPerms = this.getUserPermissions(userId);
    return userPerms.indexOf(permCode) !== -1 || userPerms.indexOf("*") !== -1;
  },

  /**
   * Kiểm tra quyền bắt buộc và ném lỗi 403 nếu bị từ chối
   */
  checkPermission: function(userOrId, permCode, customMessage) {
    if (!this.hasPermission(userOrId, permCode)) {
      throw new Error(customMessage || "403: Bạn không có quyền thực hiện thao tác này (" + permCode + ").");
    }
    return true;
  },

  /**
   * Lấy ma trận phân quyền chi tiết cho giao diện cấu hình
   */
  getRolePermissionsMatrix: function() {
    var roles = UserRepository.getAllRoles();
    var permissions = DB.getAllRows(CONFIG.SHEETS.PERMISSIONS.NAME);
    var rolePerms = DB.getAllRows(CONFIG.SHEETS.ROLE_PERMISSIONS.NAME);

    var matrix = {};
    for (var r = 0; r < roles.length; r++) {
      matrix[roles[r].id] = [];
    }

    for (var rp = 0; rp < rolePerms.length; rp++) {
      var rId = rolePerms[rp].role_id;
      if (matrix[rId]) {
        matrix[rId].push(rolePerms[rp].permission_id);
      }
    }

    return {
      roles: roles,
      permissions: permissions,
      matrix: matrix
    };
  },

  /**
   * Lưu ma trận phân quyền cho một vai trò
   */
  saveRolePermissions: function(roleId, permIds, actorId) {
    var role = DB.findRow(CONFIG.SHEETS.ROLES.NAME, function(r) { return r.id === roleId; });
    if (!role) throw new Error("Không tìm thấy vai trò.");
    if (role.code === "Admin") throw new Error("Vai trò Admin luôn có toàn quyền và không thể sửa đổi.");

    // Xóa phân quyền cũ của vai trò
    var allRP = DB.getAllRows(CONFIG.SHEETS.ROLE_PERMISSIONS.NAME);
    var sheet = DB.getSheet(CONFIG.SHEETS.ROLE_PERMISSIONS.NAME);
    for (var i = allRP.length - 1; i >= 0; i--) {
      if (allRP[i].role_id === roleId) {
        sheet.deleteRow(allRP[i]._rowIndex);
      }
    }

    // Thêm các quyền mới
    var newRows = [];
    var nowStr = DateUtils.formatDateTime(new Date());
    for (var p = 0; p < permIds.length; p++) {
      newRows.push({
        id: IdUtils.generateUUID(),
        role_id: roleId,
        permission_id: permIds[p],
        assigned_at: nowStr,
        assigned_by_id: actorId || "SYSTEM"
      });
    }

    if (newRows.length > 0) {
      DB.appendRowsBatch(CONFIG.SHEETS.ROLE_PERMISSIONS.NAME, newRows);
    }

    return { success: true, count: newRows.length };
  }
};
