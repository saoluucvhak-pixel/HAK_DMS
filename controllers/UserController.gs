/**
 * UserController.gs
 * Điều phối các API xác thực, người dùng, phòng ban, vai trò, cấu hình và nhật ký kiểm toán
 */

function apiLogin(username, password, clientInfo) {
  return AuthService.login(username, password, clientInfo);
}

function apiLogout(token) {
  return AuthService.logout(token);
}

function apiGetSessionUser(token) {
  var user = AuthService.validateToken(token);
  if (!user) return { success: false, message: "Phiên làm việc hết hạn." };

  var userRoles = UserRepository.getUserRolesMap()[user.id] || [];
  var permissions = PermissionService.getUserPermissions(user.id);
  delete user.password_hash;

  return {
    success: true,
    user: user,
    roles: userRoles,
    permissions: permissions
  };
}

function apiGetUsersList(params, token) {
  try {
    var user = AuthService.validateToken(token);
    if (!user) return { success: false, message: "Phiên làm việc hết hạn." };
    PermissionService.checkPermission(user.id, "menu.users");

    var p = params || {};
    var all = UserRepository.findAllWithDetails(function(u) {
      if (p.status && p.status !== "ALL" && u.status !== p.status) return false;
      if (p.department_id && p.department_id !== "ALL" && u.department_id !== p.department_id) return false;
      if (p.search) {
        var s = p.search.toLowerCase();
        var matchUser = (u.username || "").toLowerCase().indexOf(s) !== -1;
        var matchName = (u.full_name || "").toLowerCase().indexOf(s) !== -1;
        var matchPhone = (u.phone || "").toLowerCase().indexOf(s) !== -1;
        if (!matchUser && !matchName && !matchPhone) return false;
      }
      return true;
    });

    var paged = SheetUtils.paginate(all, p.page, p.pageSize || 10);
    return { success: true, data: paged };
  } catch (e) {
    return { success: false, message: e.message || e.toString() };
  }
}

function apiSaveUser(userData, token) {
  try {
    var actor = AuthService.validateToken(token);
    if (!actor) return { success: false, message: "Phiên làm việc hết hạn." };

    if (userData.id) {
      PermissionService.checkPermission(actor.id, "users.update");
      var existing = UserRepository.findById(userData.id);
      if (!existing) throw new Error("Không tìm thấy người dùng.");

      var updateFields = {
        full_name: userData.full_name,
        phone: userData.phone,
        email: userData.email,
        department_id: userData.department_id,
        status: userData.status
      };

      if (userData.password) {
        updateFields.password_hash = SheetUtils.sha256(userData.password);
      }

      UserRepository.update(userData.id, updateFields);

      if (userData.role_id) {
        UserRepository.assignUserRole(userData.id, userData.role_id, actor.id);
      }

      AuditService.log({
        actor: actor,
        action: "UPDATE_USER",
        entity_type: "USER",
        entity_id: userData.id,
        message_snapshot: "Cập nhật thông tin nhân sự: " + userData.full_name + " (" + existing.username + ")"
      });

      return { success: true, id: userData.id };
    } else {
      PermissionService.checkPermission(actor.id, "users.create");
      var checkDup = UserRepository.findByUsername(userData.username);
      if (checkDup) throw new Error("Tên đăng nhập '" + userData.username + "' đã tồn tại.");

      var newUser = SheetUtils.withLock(function() {
        var allUsers = DB.getAllRows(CONFIG.SHEETS.USERS.NAME);
        var nextId = "USR" + IdUtils.padZero(allUsers.length + 1, 3);

        var userObj = {
          id: nextId,
          username: userData.username.toLowerCase().trim(),
          password_hash: SheetUtils.sha256(userData.password || "123456"),
          full_name: userData.full_name,
          phone: userData.phone || "",
          email: userData.email || "",
          department_id: userData.department_id || "",
          status: "ACTIVE",
          created_by_id: actor.id
        };

        UserRepository.insert(userObj);
        return userObj;
      }, 10000);

      if (userData.role_id) {
        UserRepository.assignUserRole(newUser.id, userData.role_id, actor.id);
      }

      AuditService.log({
        actor: actor,
        action: "CREATE_USER",
        entity_type: "USER",
        entity_id: newUser.id,
        message_snapshot: "Tạo tài khoản người dùng mới: " + newUser.full_name + " (" + newUser.username + ")"
      });

      return { success: true, id: newUser.id };
    }
  } catch (e) {
    return { success: false, message: e.message || e.toString() };
  }
}

function apiLockUser(userId, isLocked, token) {
  try {
    var actor = AuthService.validateToken(token);
    if (!actor) return { success: false, message: "Phiên làm việc hết hạn." };
    PermissionService.checkPermission(actor.id, "users.lock");

    if (userId === CONFIG.INITIAL_ADMIN.id) {
      throw new Error("Không thể khóa tài khoản Quản trị viên tối cao (Super Admin).");
    }

    var newStatus = isLocked ? "LOCKED" : "ACTIVE";
    UserRepository.update(userId, { status: newStatus });

    AuditService.log({
      actor: actor,
      action: isLocked ? "LOCK_USER" : "UNLOCK_USER",
      entity_type: "USER",
      entity_id: userId,
      message_snapshot: (isLocked ? "Khóa" : "Mở khóa") + " tài khoản người dùng " + userId
    });

    return { success: true, status: newStatus };
  } catch (e) {
    return { success: false, message: e.message || e.toString() };
  }
}

function apiResetPassword(userId, newPassword, token) {
  try {
    var actor = AuthService.validateToken(token);
    if (!actor) return { success: false, message: "Phiên làm việc hết hạn." };
    PermissionService.checkPermission(actor.id, "users.reset_password");

    var pass = newPassword || "123456";
    UserRepository.update(userId, { password_hash: SheetUtils.sha256(pass) });

    AuditService.log({
      actor: actor,
      action: "RESET_PASSWORD",
      entity_type: "USER",
      entity_id: userId,
      message_snapshot: "Đặt lại mật khẩu cho tài khoản: " + userId
    });

    return { success: true, message: "Đặt lại mật khẩu thành công." };
  } catch (e) {
    return { success: false, message: e.message || e.toString() };
  }
}

function apiGetDepartmentsList(token) {
  try {
    var user = AuthService.validateToken(token);
    if (!user) return { success: false, message: "Phiên làm việc hết hạn." };
    var depts = UserRepository.getDepartmentsWithStats();
    return { success: true, data: depts };
  } catch (e) {
    return { success: false, message: e.message || e.toString() };
  }
}

function apiSaveDepartment(data, token) {
  try {
    var actor = AuthService.validateToken(token);
    if (!actor) return { success: false, message: "Phiên làm việc hết hạn." };
    PermissionService.checkPermission(actor.id, "departments.manage");

    var saved = UserRepository.saveDepartment(data, actor.id);

    AuditService.log({
      actor: actor,
      action: data.id ? "UPDATE_DEPARTMENT" : "CREATE_DEPARTMENT",
      entity_type: "DEPARTMENT",
      entity_id: saved.id || data.id,
      message_snapshot: (data.id ? "Cập nhật" : "Tạo mới") + " thông tin phòng ban: " + (data.name || "")
    });

    return { success: true, data: saved };
  } catch (e) {
    return { success: false, message: e.message || e.toString() };
  }
}

function apiDeleteDepartment(deptId, token) {
  try {
    var actor = AuthService.validateToken(token);
    if (!actor) return { success: false, message: "Phiên làm việc hết hạn." };
    PermissionService.checkPermission(actor.id, "departments.manage");

    UserRepository.deleteDepartment(deptId, actor.id);

    AuditService.log({
      actor: actor,
      action: "DELETE_DEPARTMENT",
      entity_type: "DEPARTMENT",
      entity_id: deptId,
      message_snapshot: "Xóa phòng ban khỏi hệ thống: " + deptId
    });

    return { success: true };
  } catch (e) {
    return { success: false, message: e.message || e.toString() };
  }
}

function apiToggleDepartmentStatus(deptId, status, token) {
  try {
    var actor = AuthService.validateToken(token);
    if (!actor) return { success: false, message: "Phiên làm việc hết hạn." };
    PermissionService.checkPermission(actor.id, "departments.manage");

    UserRepository.toggleDepartmentStatus(deptId, status, actor.id);

    AuditService.log({
      actor: actor,
      action: status === "ACTIVE" ? "UNLOCK_DEPARTMENT" : "LOCK_DEPARTMENT",
      entity_type: "DEPARTMENT",
      entity_id: deptId,
      message_snapshot: (status === "ACTIVE" ? "Mở khóa" : "Khóa") + " phòng ban: " + deptId
    });

    return { success: true, status: status };
  } catch (e) {
    return { success: false, message: e.message || e.toString() };
  }
}


function apiGetRolesList(token) {
  try {
    var user = AuthService.validateToken(token);
    if (!user) return { success: false, message: "Phiên làm việc hết hạn." };

    // Cho phép nếu có quyền menu.users (chọn vai trò khi tạo/sửa tài khoản) hoặc menu.roles
    var hasMenuAccess = PermissionService.hasPermission(user.id, "menu.users") ||
                        PermissionService.hasPermission(user.id, "menu.roles");
    if (!hasMenuAccess) {
      throw new Error("403: Bạn không có quyền truy cập danh sách vai trò.");
    }

    var roles = UserRepository.getRolesWithStats();
    return { success: true, data: roles };
  } catch (e) {
    return { success: false, message: e.message || e.toString() };
  }
}

function apiSaveRole(roleData, token) {
  try {
    var actor = AuthService.validateToken(token);
    if (!actor) return { success: false, message: "Phiên làm việc hết hạn." };

    if (roleData.id) {
      PermissionService.checkPermission(actor.id, "roles.update");
    } else {
      PermissionService.checkPermission(actor.id, "roles.create");
    }

    var result = UserRepository.saveRole(roleData, actor.id);

    AuditService.log({
      actor: actor,
      action: roleData.id ? "UPDATE_ROLE" : "CREATE_ROLE",
      entity_type: "ROLE",
      entity_id: result.id,
      message_snapshot: (roleData.id ? "Cập nhật" : "Tạo mới") + " vai trò quyền hạn: " + roleData.name
    });

    return result;
  } catch (e) {
    return { success: false, message: e.message || e.toString() };
  }
}

function apiDeleteRole(roleId, token) {
  try {
    var actor = AuthService.validateToken(token);
    if (!actor) return { success: false, message: "Phiên làm việc hết hạn." };
    PermissionService.checkPermission(actor.id, "roles.delete");

    var result = UserRepository.deleteRole(roleId, actor.id);

    AuditService.log({
      actor: actor,
      action: "DELETE_ROLE",
      entity_type: "ROLE",
      entity_id: roleId,
      message_snapshot: "Xóa vai trò tùy chỉnh: " + roleId
    });

    return result;
  } catch (e) {
    return { success: false, message: e.message || e.toString() };
  }
}

function apiGetRolePermissionsMatrix(token) {
  try {
    var user = AuthService.validateToken(token);
    if (!user) return { success: false, message: "Phiên làm việc hết hạn." };

    // Cho phép nếu có quyền menu.users hoặc menu.roles
    var hasMenuAccess = PermissionService.hasPermission(user.id, "menu.users") ||
                        PermissionService.hasPermission(user.id, "menu.roles");
    if (!hasMenuAccess) {
      throw new Error("403: Bạn không có quyền truy cập cấu hình phân quyền.");
    }

    var matrix = PermissionService.getRolePermissionsMatrix();
    return { success: true, data: matrix };
  } catch (e) {
    return { success: false, message: e.message || e.toString() };
  }
}

function apiSaveRolePermissions(roleId, permIds, token) {
  try {
    var actor = AuthService.validateToken(token);
    if (!actor) return { success: false, message: "Phiên làm việc hết hạn." };
    PermissionService.checkPermission(actor.id, "roles.save_permissions");

    var res = PermissionService.saveRolePermissions(roleId, permIds, actor.id);

    AuditService.log({
      actor: actor,
      action: "SAVE_ROLE_PERMISSIONS",
      entity_type: "ROLE",
      entity_id: roleId,
      message_snapshot: "Cập nhật ma trận phân quyền cho vai trò: " + roleId
    });

    return res;
  } catch (e) {
    return { success: false, message: e.message || e.toString() };
  }
}

function apiGetAuditLogs(params, token) {
  try {
    var user = AuthService.validateToken(token);
    if (!user) return { success: false, message: "Phiên làm việc hết hạn." };
    PermissionService.checkPermission(user.id, "menu.audit");

    var logs = AuditService.getLogs(params);
    return { success: true, data: logs };
  } catch (e) {
    return { success: false, message: e.message || e.toString() };
  }
}

function apiGetSettings(token) {
  try {
    var user = AuthService.validateToken(token);
    if (!user) return { success: false, message: "Phiên làm việc hết hạn." };
    PermissionService.checkPermission(user.id, "menu.settings");
    var settings = ConfigRepository.getAllSettings();
    var docTypes = ConfigRepository.getAllDocumentTypes();
    var numbering = NumberingService.getNumberingList();
    return { success: true, data: { settings: settings, docTypes: docTypes, numbering: numbering } };
  } catch (e) {
    return { success: false, message: e.message || e.toString() };
  }
}

function apiSaveSettings(settingsMap, token) {
  try {
    var actor = AuthService.validateToken(token);
    if (!actor) return { success: false, message: "Phiên làm việc hết hạn." };
    PermissionService.checkPermission(actor.id, "settings.update");

    for (var k in settingsMap) {
      ConfigRepository.setSetting(k, settingsMap[k], actor.id);
    }

    AuditService.log({
      actor: actor,
      action: "UPDATE_SETTINGS",
      entity_type: "CONFIG",
      message_snapshot: "Cập nhật các tham số cấu hình chung của hệ thống."
    });

    return { success: true, message: "Cập nhật cấu hình thành công." };
  } catch (e) {
    return { success: false, message: e.message || e.toString() };
  }
}

/**
 * Lấy danh mục Loại văn bản / Loại sổ kèm thống kê
 */
function apiGetDocumentTypesList(token) {
  try {
    var user = AuthService.validateToken(token);
    if (!user) return { success: false, message: "Phiên làm việc hết hạn." };
    var list = ConfigRepository.getDocumentTypesWithStats();
    return { success: true, data: list };
  } catch (e) {
    return { success: false, message: e.message || e.toString() };
  }
}

/**
 * Thêm mới hoặc cập nhật Loại văn bản / Loại sổ
 */
function apiSaveDocumentType(typeData, token) {
  try {
    var actor = AuthService.validateToken(token);
    if (!actor) return { success: false, message: "Phiên làm việc hết hạn." };

    try {
      PermissionService.checkPermission(actor.id, "doctypes.manage");
    } catch (permErr) {
      PermissionService.checkPermission(actor.id, "settings.update");
    }

    if (!typeData || !typeData.name || !typeData.name.trim()) {
      return { success: false, message: "Vui lòng nhập tên loại sổ." };
    }

    var result = ConfigRepository.saveDocumentType(typeData, actor.id);

    AuditService.log({
      actor: actor,
      action: typeData.id ? "UPDATE_DOCTYPE" : "CREATE_DOCTYPE",
      entity_type: "DOCUMENT_TYPE",
      entity_id: result.id,
      message_snapshot: (typeData.id ? "Cập nhật loại sổ: " : "Thêm mới loại sổ: ") + result.name + " (" + result.prefix + ")"
    });

    return {
      success: true,
      data: result,
      message: typeData.id ? "Cập nhật loại sổ thành công!" : "Thêm mới loại sổ thành công!"
    };
  } catch (e) {
    return { success: false, message: e.message || e.toString() };
  }
}

/**
 * Xóa an toàn Loại văn bản / Loại sổ
 */
function apiDeleteDocumentType(typeId, token) {
  try {
    var actor = AuthService.validateToken(token);
    if (!actor) return { success: false, message: "Phiên làm việc hết hạn." };

    try {
      PermissionService.checkPermission(actor.id, "doctypes.manage");
    } catch (permErr) {
      PermissionService.checkPermission(actor.id, "settings.update");
    }

    ConfigRepository.deleteDocumentType(typeId, actor.id);

    AuditService.log({
      actor: actor,
      action: "DELETE_DOCTYPE",
      entity_type: "DOCUMENT_TYPE",
      entity_id: typeId,
      message_snapshot: "Xóa loại sổ: " + typeId
    });

    return { success: true, message: "Đã xóa loại sổ thành công!" };
  } catch (e) {
    return { success: false, message: e.message || e.toString() };
  }
}

/**
 * Bật / Tắt trạng thái hoạt động của loại sổ
 */
function apiToggleDocumentTypeStatus(typeId, status, token) {
  try {
    var actor = AuthService.validateToken(token);
    if (!actor) return { success: false, message: "Phiên làm việc hết hạn." };

    try {
      PermissionService.checkPermission(actor.id, "doctypes.manage");
    } catch (permErr) {
      PermissionService.checkPermission(actor.id, "settings.update");
    }

    ConfigRepository.toggleDocumentTypeStatus(typeId, status, actor.id);

    AuditService.log({
      actor: actor,
      action: "TOGGLE_DOCTYPE_STATUS",
      entity_type: "DOCUMENT_TYPE",
      entity_id: typeId,
      message_snapshot: "Đổi trạng thái loại sổ " + typeId + " sang: " + status
    });

    return { success: true, message: "Đã cập nhật trạng thái loại sổ thành công!" };
  } catch (e) {
    return { success: false, message: e.message || e.toString() };
  }
}
