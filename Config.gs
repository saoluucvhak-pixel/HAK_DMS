/**
 * Config.gs
 * Cấu hình Hệ thống, Bảng dữ liệu Sheet & Phân quyền 2 Tầng cho Mini DMS
 * Dự án: Mini DMS (Document Management System) - BaseAppScript Framework
 */

var CONFIG = {
  APP_NAME: "Mini DMS - Quản Lý Văn Bản Nội Bộ",
  APP_VERSION: "1.0.0",
  TIMEZONE: "Asia/Ho_Chi_Minh",

  // Tài khoản Quản trị viên tối cao khởi tạo (Super Admin)
  INITIAL_ADMIN: {
    id: "USR001",
    username: "admin",
    password_plain: "admin123",
    password_hash: "240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9",
    full_name: "Quản trị viên Hệ thống",
    phone: "0900000000",
    email: "admin@system.local",
    department_id: "DEPT_BGD",
    status: "ACTIVE"
  },

  // Danh mục 14 Bảng dữ liệu Sheet chuẩn hóa
  SHEETS: {
    DOCUMENTS: {
      NAME: "DOCUMENTS",
      HEADERS: [
        "id", "document_type", "document_no", "symbol", "title", "category_id",
        "issue_date", "received_date", "issuer", "priority", "confidentiality",
        "file_id", "file_name", "status", "department_id", "created_by_id",
        "created_at", "updated_at"
      ]
    },
    ASSIGNMENTS: {
      NAME: "ASSIGNMENTS",
      HEADERS: [
        "id", "document_id", "assignee_id", "role", "deadline", "status",
        "assigned_by_id", "assigned_at", "completed_at", "notes"
      ]
    },
    WORKFLOW_HISTORY: {
      NAME: "WORKFLOW_HISTORY",
      HEADERS: [
        "id", "document_id", "from_status", "to_status", "actor_id", "action",
        "comment", "created_at"
      ]
    },
    DOCUMENT_TYPES: {
      NAME: "DOCUMENT_TYPES",
      HEADERS: ["id", "code", "name", "prefix", "description", "status", "created_at"]
    },
    DOCUMENT_NUMBERING: {
      NAME: "DOCUMENT_NUMBERING",
      HEADERS: ["year", "document_type", "prefix", "current_number", "updated_at"]
    },
    DEPARTMENTS: {
      NAME: "DEPARTMENTS",
      HEADERS: ["id", "code", "name", "manager_id", "email", "phone", "status", "created_at", "updated_at"]
    },
    COMMENTS: {
      NAME: "COMMENTS",
      HEADERS: ["id", "document_id", "user_id", "content", "attachment_file_id", "created_at"]
    },
    USERS: {
      NAME: "USERS",
      HEADERS: ["id", "username", "password_hash", "full_name", "phone", "email", "department_id", "status", "created_at", "updated_at", "created_by_id"]
    },
    ROLES: {
      NAME: "ROLES",
      HEADERS: ["id", "code", "name", "description", "created_at", "updated_at", "created_by_id"]
    },
    USER_ROLES: {
      NAME: "USER_ROLES",
      HEADERS: ["id", "user_id", "role_id", "assigned_at", "assigned_by_id"]
    },
    PERMISSIONS: {
      NAME: "PERMISSIONS",
      HEADERS: ["id", "code", "name", "module_group", "perm_type", "description", "created_at"]
    },
    ROLE_PERMISSIONS: {
      NAME: "ROLE_PERMISSIONS",
      HEADERS: ["id", "role_id", "permission_id", "assigned_at", "assigned_by_id"]
    },
    APP_SETTINGS: {
      NAME: "APP_SETTINGS",
      HEADERS: ["key", "value", "description", "updated_at", "updated_by_id"]
    },
    AUDIT_LOG: {
      NAME: "AUDIT_LOG",
      HEADERS: ["id", "event_at", "actor_id", "action", "entity_type", "entity_id", "before_json", "after_json", "actor_username_snapshot", "actor_name_snapshot", "actor_role_snapshot", "entity_number_snapshot", "message_snapshot"]
    },
    SESSIONS: {
      NAME: "SESSIONS",
      HEADERS: ["id", "user_id", "token_hash", "expires_at", "created_at", "ip_address", "user_agent", "is_revoked"]
    }
  },

  // 5 Vai trò cốt lõi trong hệ thống Mini DMS
  DEFAULT_ROLES: [
    {
      id: "ROLE_ADMIN",
      code: "Admin",
      name: "Quản trị viên toàn quyền",
      description: "Có toàn bộ quyền hạn quản trị hệ thống, danh mục, tài khoản và quy trình."
    },
    {
      id: "ROLE_DIRECTOR",
      code: "Director",
      name: "Ban Giám đốc (Lãnh đạo)",
      description: "Chỉ đạo văn bản đến, phân công phòng ban, ký duyệt văn bản đi toàn cơ quan."
    },
    {
      id: "ROLE_DEPT_HEAD",
      code: "DepartmentHead",
      name: "Trưởng phòng / Quản lý đơn vị",
      description: "Thẩm tra dự thảo của phòng, giao việc chuyên viên, theo dõi tiến độ cấp dưới."
    },
    {
      id: "ROLE_CLERK",
      code: "Clerk",
      name: "Văn thư cơ quan",
      description: "Tiếp nhận vào sổ văn bản đến, cấp số văn bản đi tự động, phát hành và lưu trữ."
    },
    {
      id: "ROLE_STAFF",
      code: "Staff",
      name: "Chuyên viên / Nhân viên",
      description: "Soạn thảo dự thảo văn bản đi, xử lý nhiệm vụ được phân công trong văn bản đến."
    }
  ],

  // Phòng ban mặc định khởi tạo
  DEFAULT_DEPARTMENTS: [
    { id: "DEPT_BGD", code: "BGD", name: "Ban Giám Đốc", manager_id: "USR001", email: "bgd@system.local", phone: "0900000001", status: "ACTIVE" },
    { id: "DEPT_VP", code: "VP", name: "Văn Phòng / Văn Thư", manager_id: "", email: "vanphong@system.local", phone: "0900000002", status: "ACTIVE" },
    { id: "DEPT_CNTT", code: "CNTT", name: "Phòng Công Nghệ Thông Tin", manager_id: "", email: "cntt@system.local", phone: "0900000003", status: "ACTIVE" },
    { id: "DEPT_KHTC", code: "KHTC", name: "Phòng Kế Hoạch - Tài Chính", manager_id: "", email: "khtc@system.local", phone: "0900000004", status: "ACTIVE" }
  ],

  // Loại văn bản mặc định khởi tạo
  DEFAULT_DOCUMENT_TYPES: [
    { id: "DT_CV", code: "CONG_VAN", name: "Công văn", prefix: "CV", description: "Công văn hành chính trao đổi", status: "ACTIVE" },
    { id: "DT_QD", code: "QUYET_DINH", name: "Quyết định", prefix: "QD", description: "Quyết định ban hành nội bộ", status: "ACTIVE" },
    { id: "DT_TT", code: "TO_TRINH", name: "Tờ trình", prefix: "TT", description: "Tờ trình phê duyệt chủ trương", status: "ACTIVE" },
    { id: "DT_TB", code: "THONG_BAO", name: "Thông báo", prefix: "TB", description: "Thông báo kết luận, chỉ đạo", status: "ACTIVE" },
    { id: "DT_KH", code: "KE_HOACH", name: "Kế hoạch", prefix: "KH", description: "Kế hoạch công tác định kỳ", status: "ACTIVE" },
    { id: "DT_BC", code: "BAO_CAO", name: "Báo cáo", prefix: "BC", description: "Báo cáo sơ kết, định kỳ", status: "ACTIVE" }
  ],

  // TẦNG 1: QUYỀN MENU HIỂN THỊ (menu.xxx)
  DEFAULT_MENU_PERMISSIONS: [
    { code: "menu.dashboard", name: "Bảng điều khiển & Hàng đợi", module_group: "Bảng điều khiển", description: "Hiển thị màn hình Work Queue & Thống kê" },
    { code: "menu.my_tasks", name: "Việc của tôi", module_group: "Hồ sơ công việc", description: "Hiển thị các văn bản được giao chủ trì / phối hợp" },
    { code: "menu.incoming_docs", name: "Văn bản Đến", module_group: "Quản lý văn bản", description: "Hiển thị danh sách và quy trình Văn bản đến" },
    { code: "menu.outgoing_docs", name: "Văn bản Đi", module_group: "Quản lý văn bản", description: "Hiển thị danh sách và quy trình Văn bản đi" },
    { code: "menu.departments", name: "Quản lý Phòng ban", module_group: "Tổ chức cơ quan", description: "Hiển thị danh mục cơ cấu phòng ban" },
    { code: "menu.document_types", name: "Danh mục Loại văn bản", module_group: "Sổ văn bản", description: "Hiển thị danh mục loại văn bản & sổ theo dõi" },
    { code: "menu.users", name: "Quản lý Người dùng", module_group: "Quản trị hệ thống", description: "Hiển thị danh sách tài khoản & phân quyền" },
    { code: "menu.roles", name: "Vai trò & Phân quyền", module_group: "Quản trị hệ thống", description: "Hiển thị quản lý vai trò và ma trận quyền" },
    { code: "menu.settings", name: "Cấu hình Hệ thống", module_group: "Quản trị hệ thống", description: "Cấu hình số nhảy, thông tin đơn vị, lưu trữ Drive" },
    { code: "menu.audit", name: "Nhật ký Kiểm toán", module_group: "Quản trị hệ thống", description: "Tra cứu lịch sử thao tác hệ thống" }
  ],

  // TẦNG 2: QUYỀN THAO TÁC CHỨC NĂNG (xxx.action)
  DEFAULT_ACTION_PERMISSIONS: [
    // Văn bản Đến
    { code: "docs.incoming.receive", name: "Tiếp nhận & Vào sổ VB đến", module_group: "Văn bản Đến", description: "Văn thư tiếp nhận file, quét scan và nhập trích yếu" },
    { code: "docs.incoming.submit", name: "Trình lãnh đạo chỉ đạo", module_group: "Văn bản Đến", description: "Chuyển văn bản đến lên Ban Giám đốc cho ý kiến" },
    { code: "docs.incoming.assign", name: "Phân công xử lý VB đến", module_group: "Văn bản Đến", description: "Lãnh đạo hoặc Trưởng phòng giao chuyên viên chủ trì/phối hợp" },
    { code: "docs.incoming.process", name: "Báo cáo tiến độ xử lý", module_group: "Văn bản Đến", description: "Chuyên viên cập nhật tiến độ, gửi tài liệu báo cáo" },
    { code: "docs.incoming.complete", name: "Hoàn tất xử lý VB đến", module_group: "Văn bản Đến", description: "Xác nhận văn bản đã được hoàn thành nhiệm vụ" },
    { code: "docs.incoming.archive", name: "Lưu trữ hồ sơ VB đến", module_group: "Văn bản Đến", description: "Đóng sổ văn bản và chuyển vào kho lưu trữ" },

    // Văn bản Đi
    { code: "docs.outgoing.create", name: "Soạn thảo dự thảo VB đi", module_group: "Văn bản Đi", description: "Nhân viên khởi tạo bản thảo văn bản đi" },
    { code: "docs.outgoing.submit", name: "Trình duyệt chuyên môn", module_group: "Văn bản Đi", description: "Trình dự thảo lên Trưởng phòng thẩm tra" },
    { code: "docs.outgoing.review", name: "Thẩm tra dự thảo", module_group: "Văn bản Đi", description: "Trưởng phòng duyệt chuyên môn trước khi trình Giám đốc" },
    { code: "docs.outgoing.request_revision", name: "Yêu cầu chỉnh sửa dự thảo", module_group: "Văn bản Đi", description: "Trả lại dự thảo kèm ý kiến yêu cầu chuyên viên sửa" },
    { code: "docs.outgoing.approve", name: "Phê duyệt ban hành (Ký duyệt)", module_group: "Văn bản Đi", description: "Lãnh đạo ký duyệt ban hành văn bản" },
    { code: "docs.outgoing.issue_number", name: "Cấp số phát hành tự động", module_group: "Văn bản Đi", description: "Văn thư lấy số nhảy chính thức từ sổ phát hành" },
    { code: "docs.outgoing.publish", name: "Phát hành & Phân phối", module_group: "Văn bản Đi", description: "Đóng dấu, phát hành văn bản tới các đơn vị" },

    // Quản lý phân công (Assignments)
    { code: "assignments.create", name: "Tạo phân công nhiệm vụ", module_group: "Phân công xử lý", description: "Giao chuyên viên chủ trì, phối hợp kèm hạn chót" },
    { code: "assignments.update", name: "Cập nhật tiến độ phân công", module_group: "Phân công xử lý", description: "Ghi nhận kết quả thực hiện nhiệm vụ" },

    // Quản lý cơ cấu & danh mục
    { code: "departments.manage", name: "Quản lý Phòng ban", module_group: "Cơ cấu cơ quan", description: "Thêm, sửa thông tin phòng ban" },
    { code: "doctypes.manage", name: "Quản lý Loại văn bản & Sổ", module_group: "Sổ văn bản", description: "Thêm, sửa loại văn bản và tiền tố số" },
    { code: "numbering.manage", name: "Cấu hình Số nhảy tự động", module_group: "Sổ văn bản", description: "Thiết lập lại số bắt đầu, cập nhật số hiện tại" },

    // Quản trị hệ thống Core
    { code: "users.create", name: "Tạo tài khoản người dùng", module_group: "Quản trị hệ thống", description: "Thêm mới tài khoản nhân viên" },
    { code: "users.update", name: "Sửa thông tin tài khoản", module_group: "Quản trị hệ thống", description: "Cập nhật họ tên, phòng ban, vai trò" },
    { code: "users.lock", name: "Khóa / Mở khóa tài khoản", module_group: "Quản trị hệ thống", description: "Đổi trạng thái ACTIVE / LOCKED" },
    { code: "users.reset_password", name: "Đặt lại mật khẩu", module_group: "Quản trị hệ thống", description: "Cấp lại mật khẩu mới cho nhân sự" },
    { code: "roles.create", name: "Tạo vai trò mới", module_group: "Quản trị hệ thống", description: "Tạo vai trò quyền hạn mới" },
    { code: "roles.update", name: "Sửa thông tin vai trò", module_group: "Quản trị hệ thống", description: "Cập nhật tên, mô tả vai trò" },
    { code: "roles.save_permissions", name: "Lưu ma trận phân quyền", module_group: "Quản trị hệ thống", description: "Gán quyền Menu và Action cho vai trò" },
    { code: "settings.update", name: "Lưu cấu hình hệ thống", module_group: "Quản trị hệ thống", description: "Cập nhật thiết lập chung và Drive lưu trữ" }
  ],

  // MA TRẬN GÁN QUYỀN MẶC ĐỊNH CHO 5 VAI TRÒ
  DEFAULT_ROLE_PERMISSIONS: {
    Admin: ["*"],
    Director: [
      "menu.dashboard", "menu.my_tasks", "menu.incoming_docs", "menu.outgoing_docs", "menu.departments", "menu.document_types", "menu.audit",
      "docs.incoming.assign", "docs.incoming.complete", "docs.incoming.archive",
      "docs.outgoing.approve", "docs.outgoing.request_revision",
      "assignments.create", "assignments.update"
    ],
    DepartmentHead: [
      "menu.dashboard", "menu.my_tasks", "menu.incoming_docs", "menu.outgoing_docs",
      "docs.incoming.assign", "docs.incoming.process", "docs.incoming.complete",
      "docs.outgoing.create", "docs.outgoing.submit", "docs.outgoing.review", "docs.outgoing.request_revision",
      "assignments.create", "assignments.update"
    ],
    Clerk: [
      "menu.dashboard", "menu.incoming_docs", "menu.outgoing_docs", "menu.document_types",
      "docs.incoming.receive", "docs.incoming.submit", "docs.incoming.archive",
      "docs.outgoing.issue_number", "docs.outgoing.publish",
      "doctypes.manage", "numbering.manage"
    ],
    Staff: [
      "menu.dashboard", "menu.my_tasks", "menu.incoming_docs", "menu.outgoing_docs",
      "docs.incoming.process",
      "docs.outgoing.create", "docs.outgoing.submit",
      "assignments.update"
    ]
  },

  // 12 Cấu hình Chung mặc định (APP_SETTINGS)
  DEFAULT_SETTINGS: [
    { key: "COMPANY_NAME", value: "Cơ Quan / Đơn Vị Quản Lý Văn Bản", description: "Tên cơ quan, doanh nghiệp chủ quản" },
    { key: "COMPANY_CODE", value: "DMS-ORG", description: "Mã định danh cơ quan phát hành" },
    { key: "COMPANY_ADDRESS", value: "TP. Hồ Chí Minh, Việt Nam", description: "Địa chỉ cơ quan" },
    { key: "COMPANY_EMAIL", value: "vanthu@system.local", description: "Hộp thư văn thư tiếp nhận" },
    { key: "COMPANY_PHONE", value: "028 1234 5678", description: "Số điện thoại văn phòng" },
    { key: "DRIVE_ROOT_FOLDER_NAME", value: "MINI_DMS_STORAGE", description: "Tên thư mục gốc lưu trữ tệp trên Google Drive" },
    { key: "DEADLINE_ALERT_DAYS", value: "2", description: "Số ngày trước hạn để hệ thống kích hoạt cảnh báo vàng" },
    { key: "AUTO_SEND_EMAIL_REMINDER", value: "true", description: "Tự động gửi email cảnh báo hạn xử lý lúc 08:00 sáng" },
    { key: "CHAT_WEBHOOK_URL", value: "", description: "Webhook Google Chat nhận thông báo văn bản khẩn" },
    { key: "DEFAULT_NUMBERING_PREFIX", value: "CV-DMS", description: "Ký hiệu tiền tố mặc định khi cấp số công văn" },
    { key: "TIMEZONE", value: "Asia/Ho_Chi_Minh", description: "Múi giờ hệ thống" },
    { key: "APP_VERSION", value: "1.0.0", description: "Phiên bản ứng dụng DMS" }
  ]
};
