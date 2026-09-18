/**
 * WorkflowService.gs
 * Bộ máy quản lý quy trình và máy trạng thái văn bản (FSM Workflow Engine)
 */

var WorkflowService = {
  // Bản đồ chuyển đổi trạng thái Văn bản Đến (Incoming State Transitions)
  INCOMING_TRANSITIONS: {
    "RECEIVED": {
      "REGISTER": { next: "REGISTERED", requiredPerm: "docs.incoming.receive", roleTitle: "Văn thư vào sổ" }
    },
    "REGISTERED": {
      "SUBMIT_LEADER": { next: "SUBMITTED", requiredPerm: "docs.incoming.submit", roleTitle: "Trình Lãnh đạo" },
      "ASSIGN_TASKS": { next: "PROCESSING", requiredPerm: "docs.incoming.assign", roleTitle: "Lãnh đạo giao việc" }
    },
    "SUBMITTED": {
      "ASSIGN_TASKS": { next: "PROCESSING", requiredPerm: "docs.incoming.assign", roleTitle: "Lãnh đạo giao việc" }
    },
    "PROCESSING": {
      "COMPLETE_ALL": { next: "COMPLETED", requiredPerm: "docs.incoming.complete", roleTitle: "Hoàn tất nhiệm vụ" },
      "ASSIGN_TASKS": { next: "PROCESSING", requiredPerm: "docs.incoming.assign", roleTitle: "Giao thêm cán bộ / Phân công tiếp" },
      "ASSIGN_MORE": { next: "PROCESSING", requiredPerm: "docs.incoming.assign", roleTitle: "Giao thêm cán bộ phối hợp" }
    },
    "COMPLETED": {
      "ARCHIVE": { next: "ARCHIVED", requiredPerm: "docs.incoming.archive", roleTitle: "Lưu trữ hồ sơ" }
    }
  },

  // Bản đồ chuyển đổi trạng thái Văn bản Đi (Outgoing State Transitions)
  OUTGOING_TRANSITIONS: {
    "DRAFT": {
      "SUBMIT_REVIEW": { next: "REVIEWING", requiredPerm: "docs.outgoing.submit", roleTitle: "Trình Trưởng phòng thẩm tra" }
    },
    "REVIEWING": {
      "APPROVE_REVIEW": { next: "WAITING_APPROVAL", requiredPerm: "docs.outgoing.review", roleTitle: "Trưởng phòng duyệt chuyên môn" },
      "REQUEST_REVISION": { next: "REVISION_REQUIRED", requiredPerm: "docs.outgoing.request_revision", roleTitle: "Yêu cầu sửa đổi dự thảo" }
    },
    "REVISION_REQUIRED": {
      "RE_SUBMIT": { next: "DRAFT", requiredPerm: "docs.outgoing.create", roleTitle: "Hoàn thiện lại bản thảo" }
    },
    "WAITING_APPROVAL": {
      "LEADER_APPROVE": { next: "APPROVED", requiredPerm: "docs.outgoing.approve", roleTitle: "Lãnh đạo ký duyệt ban hành" },
      "REQUEST_REVISION": { next: "REVISION_REQUIRED", requiredPerm: "docs.outgoing.request_revision", roleTitle: "Lãnh đạo yêu cầu chỉnh sửa" }
    },
    "APPROVED": {
      "ISSUE_NUMBER": { next: "NUMBERED", requiredPerm: "docs.outgoing.issue_number", roleTitle: "Văn thư cấp số phát hành" }
    },
    "NUMBERED": {
      "PUBLISH": { next: "ISSUED", requiredPerm: "docs.outgoing.publish", roleTitle: "Ban hành & Phân phối" }
    },
    "ISSUED": {
      "ARCHIVE": { next: "ARCHIVED", requiredPerm: "docs.incoming.archive", roleTitle: "Đóng sổ lưu trữ" }
    }
  },

  /**
   * Lấy các hành động khả dụng đối với văn bản tại trạng thái hiện tại của người dùng
   */
  getAvailableActions: function(doc, user) {
    if (!doc || !user) return [];
    var isIncoming = (doc.document_type === "INCOMING");
    var map = isIncoming ? this.INCOMING_TRANSITIONS : this.OUTGOING_TRANSITIONS;
    var stateTransitions = map[doc.status];
    if (!stateTransitions) return [];

    var actions = [];
    for (var act in stateTransitions) {
      var item = stateTransitions[act];
      if (PermissionService.hasPermission(user.id, item.requiredPerm)) {
        actions.push({
          action: act,
          title: item.roleTitle,
          nextStatus: item.next
        });
      }
    }
    return actions;
  },

  /**
   * Thực hiện chuyển trạng thái có kiểm tra logic và bảo mật
   */
  executeTransition: function(docId, actionName, user, comment, payload) {
    var self = this;
    return SheetUtils.withLock(function() {
      var doc = DocumentRepository.findById(docId);
      if (!doc) throw new Error("404: Không tìm thấy văn bản.");

      var isIncoming = (doc.document_type === "INCOMING");
      var transitionsMap = isIncoming ? self.INCOMING_TRANSITIONS : self.OUTGOING_TRANSITIONS;

      var currentStatusMoves = transitionsMap[doc.status];
      if (!currentStatusMoves || !currentStatusMoves[actionName]) {
        throw new Error("400: Hành động '" + actionName + "' không hợp lệ từ trạng thái hiện tại (" + doc.status + ").");
      }

      var transitionRule = currentStatusMoves[actionName];

      // Kiểm tra quyền RBAC của người dùng
      PermissionService.checkPermission(user.id, transitionRule.requiredPerm);

      var fromStatus = doc.status;
      var toStatus = transitionRule.next;
      var nowStr = DateUtils.formatDateTime(new Date());

      var updateFields = {
        status: toStatus,
        updated_at: nowStr
      };

      // Xử lý các logic đặc biệt theo Action
      if (actionName === "ISSUE_NUMBER" && !doc.document_no) {
        var numResult = NumberingService.issueNextNumber(doc.category_id, DateUtils.getCurrentYear(), user);
        updateFields.document_no = numResult.formatted_no;
      }

      if ((actionName === "ASSIGN_TASKS" || actionName === "ASSIGN_MORE") && payload && payload.assignments) {
        var assignList = payload.assignments.map(function(a) {
          return {
            document_id: doc.id,
            assignee_id: a.assignee_id,
            role: a.role || "PRIMARY",
            deadline: a.deadline || "",
            status: "PENDING",
            assigned_by_id: user.id,
            notes: comment || ""
          };
        });
        AssignmentRepository.insertBatch(assignList);
      }

      // Cập nhật văn bản
      DocumentRepository.update(doc.id, updateFields);

      // Ghi lịch sử luân chuyển
      DocumentRepository.addHistory({
        document_id: doc.id,
        from_status: fromStatus,
        to_status: toStatus,
        actor_id: user.id,
        action: actionName,
        comment: comment || transitionRule.roleTitle
      });

      // Ghi Audit Log
      AuditService.log({
        actor: user,
        action: "WORKFLOW_TRANSITION",
        entity_type: "DOCUMENT",
        entity_id: doc.id,
        entity_number: doc.document_no || doc.id,
        before: { status: fromStatus },
        after: { status: toStatus },
        message_snapshot: "Chuyển trạng thái văn bản từ [" + fromStatus + "] sang [" + toStatus + "] qua thao tác: " + transitionRule.roleTitle
      });

      DocumentService.invalidateDashboardCache(user.id);

      return {
        success: true,
        document_id: doc.id,
        from_status: fromStatus,
        to_status: toStatus,
        document_no: updateFields.document_no || doc.document_no
      };
    }, 10000);
  }
};
