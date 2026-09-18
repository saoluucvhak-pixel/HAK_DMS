/**
 * AssignmentController.gs
 * Điều phối các API phân công nhiệm vụ và cập nhật tiến độ công việc
 */

function apiGetMyAssignments(params, token) {
  try {
    var user = AuthService.validateToken(token);
    if (!user) return { success: false, message: "Phiên làm việc hết hạn hoặc không hợp lệ." };

    var p = params || {};
    var statusParam = (p.status && p.status !== "ALL") ? p.status : null;
    var rawList = AssignmentRepository.findByAssigneeId(user.id, statusParam);
    var enrichedList = [];

    for (var i = 0; i < rawList.length; i++) {
      var item = rawList[i];
      var doc = DocumentRepository.findById(item.document_id);
      if (doc) {
        var daysRem = DateUtils.getDaysRemaining(item.deadline);
        var isOverdue = DateUtils.isOverdue(item.deadline) && item.status !== "COMPLETED";
        var isDueSoon = DateUtils.isDueSoon(item.deadline) && item.status !== "COMPLETED";

        // Lọc theo hạn chót (overdue / due_soon)
        if (p.filter === "overdue" && !isOverdue) continue;
        if (p.filter === "due_soon" && !isDueSoon) continue;

        // Lọc theo vai trò (PRIMARY / SUPPORT)
        if (p.role && p.role !== "ALL" && item.role !== p.role) continue;

        // Tìm kiếm theo số hiệu, trích yếu, ghi chú
        if (p.search) {
          var s = p.search.toLowerCase();
          var matchTitle = (doc.title || "").toLowerCase().indexOf(s) !== -1;
          var matchNo = (doc.document_no || "").toLowerCase().indexOf(s) !== -1;
          var matchNotes = (item.notes || "").toLowerCase().indexOf(s) !== -1;
          if (!matchTitle && !matchNo && !matchNotes) continue;
        }

        enrichedList.push({
          id: item.id,
          document_id: doc.id,
          document_no: doc.document_no || doc.id,
          title: doc.title,
          category_id: doc.category_id,
          role: item.role,
          deadline: item.deadline,
          deadline_display: DateUtils.formatDateDisplay(item.deadline),
          days_remaining: daysRem,
          is_overdue: isOverdue,
          is_due_soon: isDueSoon,
          status: item.status,
          priority: doc.priority,
          notes: item.notes || ""
        });
      }
    }

    enrichedList.reverse();
    var paged = SheetUtils.paginate(enrichedList, p.page, p.pageSize || 10);
    return { success: true, data: paged };
  } catch (e) {
    return { success: false, message: e.message || e.toString() };
  }
}

function apiAssignDocument(docId, assignments, comment, token) {
  try {
    var user = AuthService.validateToken(token);
    if (!user) return { success: false, message: "Phiên làm việc hết hạn hoặc không hợp lệ." };

    return WorkflowService.executeTransition(docId, "ASSIGN_TASKS", user, comment, {
      assignments: assignments
    });
  } catch (e) {
    return { success: false, message: e.message || e.toString() };
  }
}

function apiUpdateAssignmentProgress(assignmentId, newStatus, notes, token) {
  try {
    var user = AuthService.validateToken(token);
    if (!user) return { success: false, message: "Phiên làm việc hết hạn hoặc không hợp lệ." };

    var asn = AssignmentRepository.findById(assignmentId);
    if (!asn) return { success: false, message: "Không tìm thấy thông tin phân công." };

    // Kiểm tra quyền: chỉ người được giao hoặc quản lý mới được cập nhật
    if (asn.assignee_id !== user.id && !PermissionService.hasPermission(user.id, "assignments.update")) {
      return { success: false, message: "Bạn không có quyền cập nhật tiến độ cho phân công này." };
    }

    var nowStr = DateUtils.formatDateTime(new Date());
    var updateData = {
      status: newStatus,
      notes: notes || asn.notes || ""
    };

    if (newStatus === "COMPLETED") {
      updateData.completed_at = nowStr;
    }

    AssignmentRepository.update(assignmentId, updateData);

    AuditService.log({
      actor: user,
      action: "UPDATE_ASSIGNMENT_PROGRESS",
      entity_type: "ASSIGNMENT",
      entity_id: assignmentId,
      entity_number: asn.document_id,
      before: { status: asn.status },
      after: { status: newStatus },
      message_snapshot: "Cập nhật tiến độ nhiệm vụ sang: " + newStatus + (notes ? " (" + notes + ")" : "")
    });

    return { success: true, assignmentId: assignmentId, status: newStatus };
  } catch (e) {
    return { success: false, message: e.message || e.toString() };
  }
}
