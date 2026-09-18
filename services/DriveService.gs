/**
 * DriveService.gs
 * Tương tác lưu trữ tệp trên Google Drive và quản lý cây thư mục văn bản
 */

var DriveService = {
  /**
   * Lấy hoặc tạo thư mục gốc Mini DMS trên Drive
   */
  getRootFolder: function() {
    var rootFolderName = ConfigRepository.getSetting("DRIVE_ROOT_FOLDER_NAME", "MINI_DMS_STORAGE");
    var folders = DriveApp.getFoldersByName(rootFolderName);
    if (folders.hasNext()) {
      return folders.next();
    }
    return DriveApp.createFolder(rootFolderName);
  },

  /**
   * Lấy hoặc tạo thư mục lưu trữ theo cấu trúc: [ROOT] / [NĂM] / [LOẠI_VB] / [THÁNG]
   */
  getDestinationFolder: function(docType, year) {
    var root = this.getRootFolder();
    var y = year || DateUtils.getCurrentYear();
    var typeFolder = (docType || "INCOMING").toUpperCase();
    var monthStr = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "MM");

    // 1. Thư mục Năm
    var yearFolder = this._getOrCreateSubfolder(root, y + "");
    // 2. Thư mục Loại
    var typeSubFolder = this._getOrCreateSubfolder(yearFolder, typeFolder);
    // 3. Thư mục Tháng
    var monthSubFolder = this._getOrCreateSubfolder(typeSubFolder, "Thang_" + monthStr);

    return monthSubFolder;
  },

  _getOrCreateSubfolder: function(parentFolder, name) {
    var iter = parentFolder.getFoldersByName(name);
    if (iter.hasNext()) return iter.next();
    return parentFolder.createFolder(name);
  },

  /**
   * Upload tệp tin từ chuỗi Base64
   */
  uploadBase64File: function(payload) {
    if (!payload || !payload.base64Data || !payload.fileName) {
      throw new Error("Dữ liệu tệp không hợp lệ.");
    }

    var targetFolder = this.getDestinationFolder(payload.docType, payload.year);
    var cleanBase64 = payload.base64Data;
    if (cleanBase64.indexOf("base64,") !== -1) {
      cleanBase64 = cleanBase64.split("base64,")[1];
    }

    var decodedBytes = Utilities.base64Decode(cleanBase64);
    var mimeType = payload.mimeType || "application/pdf";
    var blob = Utilities.newBlob(decodedBytes, mimeType, payload.fileName);

    var file = targetFolder.createFile(blob);
    // Thiết lập quyền xem cho bất kỳ ai có link (nếu cần preview trong Web App)
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (e) {}

    return {
      success: true,
      file_id: file.getId(),
      file_name: file.getName(),
      file_size: file.getSize(),
      mime_type: file.getMimeType(),
      view_url: "https://drive.google.com/file/d/" + file.getId() + "/preview",
      download_url: file.getDownloadUrl()
    };
  },

  /**
   * Lấy URL xem trước của file Drive
   */
  getPreviewUrl: function(fileId) {
    if (!fileId) return "";
    return "https://drive.google.com/file/d/" + fileId + "/preview";
  }
};
