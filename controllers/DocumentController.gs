/**
 * DocumentController.gs
 * Tiếp nhận request từ Web App và điều phối xử lý văn bản
 */

function apiGetIncomingDocuments(params, token) {
  try {
    var user = AuthService.validateToken(token);
    if (!user) return { success: false, message: "Phiên làm việc hết hạn hoặc không hợp lệ." };
    PermissionService.checkPermission(user.id, "menu.incoming_docs");
    var result = DocumentService.getIncomingDocuments(params);
    return { success: true, data: result };
  } catch (e) {
    return { success: false, message: e.message || e.toString() };
  }
}

function apiGetOutgoingDocuments(params, token) {
  try {
    var user = AuthService.validateToken(token);
    if (!user) return { success: false, message: "Phiên làm việc hết hạn hoặc không hợp lệ." };
    PermissionService.checkPermission(user.id, "menu.outgoing_docs");
    var result = DocumentService.getOutgoingDocuments(params);
    return { success: true, data: result };
  } catch (e) {
    return { success: false, message: e.message || e.toString() };
  }
}

function apiGetDocumentDetail(docId, token) {
  try {
    var user = AuthService.validateToken(token);
    if (!user) return { success: false, message: "Phiên làm việc hết hạn hoặc không hợp lệ." };

    var doc = DocumentRepository.findById(docId);
    if (!doc) return { success: false, message: "Không tìm thấy văn bản." };

    var requiredPerm = (doc.document_type === "OUTGOING") ? "menu.outgoing_docs" : "menu.incoming_docs";
    PermissionService.checkPermission(user.id, requiredPerm);

    var detail = DocumentService.getDocumentDetail(docId, user);
    return { success: true, data: detail };
  } catch (e) {
    return { success: false, message: e.message || e.toString() };
  }
}

function apiReceiveIncomingDocument(data, token) {
  try {
    var user = AuthService.validateToken(token);
    if (!user) return { success: false, message: "Phiên làm việc hết hạn hoặc không hợp lệ." };
    var result = DocumentService.receiveIncoming(data, user);
    return result;
  } catch (e) {
    return { success: false, message: e.message || e.toString() };
  }
}

function apiCreateOutgoingDraft(data, token) {
  try {
    var user = AuthService.validateToken(token);
    if (!user) return { success: false, message: "Phiên làm việc hết hạn hoặc không hợp lệ." };
    var result = DocumentService.createOutgoingDraft(data, user);
    return result;
  } catch (e) {
    return { success: false, message: e.message || e.toString() };
  }
}

function apiUploadDocumentFile(payload, token) {
  try {
    var user = AuthService.validateToken(token);
    if (!user) return { success: false, message: "Phiên làm việc hết hạn hoặc không hợp lệ." };
    var result = DriveService.uploadBase64File(payload);
    return result;
  } catch (e) {
    return { success: false, message: e.message || e.toString() };
  }
}

function apiGetDashboardWorkQueue(token, options) {
  try {
    var user = AuthService.validateToken(token);
    if (!user) return { success: false, message: "Phiên làm việc hết hạn hoặc không hợp lệ." };
    var result = DocumentService.getDashboardWorkQueue(user, options);
    return { success: true, data: result };
  } catch (e) {
    return { success: false, message: e.message || e.toString() };
  }
}

function apiAddDocumentComment(docId, content, attachmentFileId, token) {
  try {
    var user = AuthService.validateToken(token);
    if (!user) return { success: false, message: "Phiên làm việc hết hạn hoặc không hợp lệ." };
    if (!content) return { success: false, message: "Vui lòng nhập nội dung ý kiến." };

    var comment = DocumentRepository.addComment({
      document_id: docId,
      user_id: user.id,
      content: content,
      attachment_file_id: attachmentFileId || ""
    });

    AuditService.log({
      actor: user,
      action: "ADD_COMMENT",
      entity_type: "DOCUMENT",
      entity_id: docId,
      message_snapshot: "Thêm ý kiến vào văn bản: " + content.substring(0, 100)
    });

    return { success: true, comment: comment };
  } catch (e) {
    return { success: false, message: e.message || e.toString() };
  }
}
