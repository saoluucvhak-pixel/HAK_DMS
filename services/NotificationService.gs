/**
 * NotificationService.gs
 * Tự động hóa quét thời hạn văn bản (Deadline Tracker) và gửi cảnh báo đa kênh
 */

var NotificationService = {
  /**
   * Quét toàn bộ văn bản và nhiệm vụ sắp đến hạn hoặc quá hạn
   * Được gọi bởi Time-driven Trigger lúc 08:00 hàng ngày
   */
  scanDeadlinesAndNotify: function() {
    var isEmailEnabled = ConfigRepository.getSetting("AUTO_SEND_EMAIL_REMINDER", "true") === "true";
    var chatWebhook = ConfigRepository.getSetting("CHAT_WEBHOOK_URL", "");
    var alertDays = parseInt(ConfigRepository.getSetting("DEADLINE_ALERT_DAYS", "2"), 10) || 2;

    var pendingAssignments = DB.findRows(CONFIG.SHEETS.ASSIGNMENTS.NAME, function(a) {
      return a.status !== "COMPLETED" && a.deadline;
    });

    var alertList = [];
    var usersMap = {};
    var allUsers = UserRepository.findAllWithDetails();
    for (var u = 0; u < allUsers.length; u++) {
      usersMap[allUsers[u].id] = allUsers[u];
    }

    for (var i = 0; i < pendingAssignments.length; i++) {
      var asn = pendingAssignments[i];
      var rem = DateUtils.getDaysRemaining(asn.deadline);
      if (rem !== null && rem <= alertDays) {
        var doc = DocumentRepository.findById(asn.document_id);
        var assignee = usersMap[asn.assignee_id];
        if (assignee && doc) {
          alertList.push({
            assignment: asn,
            document: doc,
            assignee: assignee,
            daysRemaining: rem
          });
        }
      }
    }

    var sentCount = 0;

    // Gửi email nhắc việc
    if (isEmailEnabled) {
      for (var j = 0; j < alertList.length; j++) {
        var item = alertList[j];
        if (item.assignee.email) {
          try {
            var subject = "[Nhắc việc Mini DMS] Nhiệm vụ sắp đến hạn: " + (item.document.document_no || item.document.id);
            var body = "Kính gửi " + item.assignee.full_name + ",\n\n" +
              "Hệ thống thông báo văn bản sau đang cần ông/bà xử lý:\n" +
              "- Mã văn bản: " + item.document.id + "\n" +
              "- Số hiệu: " + (item.document.document_no || "Chưa cấp số") + "\n" +
              "- Trích yếu: " + item.document.title + "\n" +
              "- Vai trò: " + (item.assignment.role === "PRIMARY" ? "Chủ trì" : "Phối hợp") + "\n" +
              "- Hạn xử lý: " + item.assignment.deadline + " (" + (item.daysRemaining < 0 ? "ĐÃ QUÁ HẠN " + Math.abs(item.daysRemaining) + " NGÀY" : "Còn " + item.daysRemaining + " ngày") + ")\n" +
              "- Mức độ: " + item.document.priority + "\n\n" +
              "Vui lòng truy cập hệ thống để kiểm tra và cập nhật kết quả xử lý.\n" +
              "Trân trọng!";

            MailApp.sendEmail(item.assignee.email, subject, body);
            sentCount++;
          } catch (e) {
            Logger.log("Lỗi gửi email cho " + item.assignee.email + ": " + e.toString());
          }
        }
      }
    }

    // Gửi Webhook nếu có cấu hình
    if (chatWebhook && alertList.length > 0) {
      try {
        var chatMsg = "🚨 *[MINI DMS - CẢNH BÁO TIẾN ĐỘ VĂN BẢN]*\n" +
          "Hôm nay có " + alertList.length + " nhiệm vụ sắp đến hạn hoặc đã quá hạn xử lý.\n" +
          "- Quá hạn: " + alertList.filter(function(x) { return x.daysRemaining < 0; }).length + " việc\n" +
          "- Sắp đến hạn: " + alertList.filter(function(x) { return x.daysRemaining >= 0; }).length + " việc.";

        UrlFetchApp.fetch(chatWebhook, {
          method: "post",
          contentType: "application/json",
          payload: JSON.stringify({ text: chatMsg }),
          muteHttpExceptions: true
        });
      } catch (e) {
        Logger.log("Lỗi gửi Webhook: " + e.toString());
      }
    }

    AuditService.log({
      action: "DEADLINE_SCAN_TRIGGER",
      entity_type: "SYSTEM",
      message_snapshot: "Quét deadline định kỳ: Phát hiện " + alertList.length + " công việc, đã gửi " + sentCount + " email thông báo."
    });

    return {
      totalAlerts: alertList.length,
      emailsSent: sentCount
    };
  }
};
