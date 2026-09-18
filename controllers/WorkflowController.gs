/**
 * WorkflowController.gs
 * Điều phối các API chuyển trạng thái quy trình phê duyệt và cấp số
 */

function apiExecuteWorkflowTransition(docId, actionName, comment, payload, token) {
  try {
    var user = AuthService.validateToken(token);
    if (!user) return { success: false, message: "Phiên làm việc hết hạn hoặc không hợp lệ." };

    var result = WorkflowService.executeTransition(docId, actionName, user, comment, payload);
    return result;
  } catch (e) {
    return { success: false, message: e.message || e.toString() };
  }
}

function apiIssueDocumentNumber(docType, year, token) {
  try {
    var user = AuthService.validateToken(token);
    if (!user) return { success: false, message: "Phiên làm việc hết hạn hoặc không hợp lệ." };
    PermissionService.checkPermission(user.id, "docs.outgoing.issue_number");

    var result = NumberingService.issueNextNumber(docType, year, user);
    return result;
  } catch (e) {
    return { success: false, message: e.message || e.toString() };
  }
}

function apiUpdateNumberingConfig(year, docType, prefix, currentNumber, token) {
  try {
    var user = AuthService.validateToken(token);
    if (!user) return { success: false, message: "Phiên làm việc hết hạn hoặc không hợp lệ." };
    PermissionService.checkPermission(user.id, "numbering.manage");

    var result = NumberingService.updateNumbering(year, docType, prefix, currentNumber, user);
    return result;
  } catch (e) {
    return { success: false, message: e.message || e.toString() };
  }
}
