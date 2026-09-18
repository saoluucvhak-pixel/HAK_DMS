/**
 * UserRepository.gs
 * Thao tác dữ liệu người dùng, vai trò, phòng ban và phân quyền
 */

var UserRepository = {
  /**
   * Tìm người dùng theo ID
   */
  findById: function(userId) {
    return DB.findRow(CONFIG.SHEETS.USERS.NAME, function(u) {
      return u.id === userId;
    });
  },

  /**
   * Tìm người dùng theo username
   */
  findByUsername: function(username) {
    if (!username) return null;
    var lower = username.toLowerCase().trim();
    return DB.findRow(CONFIG.SHEETS.USERS.NAME, function(u) {
      return u.username && u.username.toLowerCase().trim() === lower;
    });
  },

  /**
   * Tìm người dùng theo email
   */
  findByEmail: function(email) {
    if (!email) return null;
    var lower = email.toLowerCase().trim();
    return DB.findRow(CONFIG.SHEETS.USERS.NAME, function(u) {
      return u.email && u.email.toLowerCase().trim() === lower;
    });
  },

  /**
   * Lấy danh sách tất cả người dùng kèm thông tin phòng ban & vai trò
   */
  findAllWithDetails: function(filterFn) {
    var users = DB.findRows(CONFIG.SHEETS.USERS.NAME, filterFn);
    var depts = this.getDepartmentsMap();
    var roles = this.getUserRolesMap();

    for (var i = 0; i < users.length; i++) {
      var u = users[i];
      delete u.password_hash; // Bảo mật
      u.department_name = depts[u.department_id] ? depts[u.department_id].name : "Chưa phân bổ";
      u.roles = roles[u.id] || [];
      u.primary_role_name = u.roles.length > 0 ? u.roles[0].name : "Nhân viên";
      u.primary_role_code = u.roles.length > 0 ? u.roles[0].code : "Staff";
    }
    return users;
  },

  /**
   * Thêm người dùng mới
   */
  insert: function(userObj) {
    var nowStr = DateUtils.formatDateTime(new Date());
    userObj.created_at = nowStr;
    userObj.updated_at = nowStr;
    DB.appendRowsBatch(CONFIG.SHEETS.USERS.NAME, [userObj]);
    return userObj;
  },

  /**
   * Cập nhật người dùng
   */
  update: function(userId, updateData) {
    updateData.updated_at = DateUtils.formatDateTime(new Date());
    return DB.updateRowById(CONFIG.SHEETS.USERS.NAME, userId, updateData);
  },

  /**
   * Lấy danh mục phòng ban dạng Map
   */
  getDepartmentsMap: function() {
    var depts = DB.getAllRows(CONFIG.SHEETS.DEPARTMENTS.NAME);
    var map = {};
    for (var i = 0; i < depts.length; i++) {
      map[depts[i].id] = depts[i];
    }
    return map;
  },

  /**
   * Lấy danh sách phòng ban hoạt động
   */
  getAllDepartments: function() {
    return DB.findRows(CONFIG.SHEETS.DEPARTMENTS.NAME, function(r) {
      return r.status !== "DELETED";
    });
  },

  /**
   * Lấy danh mục phòng ban kèm thống kê nhân sự và văn bản
   */
  getDepartmentsWithStats: function() {
    var depts = this.getAllDepartments();
    var users = DB.getAllRows(CONFIG.SHEETS.USERS.NAME);
    var docs = DB.getAllRows(CONFIG.SHEETS.DOCUMENTS.NAME);

    var userCountMap = {};
    var userMap = {};
    for (var u = 0; u < users.length; u++) {
      var user = users[u];
      userMap[user.id] = user;
      if (user.status !== "DELETED") {
        userCountMap[user.department_id] = (userCountMap[user.department_id] || 0) + 1;
      }
    }

    var docCountMap = {};
    for (var d = 0; d < docs.length; d++) {
      var doc = docs[d];
      if (doc.department_id) {
        docCountMap[doc.department_id] = (docCountMap[doc.department_id] || 0) + 1;
      }
    }

    var coreDeptIds = ["DEPT_BGD", "DEPT_VP"];

    return depts.map(function(dept) {
      var manager = dept.manager_id ? userMap[dept.manager_id] : null;
      return {
        id: dept.id,
        code: dept.code,
        name: dept.name,
        manager_id: dept.manager_id || "",
        manager_name: manager ? (manager.full_name + " (" + manager.username + ")") : "Chưa chỉ định",
        email: dept.email || "",
        phone: dept.phone || "",
        status: dept.status || "ACTIVE",
        user_count: userCountMap[dept.id] || 0,
        doc_count: docCountMap[dept.id] || 0,
        is_system: coreDeptIds.indexOf(dept.id) !== -1 || ["BGD", "VP"].indexOf(dept.code) !== -1,
        created_at: dept.created_at || "",
        updated_at: dept.updated_at || ""
      };
    });
  },

  /**
   * Lưu hoặc cập nhật thông tin phòng ban
   */
  saveDepartment: function(deptObj, actorId) {
    var nowStr = DateUtils.formatDateTime(new Date());
    var code = (deptObj.code || "").trim().toUpperCase();
    var name = (deptObj.name || "").trim();

    if (!code || !name) {
      throw new Error("Mã và tên phòng ban là bắt buộc.");
    }

    // Kiểm tra trùng mã code
    var existingCode = DB.findRow(CONFIG.SHEETS.DEPARTMENTS.NAME, function(r) {
      return r.code === code && r.id !== deptObj.id && r.status !== "DELETED";
    });
    if (existingCode) {
      throw new Error("Mã phòng ban [" + code + "] đã được sử dụng.");
    }

    if (deptObj.id) {
      var existing = DB.findRow(CONFIG.SHEETS.DEPARTMENTS.NAME, function(r) {
        return r.id === deptObj.id;
      });
      if (!existing) throw new Error("Không tìm thấy phòng ban.");

      var updateData = {
        code: code,
        name: name,
        manager_id: deptObj.manager_id || "",
        email: deptObj.email || "",
        phone: deptObj.phone || "",
        status: deptObj.status || existing.status || "ACTIVE",
        updated_at: nowStr
      };
      DB.updateRowById(CONFIG.SHEETS.DEPARTMENTS.NAME, deptObj.id, updateData);
      return updateData;
    } else {
      var newId = "DEPT_" + code;
      var newDept = {
        id: newId,
        code: code,
        name: name,
        manager_id: deptObj.manager_id || "",
        email: deptObj.email || "",
        phone: deptObj.phone || "",
        status: deptObj.status || "ACTIVE",
        created_at: nowStr,
        updated_at: nowStr
      };
      DB.appendRowsBatch(CONFIG.SHEETS.DEPARTMENTS.NAME, [newDept]);
      return newDept;
    }
  },

  /**
   * Xóa phòng ban an toàn (Safe Delete)
   */
  deleteDepartment: function(deptId, actorId) {
    var dept = DB.findRow(CONFIG.SHEETS.DEPARTMENTS.NAME, function(r) {
      return r.id === deptId;
    });
    if (!dept) throw new Error("Không tìm thấy phòng ban.");

    if (["DEPT_BGD", "DEPT_VP"].indexOf(dept.id) !== -1 || ["BGD", "VP"].indexOf(dept.code) !== -1) {
      throw new Error("Không thể xóa phòng ban cốt lõi của hệ thống (" + dept.name + ").");
    }

    // Kiểm tra nhân sự trực thuộc
    var userInDept = DB.findRow(CONFIG.SHEETS.USERS.NAME, function(u) {
      return u.department_id === deptId && u.status !== "DELETED";
    });
    if (userInDept) {
      throw new Error("Không thể xóa: Đang có nhân sự trực thuộc phòng ban [" + dept.name + "]. Hãy điều chuyển nhân sự trước!");
    }

    // Kiểm tra văn bản liên quan
    var docInDept = DB.findRow(CONFIG.SHEETS.DOCUMENTS.NAME, function(d) {
      return d.department_id === deptId;
    });
    if (docInDept) {
      throw new Error("Không thể xóa: Phòng ban [" + dept.name + "] đang phụ trách văn bản trong hệ thống. Vui lòng chuyển trạng thái sang Khóa (INACTIVE).");
    }

    var nowStr = DateUtils.formatDateTime(new Date());
    DB.updateRowById(CONFIG.SHEETS.DEPARTMENTS.NAME, deptId, {
      status: "DELETED",
      updated_at: nowStr
    });
    return true;
  },

  /**
   * Khóa hoặc mở khóa phòng ban
   */
  toggleDepartmentStatus: function(deptId, status, actorId) {
    var dept = DB.findRow(CONFIG.SHEETS.DEPARTMENTS.NAME, function(r) {
      return r.id === deptId;
    });
    if (!dept) throw new Error("Không tìm thấy phòng ban.");

    var nowStr = DateUtils.formatDateTime(new Date());
    DB.updateRowById(CONFIG.SHEETS.DEPARTMENTS.NAME, deptId, {
      status: status,
      updated_at: nowStr
    });
    return true;
  },

  /**
   * Lấy danh sách vai trò
   */
  getAllRoles: function() {
    return DB.getAllRows(CONFIG.SHEETS.ROLES.NAME);
  },

  /**
   * Lấy map vai trò của từng user: { userId: [ { id, code, name } ] }
   */
  getUserRolesMap: function() {
    var userRoles = DB.getAllRows(CONFIG.SHEETS.USER_ROLES.NAME);
    var roles = DB.getAllRows(CONFIG.SHEETS.ROLES.NAME);
    var roleMap = {};
    for (var r = 0; r < roles.length; r++) {
      roleMap[roles[r].id] = roles[r];
    }

    var result = {};
    for (var i = 0; i < userRoles.length; i++) {
      var ur = userRoles[i];
      if (!result[ur.user_id]) result[ur.user_id] = [];
      if (roleMap[ur.role_id]) {
        result[ur.user_id].push(roleMap[ur.role_id]);
      }
    }
    return result;
  },

  /**
   * Gán vai trò cho người dùng
   */
  assignUserRole: function(userId, roleId, actorId) {
    // Xóa các vai trò cũ của user
    var allUserRoles = DB.getAllRows(CONFIG.SHEETS.USER_ROLES.NAME);
    var sheet = DB.getSheet(CONFIG.SHEETS.USER_ROLES.NAME);
    for (var i = allUserRoles.length - 1; i >= 0; i--) {
      if (allUserRoles[i].user_id === userId) {
        sheet.deleteRow(allUserRoles[i]._rowIndex);
      }
    }

    // Thêm vai trò mới
    var nowStr = DateUtils.formatDateTime(new Date());
    DB.appendRowsBatch(CONFIG.SHEETS.USER_ROLES.NAME, [{
      id: IdUtils.generateUUID(),
      user_id: userId,
      role_id: roleId,
      assigned_at: nowStr,
      assigned_by_id: actorId || "SYSTEM"
    }]);
  },

  // 5 vai trò hệ thống không được phép xóa
  SYSTEM_ROLES: ["ROLE_ADMIN", "ROLE_DIRECTOR", "ROLE_DEPT_HEAD", "ROLE_CLERK", "ROLE_STAFF"],

  /**
   * Lấy danh sách vai trò kèm thống kê số lượng nhân sự và phân loại hệ thống
   */
  getRolesWithStats: function() {
    var roles = DB.getAllRows(CONFIG.SHEETS.ROLES.NAME);
    var userRoles = DB.getAllRows(CONFIG.SHEETS.USER_ROLES.NAME);

    var countMap = {};
    for (var i = 0; i < userRoles.length; i++) {
      var rId = userRoles[i].role_id;
      countMap[rId] = (countMap[rId] || 0) + 1;
    }

    var self = this;
    return roles.map(function(r) {
      var isSystem = self.SYSTEM_ROLES.indexOf(r.id) !== -1 || r.code === "Admin";
      return {
        id: r.id,
        code: r.code,
        name: r.name,
        description: r.description || "",
        user_count: countMap[r.id] || 0,
        is_system: isSystem,
        created_at: r.created_at || ""
      };
    });
  },

  /**
   * Thêm mới hoặc cập nhật vai trò
   */
  saveRole: function(roleData, actorId) {
    var nowStr = DateUtils.formatDateTime(new Date());

    if (roleData.id) {
      var existing = DB.findRow(CONFIG.SHEETS.ROLES.NAME, function(r) { return r.id === roleData.id; });
      if (!existing) throw new Error("Không tìm thấy vai trò.");

      var updateFields = {
        name: roleData.name,
        description: roleData.description || "",
        updated_at: nowStr
      };

      var isSystem = this.SYSTEM_ROLES.indexOf(existing.id) !== -1 || existing.code === "Admin";
      if (!isSystem && roleData.code) {
        updateFields.code = roleData.code.trim();
      }

      DB.updateRowById(CONFIG.SHEETS.ROLES.NAME, roleData.id, updateFields);
      return { success: true, id: roleData.id };
    } else {
      var code = (roleData.code || "").trim();
      if (!code) throw new Error("Mã vai trò không được để trống.");

      var checkDup = DB.findRow(CONFIG.SHEETS.ROLES.NAME, function(r) {
        return (r.code || "").toLowerCase() === code.toLowerCase();
      });
      if (checkDup) throw new Error("Mã vai trò '" + code + "' đã tồn tại.");

      var newId = "ROLE_" + code.toUpperCase().replace(/[^A-Z0-9_]/g, "_");
      var newRole = {
        id: newId,
        code: code,
        name: roleData.name || code,
        description: roleData.description || "",
        created_at: nowStr,
        updated_at: nowStr,
        created_by_id: actorId || "SYSTEM"
      };

      DB.appendRowsBatch(CONFIG.SHEETS.ROLES.NAME, [newRole]);
      return { success: true, id: newId, role: newRole };
    }
  },

  /**
   * Xóa vai trò tùy chỉnh
   */
  deleteRole: function(roleId, actorId) {
    var role = DB.findRow(CONFIG.SHEETS.ROLES.NAME, function(r) { return r.id === roleId; });
    if (!role) throw new Error("Không tìm thấy vai trò.");

    if (this.SYSTEM_ROLES.indexOf(role.id) !== -1 || role.code === "Admin") {
      throw new Error("Không thể xóa vai trò hệ thống cốt lõi (" + role.name + ").");
    }

    var userRoles = DB.getAllRows(CONFIG.SHEETS.USER_ROLES.NAME);
    var inUse = userRoles.some(function(ur) { return ur.role_id === roleId; });
    if (inUse) {
      throw new Error("Không thể xóa vai trò đang có nhân sự sử dụng. Vui lòng chuyển vai trò cho nhân sự trước.");
    }

    var rolePerms = DB.getAllRows(CONFIG.SHEETS.ROLE_PERMISSIONS.NAME);
    var rpSheet = DB.getSheet(CONFIG.SHEETS.ROLE_PERMISSIONS.NAME);
    for (var i = rolePerms.length - 1; i >= 0; i--) {
      if (rolePerms[i].role_id === roleId) {
        rpSheet.deleteRow(rolePerms[i]._rowIndex);
      }
    }

    var rolesSheet = DB.getSheet(CONFIG.SHEETS.ROLES.NAME);
    rolesSheet.deleteRow(role._rowIndex);

    return { success: true, message: "Đã xóa vai trò thành công." };
  }
};
