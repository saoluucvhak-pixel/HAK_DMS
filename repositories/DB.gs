/**
 * DB.gs
 * Tầng giao tiếp dữ liệu Google Spreadsheet tối ưu hiệu năng (Batch Operations).
 * Thừa hưởng đầy đủ và nâng cao từ BaseAppScript Framework:
 * - Hỗ trợ cả Container-bound và Standalone Script (ScriptProperties / CONFIG / Auto-create).
 * - Cache RAM Spreadsheet và Sheets trong phiên thực thi để tránh gọi lặp lại.
 * - Thao tác đọc/ghi hàng loạt (Batch getValues / setValues).
 * - Tự động bảo toàn số 0 ở đầu (SĐT, MST, CCCD, Ký hiệu số).
 */

var DB = {
  _cachedSs: null,
  _cachedSheets: {},
  _cachedRows: {},

  /**
   * Xóa bộ nhớ đệm trong phiên thực thi
   */
  clearCache: function() {
    this._cachedSs = null;
    this._cachedSheets = {};
    this._cachedRows = {};
  },

  /**
   * Xóa bộ nhớ đệm dữ liệu của một hoặc tất cả Sheet
   */
  invalidateCache: function(sheetName) {
    if (this._cachedRows) {
      if (sheetName) {
        delete this._cachedRows[sheetName];
      } else {
        this._cachedRows = {};
      }
    }
  },

  /**
   * Lấy đối tượng Spreadsheet (hỗ trợ Container-bound và Standalone qua ScriptProperties)
   * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet}
   */
  getSpreadsheet: function() {
    if (this._cachedSs) return this._cachedSs;

    // 1. Kiểm tra container-bound spreadsheet
    try {
      var active = SpreadsheetApp.getActiveSpreadsheet();
      if (active) {
        this._cachedSs = active;
        return active;
      }
    } catch (e) {}

    // 2. Kiểm tra cấu hình trong CONFIG.SPREADSHEET_ID
    if (typeof CONFIG !== "undefined" && CONFIG.SPREADSHEET_ID && CONFIG.SPREADSHEET_ID.trim()) {
      try {
        var ssConfig = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID.trim());
        if (ssConfig) {
          this._cachedSs = ssConfig;
          return ssConfig;
        }
      } catch (e) {}
    }

    // 3. Kiểm tra ScriptProperties (cho kịch bản Standalone Script)
    try {
      var props = PropertiesService.getScriptProperties();
      var sheetId = props.getProperty("SPREADSHEET_ID");
      if (sheetId && sheetId.trim()) {
        var ssProp = SpreadsheetApp.openById(sheetId.trim());
        if (ssProp) {
          this._cachedSs = ssProp;
          return ssProp;
        }
      }
    } catch (e) {}

    try {
      var active2 = SpreadsheetApp.getActive();
      if (active2) {
        this._cachedSs = active2;
        return active2;
      }
    } catch (e) {}

    // 4. Nếu là Standalone Script và chưa có Sheet, tự động tạo mới vào Drive
    try {
      var appName = (typeof CONFIG !== "undefined" && CONFIG.APP_NAME) ? CONFIG.APP_NAME : "Mini DMS";
      var newSs = SpreadsheetApp.create(appName + " - Cơ sở dữ liệu");
      PropertiesService.getScriptProperties().setProperty("SPREADSHEET_ID", newSs.getId());
      this._cachedSs = newSs;
      return newSs;
    } catch (e) {
      throw new Error("Không thể kết nối hoặc tự động tạo Google Spreadsheet: " + e.message);
    }
  },

  /**
   * Lấy một Sheet theo tên với bộ nhớ đệm trong phiên thực thi
   * @param {string} sheetName 
   * @returns {GoogleAppsScript.Spreadsheet.Sheet}
   */
  getSheet: function(sheetName) {
    if (this._cachedSheets[sheetName]) {
      return this._cachedSheets[sheetName];
    }
    var ss = this.getSpreadsheet();
    if (!ss) return null;
    var sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      // Tự động tìm định nghĩa trong CONFIG.SHEETS và khởi tạo nếu thiếu
      if (typeof CONFIG !== "undefined" && CONFIG.SHEETS) {
        var sKeys = Object.keys(CONFIG.SHEETS);
        for (var i = 0; i < sKeys.length; i++) {
          var sDef = CONFIG.SHEETS[sKeys[i]];
          if (sDef && sDef.NAME === sheetName) {
            sheet = this.createSheetWithHeaders(sheetName, sDef.HEADERS);
            break;
          }
        }
      }
    }

    if (sheet) {
      this._cachedSheets[sheetName] = sheet;
    }
    return sheet;
  },

  /**
   * Tạo Sheet mới kèm dòng tiêu đề (Headers), format và freeze dòng 1
   * @param {string} sheetName 
   * @param {Array<string>} headers 
   * @returns {GoogleAppsScript.Spreadsheet.Sheet}
   */
  createSheetWithHeaders: function(sheetName, headers) {
    var ss = this.getSpreadsheet();
    if (!ss) throw new Error("Không thể kết nối với Google Spreadsheet.");

    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }

    if (sheet.getLastRow() === 0 && headers && headers.length > 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length)
        .setFontWeight("bold")
        .setBackground("#e0e7ff")
        .setFontColor("#1e1b4b");
      sheet.setFrozenRows(1);
    }
    return sheet;
  },

  /**
   * Định dạng giá trị an toàn trước khi ghi vào cell Google Sheets
   * Bảo toàn số 0 ở đầu (SĐT, Mã số thuế, Số hiệu văn bản)
   * @param {*} val 
   * @param {string} [headerKey] 
   * @returns {*}
   */
  formatValueForSheet: function(val, headerKey) {
    if (val === null || val === undefined) return "";
    if (typeof val === "boolean") return val;
    if (val instanceof Date) return DateUtils.formatDateTime(val);

    var strVal = String(val).trim();
    if (!strVal) return "";

    var lowerKey = String(headerKey || "").trim().toLowerCase();
    var isTextNumberField = lowerKey.indexOf("phone") !== -1 ||
                            lowerKey.indexOf("tax") !== -1 ||
                            lowerKey.indexOf("document_no") !== -1 ||
                            lowerKey.indexOf("symbol") !== -1 ||
                            lowerKey.indexOf("tel") !== -1;

    var startsWithZero = /^0[\d\-.]+$/.test(strVal);

    if (isTextNumberField || startsWithZero) {
      if (strVal.charAt(0) !== "'") {
        return "'" + strVal;
      }
    }
    return strVal;
  },

  /**
   * Đọc toàn bộ dữ liệu của Sheet và chuyển đổi thành mảng các Object (Batch Operation)
   * @param {string} sheetName 
   * @returns {Array<Object>}
   */
  getAllRows: function(sheetName) {
    if (this._cachedRows && this._cachedRows[sheetName]) {
      return this._cachedRows[sheetName];
    }

    var sheet = this.getSheet(sheetName);
    if (!sheet) return [];

    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    if (lastRow < 2 || lastCol < 1) {
      if (!this._cachedRows) this._cachedRows = {};
      this._cachedRows[sheetName] = [];
      return [];
    }

    var values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
    var headers = values[0];
    var results = [];

    for (var r = 1; r < values.length; r++) {
      var rowObj = { _rowIndex: r + 1 };
      var isEmptyRow = true;

      for (var c = 0; c < headers.length; c++) {
        var rawKey = headers[c];
        if (!rawKey) continue;
        var cleanKey = String(rawKey || "").trim().toLowerCase();
        var val = values[r][c];

        if (val instanceof Date) {
          val = DateUtils.formatDateTime(val);
        } else if (typeof val === "string") {
          if (val.charAt(0) === "'") {
            val = val.substring(1);
          }
        } else if (typeof val === "number" && !isNaN(val)) {
          var isPhoneOrTax = cleanKey.indexOf("phone") !== -1 || 
                             cleanKey.indexOf("tax") !== -1 || 
                             cleanKey.indexOf("tel") !== -1;
          if (isPhoneOrTax) {
            var numStr = String(val);
            if (numStr.length === 9 || numStr.length === 10) {
              val = "0" + numStr;
            } else {
              val = numStr;
            }
          }
        }

        rowObj[rawKey] = val;
        if (val !== "" && val !== null && val !== undefined) {
          isEmptyRow = false;
        }
      }

      if (!isEmptyRow) {
        results.push(rowObj);
      }
    }

    if (!this._cachedRows) this._cachedRows = {};
    this._cachedRows[sheetName] = results;
    return results;
  },

  /**
   * Tìm 1 bản ghi đầu tiên thỏa mãn điều kiện
   */
  findRow: function(sheetName, predicate) {
    var rows = this.getAllRows(sheetName);
    for (var i = 0; i < rows.length; i++) {
      if (predicate(rows[i])) return rows[i];
    }
    return null;
  },

  /**
   * Tìm tất cả các bản ghi thỏa mãn điều kiện
   */
  findRows: function(sheetName, predicate) {
    var rows = this.getAllRows(sheetName);
    if (!predicate) return rows;
    return rows.filter(predicate);
  },

  /**
   * Ghi nối hàng loạt (Batch append) vào Sheet
   * @param {string} sheetName 
   * @param {Array<Object>} rowsArray Danh sách object dữ liệu
   * @returns {boolean}
   */
  appendRowsBatch: function(sheetName, rowsArray) {
    if (!rowsArray || rowsArray.length === 0) return true;

    var sheet = this.getSheet(sheetName);
    if (!sheet) throw new Error("Sheet không tồn tại: " + sheetName);

    var lastCol = sheet.getLastColumn();
    if (lastCol < 1) throw new Error("Sheet chưa có Header: " + sheetName);

    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    var batchValues = [];

    for (var i = 0; i < rowsArray.length; i++) {
      var rowObj = rowsArray[i];
      var rowArr = [];
      for (var c = 0; c < headers.length; c++) {
        var h = headers[c];
        var val = (rowObj[h] !== undefined) ? rowObj[h] : "";
        rowArr.push(this.formatValueForSheet(val, h));
      }
      batchValues.push(rowArr);
    }

    var startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, batchValues.length, headers.length).setValues(batchValues);
    this.invalidateCache(sheetName);
    return true;
  },

  /**
   * Cập nhật 1 dòng theo ID
   */
  updateRowById: function(sheetName, id, updateObj) {
    var sheet = this.getSheet(sheetName);
    var rows = this.getAllRows(sheetName);
    var target = null;
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].id == id) {
        target = rows[i];
        break;
      }
    }
    if (!target) return false;

    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var targetRowIndex = target._rowIndex;
    var currentRowValues = sheet.getRange(targetRowIndex, 1, 1, headers.length).getValues()[0];

    for (var h = 0; h < headers.length; h++) {
      var key = headers[h];
      if (updateObj[key] !== undefined) {
        currentRowValues[h] = this.formatValueForSheet(updateObj[key], key);
      }
    }

    sheet.getRange(targetRowIndex, 1, 1, headers.length).setValues([currentRowValues]);
    this.invalidateCache(sheetName);
    return true;
  },

  /**
   * Xóa 1 dòng theo ID
   */
  deleteRowById: function(sheetName, id) {
    var sheet = this.getSheet(sheetName);
    var rows = this.getAllRows(sheetName);
    var targetIndex = -1;
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].id == id) {
        targetIndex = rows[i]._rowIndex;
        break;
      }
    }
    if (targetIndex !== -1) {
      sheet.deleteRow(targetIndex);
      this.invalidateCache(sheetName);
      return true;
    }
    return false;
  }
};
