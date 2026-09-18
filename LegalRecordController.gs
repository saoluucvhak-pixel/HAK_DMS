/**
 * LegalRecordController.gs
 * Tiếp nhận request từ Web App cho Hồ sơ Pháp lý Doanh nghiệp
 * (Giấy phép ĐKKD, Điều lệ, Biên bản họp HĐTV, Quyết định, Giấy phép môi trường...)
 */

function apiGetLegalRecordsList(params, token) {
  try {
    var user = AuthService.validateToken(token);
    if (!user) return { success: false, message: "Phiên làm việc hết hạn hoặc không hợp lệ." };
    PermissionService.checkPermission(user.id, "menu.legal_records");

    var result = LegalRecordRepository.getListWithFilters(params);
    return { success: true, data: result };
  } catch (e) {
    return { success: false, message: e.message || e.toString() };
  }
}

function apiGetLegalRecordDetail(recordId, token) {
  try {
    var user = AuthService.validateToken(token);
    if (!user) return { success: false, message: "Phiên làm việc hết hạn hoặc không hợp lệ." };
    PermissionService.checkPermission(user.id, "menu.legal_records");

    var record = LegalRecordRepository.findById(recordId);
    if (!record) return { success: false, message: "Không tìm thấy hồ sơ pháp lý." };
    return { success: true, data: record };
  } catch (e) {
    return { success: false, message: e.message || e.toString() };
  }
}

function apiSaveLegalRecord(data, token) {
  try {
    var actor = AuthService.validateToken(token);
    if (!actor) return { success: false, message: "Phiên làm việc hết hạn hoặc không hợp lệ." };
    PermissionService.checkPermission(actor.id, "legal_records.manage");

    var saved = LegalRecordRepository.save(data, actor.id);

    AuditService.log({
      actor: actor,
      action: data.id ? "UPDATE_LEGAL_RECORD" : "CREATE_LEGAL_RECORD",
      entity_type: "LEGAL_RECORD",
      entity_id: saved.id,
      message_snapshot: (data.id ? "Cập nhật" : "Tạo mới") + " hồ sơ pháp lý: " + saved.title
    });

    return { success: true, data: saved };
  } catch (e) {
    return { success: false, message: e.message || e.toString() };
  }
}

function apiDeleteLegalRecord(recordId, token) {
  try {
    var actor = AuthService.validateToken(token);
    if (!actor) return { success: false, message: "Phiên làm việc hết hạn hoặc không hợp lệ." };
    PermissionService.checkPermission(actor.id, "legal_records.manage");

    var existing = LegalRecordRepository.findById(recordId);
    LegalRecordRepository.deleteRecord(recordId);

    AuditService.log({
      actor: actor,
      action: "DELETE_LEGAL_RECORD",
      entity_type: "LEGAL_RECORD",
      entity_id: recordId,
      message_snapshot: "Xóa hồ sơ pháp lý: " + (existing ? existing.title : recordId)
    });

    return { success: true };
  } catch (e) {
    return { success: false, message: e.message || e.toString() };
  }
}
