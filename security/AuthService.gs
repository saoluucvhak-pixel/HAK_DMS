/**
 * AuthService.gs
 * Xác thực tài khoản, kiểm soát phiên làm việc và bảo mật truy cập
 */

var AuthService = {
  /**
   * Đăng nhập người dùng bằng Username & Mật khẩu
   */
  login: function(username, password, clientInfo) {
    if (!username || !password) {
      return { success: false, message: "Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu." };
    }

    var user = UserRepository.findByUsername(username);
    if (!user) {
      return { success: false, message: "Tài khoản hoặc mật khẩu không chính xác." };
    }

    if (user.status !== "ACTIVE") {
      return { success: false, message: "Tài khoản hiện đang bị khóa. Vui lòng liên hệ Quản trị viên." };
    }

    var passHash = SheetUtils.sha256(password);
    if (user.password_hash !== passHash) {
      return { success: false, message: "Tài khoản hoặc mật khẩu không chính xác." };
    }

    // Tạo phiên làm việc (Session)
    var session = this.createSession(user.id, clientInfo);

    // Lấy thông tin vai trò & quyền hạn
    var userRoles = UserRepository.getUserRolesMap()[user.id] || [];
    var permissions = PermissionService.getUserPermissions(user.id);

    // Ghi nhận Audit Log
    AuditService.log({
      actor_id: user.id,
      action: "LOGIN",
      entity_type: "AUTH",
      entity_id: user.id,
      message_snapshot: "Người dùng " + user.full_name + " (" + user.username + ") đăng nhập thành công."
    });

    delete user.password_hash;
    return {
      success: true,
      token: session.token,
      expires_at: session.expires_at,
      user: user,
      roles: userRoles,
      permissions: permissions
    };
  },

  /**
   * Tạo phiên làm việc mới cho người dùng
   */
  createSession: function(userId, clientInfo) {
    var rawToken = IdUtils.generateUUID() + "_" + Date.now();
    var tokenHash = SheetUtils.sha256(rawToken);
    var now = new Date();
    // Phiên làm việc có hạn 24 giờ
    var expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    var sessionRow = {
      id: IdUtils.generateUUID(),
      user_id: userId,
      token_hash: tokenHash,
      expires_at: DateUtils.formatDateTime(expiresAt),
      created_at: DateUtils.formatDateTime(now),
      ip_address: (clientInfo && clientInfo.ip) || "WEB_APP",
      user_agent: (clientInfo && clientInfo.userAgent) || "BROWSER",
      is_revoked: "FALSE"
    };

    DB.appendRowsBatch(CONFIG.SHEETS.SESSIONS.NAME, [sessionRow]);

    // Lưu cache phiên làm việc 6 giờ để tăng tốc độ phản hồi
    try {
      var cache = CacheService.getScriptCache();
      cache.put("SESSION_" + tokenHash, userId, 21600);
    } catch (e) {}

    return { token: rawToken, expires_at: sessionRow.expires_at };
  },

  /**
   * Xác thực token và lấy thông tin người dùng hiện tại
   */
  validateToken: function(rawToken) {
    if (!rawToken) return null;
    var tokenHash = SheetUtils.sha256(rawToken);

    // 1. Kiểm tra nhanh qua Cache
    try {
      var cachedUserId = CacheService.getScriptCache().get("SESSION_" + tokenHash);
      if (cachedUserId) {
        var cachedUser = UserRepository.findById(cachedUserId);
        if (cachedUser && cachedUser.status === "ACTIVE") {
          return cachedUser;
        }
      }
    } catch (e) {}

    // 2. Kiểm tra từ bảng SESSIONS
    var session = DB.findRow(CONFIG.SHEETS.SESSIONS.NAME, function(s) {
      return s.token_hash === tokenHash && s.is_revoked !== "TRUE";
    });

    if (!session) return null;

    var expiresTime = new Date(session.expires_at).getTime();
    if (isNaN(expiresTime) || expiresTime < Date.now()) {
      return null; // Đã hết hạn
    }

    var user = UserRepository.findById(session.user_id);
    if (!user || user.status !== "ACTIVE") return null;

    // Cập nhật lại Cache
    try {
      CacheService.getScriptCache().put("SESSION_" + tokenHash, user.id, 21600);
    } catch (e) {}

    return user;
  },

  /**
   * Đăng xuất và hủy bỏ phiên làm việc
   */
  logout: function(rawToken) {
    if (!rawToken) return { success: true };
    var tokenHash = SheetUtils.sha256(rawToken);

    try {
      CacheService.getScriptCache().remove("SESSION_" + tokenHash);
    } catch (e) {}

    var session = DB.findRow(CONFIG.SHEETS.SESSIONS.NAME, function(s) {
      return s.token_hash === tokenHash;
    });

    if (session) {
      DB.updateRowById(CONFIG.SHEETS.SESSIONS.NAME, session.id, { is_revoked: "TRUE" });
    }

    return { success: true };
  }
};
