/**
 * DocumentService.gs
 * Xử lý nghiệp vụ chính của văn bản: tra cứu, lọc, tiếp nhận, soạn thảo và thống kê hàng đợi
 */

var DocumentService = {
  CACHE_PREFIX: "DMS_DASH_WORKQUEUE_",
  CACHE_TTL_SECONDS: 60,

  /**
   * Xóa cache bảng điều khiển của người dùng khi có thay đổi dữ liệu
   */
  invalidateDashboardCache: function(userId) {
    try {
      var cache = CacheService.getScriptCache();
      if (userId) {
        cache.remove(this.CACHE_PREFIX + userId);
      }
    } catch (e) {}
  },

  /**
   * Lấy danh sách văn bản đến có phân trang và bộ lọc
   */
  getIncomingDocuments: function(params) {
    var p = params || {};
    var docs = DocumentRepository.findAll(function(r) {
      if (r.document_type !== "INCOMING") return false;
      if (p.status && p.status !== "ALL" && r.status !== p.status) return false;
      if (p.priority && p.priority !== "ALL" && r.priority !== p.priority) return false;
      if (p.category_id && p.category_id !== "ALL" && r.category_id !== p.category_id) return false;
      if (p.department_id && p.department_id !== "ALL" && r.department_id !== p.department_id) return false;
      if (p.search) {
        var s = p.search.toLowerCase();
        var matchTitle = (r.title || "").toLowerCase().indexOf(s) !== -1;
        var matchNo = (r.document_no || "").toLowerCase().indexOf(s) !== -1;
        var matchIssuer = (r.issuer || "").toLowerCase().indexOf(s) !== -1;
        var matchId = (r.id || "").toLowerCase().indexOf(s) !== -1;
        if (!matchTitle && !matchNo && !matchIssuer && !matchId) return false;
      }
      return true;
    });

    docs.reverse(); // Mới nhất lên đầu
    var deptsMap = UserRepository.getDepartmentsMap();
    docs.forEach(function(r) {
      r.department_name = deptsMap[r.department_id] ? deptsMap[r.department_id].name : "Chưa phân bổ";
    });
    return SheetUtils.paginate(docs, p.page, p.pageSize || 10);
  },

  /**
   * Lấy danh sách văn bản đi có phân trang và bộ lọc
   */
  getOutgoingDocuments: function(params) {
    var p = params || {};
    var docs = DocumentRepository.findAll(function(r) {
      if (r.document_type !== "OUTGOING") return false;
      if (p.status && p.status !== "ALL" && r.status !== p.status) return false;
      if (p.category_id && p.category_id !== "ALL" && r.category_id !== p.category_id) return false;
      if (p.department_id && p.department_id !== "ALL" && r.department_id !== p.department_id) return false;
      if (p.search) {
        var s = p.search.toLowerCase();
        var matchTitle = (r.title || "").toLowerCase().indexOf(s) !== -1;
        var matchNo = (r.document_no || "").toLowerCase().indexOf(s) !== -1;
        var matchSymbol = (r.symbol || "").toLowerCase().indexOf(s) !== -1;
        if (!matchTitle && !matchNo && !matchSymbol) return false;
      }
      return true;
    });

    docs.reverse();
    var deptsMap = UserRepository.getDepartmentsMap();
    docs.forEach(function(r) {
      r.department_name = deptsMap[r.department_id] ? deptsMap[r.department_id].name : "Chưa phân bổ";
    });
    return SheetUtils.paginate(docs, p.page, p.pageSize || 10);
  },

  /**
   * Văn thư tiếp nhận và vào sổ Văn bản Đến
   */
  receiveIncoming: function(data, actor) {
    PermissionService.checkPermission(actor.id, "docs.incoming.receive");

    var currentYear = DateUtils.getCurrentYear();
    var nextSeq = DocumentRepository.getNextSequence(currentYear);
    var docId = IdUtils.generateDocId(currentYear, nextSeq);
    var nowStr = DateUtils.formatDateTime(new Date());

    var newDoc = {
      id: docId,
      document_type: "INCOMING",
      document_no: data.document_no || "",
      symbol: data.symbol || "",
      title: data.title || "",
      category_id: data.category_id || "DT_CV",
      issue_date: data.issue_date || DateUtils.formatDate(new Date()),
      received_date: data.received_date || DateUtils.formatDate(new Date()),
      issuer: data.issuer || "",
      priority: data.priority || "NORMAL",
      confidentiality: data.confidentiality || "NORMAL",
      file_id: data.file_id || "",
      file_name: data.file_name || "",
      status: "RECEIVED",
      department_id: data.department_id || actor.department_id || "DEPT_VP",
      created_by_id: actor.id,
      created_at: nowStr,
      updated_at: nowStr
    };

    DocumentRepository.insert(newDoc);

    // Ghi nhận bước luân chuyển đầu tiên
    DocumentRepository.addHistory({
      document_id: docId,
      from_status: "START",
      to_status: "RECEIVED",
      actor_id: actor.id,
      action: "RECEIVE",
      comment: "Văn thư tiếp nhận vào sổ văn bản đến"
    });

    // Ghi Audit Log
    AuditService.log({
      actor: actor,
      action: "RECEIVE_INCOMING_DOC",
      entity_type: "DOCUMENT",
      entity_id: docId,
      entity_number: newDoc.document_no,
      after: newDoc,
      message_snapshot: "Tiếp nhận văn bản đến: [" + (newDoc.document_no || docId) + "] " + newDoc.title
    });

    this.invalidateDashboardCache(actor.id);

    return { success: true, document: newDoc };
  },

  /**
   * Soạn thảo dự thảo Văn bản Đi mới
   */
  createOutgoingDraft: function(data, actor) {
    PermissionService.checkPermission(actor.id, "docs.outgoing.create");

    var currentYear = DateUtils.getCurrentYear();
    var nextSeq = DocumentRepository.getNextSequence(currentYear);
    var docId = IdUtils.generateDocId(currentYear, nextSeq);
    var nowStr = DateUtils.formatDateTime(new Date());

    var newDraft = {
      id: docId,
      document_type: "OUTGOING",
      document_no: "", // Chưa có số phát hành chính thức
      symbol: data.symbol || "",
      title: data.title || "",
      category_id: data.category_id || "DT_CV",
      issue_date: "",
      received_date: "",
      issuer: ConfigRepository.getSetting("COMPANY_NAME", "Cơ quan"),
      priority: data.priority || "NORMAL",
      confidentiality: data.confidentiality || "NORMAL",
      file_id: data.file_id || "",
      file_name: data.file_name || "",
      status: "DRAFT",
      department_id: data.department_id || actor.department_id || "DEPT_VP",
      created_by_id: actor.id,
      created_at: nowStr,
      updated_at: nowStr
    };

    DocumentRepository.insert(newDraft);

    DocumentRepository.addHistory({
      document_id: docId,
      from_status: "START",
      to_status: "DRAFT",
      actor_id: actor.id,
      action: "CREATE_DRAFT",
      comment: "Tạo dự thảo văn bản đi"
    });

    AuditService.log({
      actor: actor,
      action: "CREATE_OUTGOING_DRAFT",
      entity_type: "DOCUMENT",
      entity_id: docId,
      after: newDraft,
      message_snapshot: "Tạo dự thảo văn bản đi: " + newDraft.title
    });

    this.invalidateDashboardCache(actor.id);

    return { success: true, document: newDraft };
  },

  /**
   * Lấy chi tiết văn bản đầy đủ kèm phân công, lịch sử luân chuyển và file đính kèm
   */
  getDocumentDetail: function(docId, user) {
    var doc = DocumentRepository.findById(docId);
    if (!doc) throw new Error("404: Không tìm thấy văn bản.");

    var assignments = AssignmentRepository.findByDocumentId(docId);
    var histories = DocumentRepository.getHistories(docId);
    var comments = DocumentRepository.getComments(docId);
    var deptsMap = UserRepository.getDepartmentsMap();
    var users = DB.getAllRows(CONFIG.SHEETS.USERS.NAME);
    var usersMap = {};
    for (var u = 0; u < users.length; u++) {
      var usr = users[u];
      usersMap[usr.id] = {
        id: usr.id,
        full_name: usr.full_name || usr.username,
        department_name: deptsMap[usr.department_id] ? deptsMap[usr.department_id].name : ""
      };
    }

    // Bổ sung thông tin người nhận phân công
    for (var a = 0; a < assignments.length; a++) {
      var asn = assignments[a];
      var assignee = usersMap[asn.assignee_id];
      asn.assignee_name = assignee ? assignee.full_name : asn.assignee_id;
      asn.assignee_dept = assignee ? assignee.department_name : "";
      asn.days_remaining = DateUtils.getDaysRemaining(asn.deadline);
      asn.is_overdue = DateUtils.isOverdue(asn.deadline) && asn.status !== "COMPLETED";
      asn.is_due_soon = DateUtils.isDueSoon(asn.deadline) && asn.status !== "COMPLETED";
    }

    // Bổ sung tên người thực hiện lịch sử
    for (var h = 0; h < histories.length; h++) {
      var his = histories[h];
      var actor = usersMap[his.actor_id];
      his.actor_name = actor ? actor.full_name : his.actor_id;
    }

    doc.department_name = deptsMap[doc.department_id] ? deptsMap[doc.department_id].name : "Chưa phân bổ";

    var availableActions = WorkflowService.getAvailableActions(doc, user);

    return {
      document: doc,
      assignments: assignments,
      histories: histories,
      comments: comments,
      availableActions: availableActions,
      preview_url: DriveService.getPreviewUrl(doc.file_id)
    };
  },

  /**
   * Thống kê Dashboard Work Queue dành cho người dùng hiện tại (Hỗ trợ CacheService 60s & forceRefresh)
   */
  getDashboardWorkQueue: function(user, options) {
    var opt = options || {};
    var cacheKey = this.CACHE_PREFIX + user.id;

    // 1. Kiểm tra CacheService nếu không bắt buộc làm mới (Tốc độ phản hồi tức thì ~100-150ms)
    if (!opt.forceRefresh) {
      try {
        var cache = CacheService.getScriptCache();
        var cachedData = cache.get(cacheKey);
        if (cachedData) {
          var parsed = JSON.parse(cachedData);
          parsed.fromCache = true;
          return parsed;
        }
      } catch (e) {}
    }

    var allDocs = DocumentRepository.findAll();
    var myAssignments = AssignmentRepository.findByAssigneeId(user.id);
    var usersMap = {};
    var allUsers = UserRepository.findAllWithDetails();
    for (var u = 0; u < allUsers.length; u++) {
      usersMap[allUsers[u].id] = allUsers[u];
    }

    var pendingCount = 0;
    var dueSoonCount = 0;
    var overdueCount = 0;
    var approvalCount = 0;

    var myTasks = [];

    // Duyệt qua nhiệm vụ cá nhân
    for (var a = 0; a < myAssignments.length; a++) {
      var item = myAssignments[a];
      if (item.status !== "COMPLETED") {
        pendingCount++;
        var rem = DateUtils.getDaysRemaining(item.deadline);
        if (rem !== null && rem < 0) {
          overdueCount++;
        } else if (rem !== null && rem <= 2) {
          dueSoonCount++;
        }

        var doc = DocumentRepository.findById(item.document_id);
        if (doc) {
          myTasks.push({
            assignment_id: item.id,
            document_id: doc.id,
            document_no: doc.document_no || doc.id,
            title: doc.title,
            role: item.role,
            deadline: item.deadline,
            days_remaining: rem,
            priority: doc.priority,
            status: item.status
          });
        }
      }
    }

    // Đếm văn bản chờ duyệt đối với Lãnh đạo hoặc Trưởng phòng
    var pendingApprovals = [];
    var canReview = PermissionService.hasPermission(user.id, "docs.outgoing.review");
    var canApprove = PermissionService.hasPermission(user.id, "docs.outgoing.approve");

    if (canReview || canApprove) {
      for (var d = 0; d < allDocs.length; d++) {
        var docItem = allDocs[d];
        if (docItem.document_type === "OUTGOING") {
          if (canReview && docItem.status === "REVIEWING") {
            approvalCount++;
            pendingApprovals.push(docItem);
          } else if (canApprove && docItem.status === "WAITING_APPROVAL") {
            approvalCount++;
            pendingApprovals.push(docItem);
          }
        } else if (docItem.document_type === "INCOMING" && docItem.status === "SUBMITTED" && canApprove) {
          // Văn bản đến chờ lãnh đạo chỉ đạo
          approvalCount++;
          pendingApprovals.push(docItem);
        }
      }
    }

    var resultData = {
      kpi: {
        pendingCount: pendingCount,
        dueSoonCount: dueSoonCount,
        overdueCount: overdueCount,
        approvalCount: approvalCount
      },
      myTasks: myTasks.slice(0, 10),
      pendingApprovals: pendingApprovals.slice(0, 10),
      fromCache: false
    };

    // Lưu vào CacheService với TTL 60 giây
    try {
      var cachePut = CacheService.getScriptCache();
      cachePut.put(cacheKey, JSON.stringify(resultData), this.CACHE_TTL_SECONDS);
    } catch (e) {}

    return resultData;
  }
};
