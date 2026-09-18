/**
 * AuditService.gs
 * Ghi vết nhật ký kiểm toán (Audit Logging) và giám sát an toàn hệ thống
 */

var AuditService = {
  /**
   * Ghi nhận một sự kiện kiểm toán
   */
  log: function(params) {
    try {
      var seq = DB.getAllRows(CONFIG.SHEETS.AUDIT_LOG.NAME).length + 1;
      var actor = params.actor || null;
      var actorId = params.actor_id || (actor ? actor.id : "SYSTEM");

      var username = actor ? actor.username : (params.actor_username || "system");
      var fullName = actor ? actor.full_name : (params.actor_name || "Hệ thống");
      var roleName = actor && actor.primary_role_name ? actor.primary_role_name : (params.actor_role || "System");

      var row = {
        id: IdUtils.generateAuditId(seq),
        event_at: DateUtils.formatDateTime(new Date()),
        actor_id: actorId,
        action: params.action || "UNKNOWN",
        entity_type: params.entity_type || "SYSTEM",
        entity_id: params.entity_id || "",
        before_json: params.before ? JSON.stringify(params.before) : "",
        after_json: params.after ? JSON.stringify(params.after) : "",
        actor_username_snapshot: username,
        actor_name_snapshot: fullName,
        actor_role_snapshot: roleName,
        entity_number_snapshot: params.entity_number || "",
        message_snapshot: params.message_snapshot || ""
      };

      DB.appendRowsBatch(CONFIG.SHEETS.AUDIT_LOG.NAME, [row]);
    } catch (e) {
      Logger.log("Lỗi khi ghi Audit Log: " + e.toString());
    }
  },

  /**
   * Lấy danh sách nhật ký kiểm toán có phân trang
   */
  getLogs: function(params) {
    var p = params || {};
    var all = DB.getAllRows(CONFIG.SHEETS.AUDIT_LOG.NAME);

    // Lọc theo entity_type hoặc action hoặc keyword
    var filtered = all.filter(function(r) {
      if (p.entity_type && p.entity_type !== "ALL" && r.entity_type !== p.entity_type) return false;
      if (p.action && p.action !== "ALL" && r.action !== p.action) return false;
      if (p.search) {
        var s = p.search.toLowerCase();
        var matchMsg = (r.message_snapshot || "").toLowerCase().indexOf(s) !== -1;
        var matchActor = (r.actor_name_snapshot || "").toLowerCase().indexOf(s) !== -1;
        var matchDoc = (r.entity_number_snapshot || "").toLowerCase().indexOf(s) !== -1;
        if (!matchMsg && !matchActor && !matchDoc) return false;
      }
      return true;
    });

    // Sắp xếp mới nhất lên đầu
    filtered.reverse();

    return SheetUtils.paginate(filtered, p.page, p.pageSize || 20);
  }
};
