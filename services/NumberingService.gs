/**
 * NumberingService.gs
 * Quản lý sổ cấp số văn bản đi tự động và chống tranh chấp với LockService
 */

var NumberingService = {
  /**
   * Cấp số nhảy nguyên tử cho văn bản đi (Atomic Numbering Safe)
   */
  issueNextNumber: function(documentType, year, actor) {
    var targetYear = year || DateUtils.getCurrentYear();
    var docType = documentType || "DT_CV";

    return SheetUtils.withLock(function() {
      var rows = DB.getAllRows(CONFIG.SHEETS.DOCUMENT_NUMBERING.NAME);

      var docTypeRow = DB.findRow(CONFIG.SHEETS.DOCUMENT_TYPES.NAME, function(dt) {
        return dt.code === docType || dt.id === docType;
      });

      var targetRow = null;
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i];
        if (r.year == targetYear) {
          if (r.document_type === docType || 
             (docTypeRow && (r.document_type === docTypeRow.code || r.document_type === docTypeRow.id))) {
            targetRow = r;
            break;
          }
        }
      }

      var defaultPrefix = (docTypeRow && docTypeRow.prefix) ? docTypeRow.prefix : "CV";
      var orgCode = ConfigRepository.getSetting("COMPANY_CODE", "DMS");
      var fullPrefix = defaultPrefix + "-" + orgCode;

      var currentNumber = 0;
      var nextNumber = 1;

      if (targetRow) {
        currentNumber = parseInt(targetRow.current_number, 10) || 0;
        nextNumber = currentNumber + 1;
        var prefix = targetRow.prefix || fullPrefix;

        DB.updateRowById(CONFIG.SHEETS.DOCUMENT_NUMBERING.NAME, targetRow.id || (targetRow.year + "_" + targetRow.document_type), {
          current_number: nextNumber,
          updated_at: DateUtils.formatDateTime(new Date())
        });
      } else {
        // Tạo dòng cấp số mới cho năm và loại này
        nextNumber = 1;
        var targetDocTypeCode = docTypeRow ? docTypeRow.code : docType;
        DB.appendRowsBatch(CONFIG.SHEETS.DOCUMENT_NUMBERING.NAME, [{
          year: targetYear,
          document_type: targetDocTypeCode,
          prefix: fullPrefix,
          current_number: nextNumber,
          updated_at: DateUtils.formatDateTime(new Date())
        }]);
      }

      var prefixUsed = targetRow ? (targetRow.prefix || fullPrefix) : fullPrefix;
      var formattedNo = nextNumber + "/" + prefixUsed;

      if (actor) {
        AuditService.log({
          actor: actor,
          action: "ISSUE_NUMBER",
          entity_type: "NUMBERING",
          entity_id: (docTypeRow ? docTypeRow.code : docType) + "_" + targetYear,
          message_snapshot: "Cấp số tự động thành công: " + formattedNo
        });
      }

      return {
        success: true,
        year: targetYear,
        document_type: docTypeRow ? docTypeRow.code : docType,
        raw_number: nextNumber,
        prefix: prefixUsed,
        formatted_no: formattedNo
      };
    }, 10000);
  },

  /**
   * Lấy danh sách sổ cấp số văn bản theo năm (Đồng bộ động 100% với DOCUMENT_TYPES)
   */
  getNumberingList: function(year) {
    var targetYear = year || DateUtils.getCurrentYear();
    var orgCode = ConfigRepository.getSetting("COMPANY_CODE", "DMS");
    var docTypes = DB.findRows(CONFIG.SHEETS.DOCUMENT_TYPES.NAME, function(dt) {
      return dt.status !== "DELETED";
    });
    var existingRows = DB.getAllRows(CONFIG.SHEETS.DOCUMENT_NUMBERING.NAME);

    var existingMap = {};
    for (var i = 0; i < existingRows.length; i++) {
      var r = existingRows[i];
      if (r.year == targetYear) {
        existingMap[r.document_type] = r;
      }
    }

    var result = [];
    var newRowsToAppend = [];
    var nowStr = DateUtils.formatDateTime(new Date());

    for (var j = 0; j < docTypes.length; j++) {
      var dt = docTypes[j];
      var found = existingMap[dt.code] || existingMap[dt.id];
      if (found) {
        var curNum = parseInt(found.current_number, 10) || 0;
        var pfx = found.prefix || ((dt.prefix || dt.code) + "-" + orgCode);
        result.push({
          id: found.id || (targetYear + "_" + found.document_type),
          year: targetYear,
          document_type: found.document_type,
          doc_type_name: dt.name,
          doc_type_code: dt.code,
          doc_type_id: dt.id,
          prefix: pfx,
          current_number: curNum,
          next_number_preview: (curNum + 1) + "/" + pfx,
          updated_at: found.updated_at
        });
      } else {
        var defaultPrefix = (dt.prefix || dt.code) + "-" + orgCode;
        var newRow = {
          year: targetYear,
          document_type: dt.code,
          prefix: defaultPrefix,
          current_number: 0,
          updated_at: nowStr
        };
        newRowsToAppend.push(newRow);
        result.push({
          id: targetYear + "_" + dt.code,
          year: targetYear,
          document_type: dt.code,
          doc_type_name: dt.name,
          doc_type_code: dt.code,
          doc_type_id: dt.id,
          prefix: defaultPrefix,
          current_number: 0,
          next_number_preview: "1/" + defaultPrefix,
          updated_at: nowStr
        });
      }
    }

    if (newRowsToAppend.length > 0) {
      DB.appendRowsBatch(CONFIG.SHEETS.DOCUMENT_NUMBERING.NAME, newRowsToAppend);
    }

    // Bao gồm các dòng numbering kế thừa từ trước (nếu có loại không thuộc DOCUMENT_TYPES)
    for (var k = 0; k < existingRows.length; k++) {
      var er = existingRows[k];
      if (er.year == targetYear) {
        var alreadyInResult = result.some(function(item) {
          return item.document_type === er.document_type;
        });
        if (!alreadyInResult) {
          var eCurNum = parseInt(er.current_number, 10) || 0;
          result.push({
            id: er.id || (targetYear + "_" + er.document_type),
            year: targetYear,
            document_type: er.document_type,
            doc_type_name: er.document_type,
            doc_type_code: er.document_type,
            prefix: er.prefix,
            current_number: eCurNum,
            next_number_preview: (eCurNum + 1) + "/" + er.prefix,
            updated_at: er.updated_at
          });
        }
      }
    }

    return result;
  },

  /**
   * Cấu hình hoặc reset số nhảy của một sổ
   */
  updateNumbering: function(year, documentType, prefix, currentNumber, actor) {
    return SheetUtils.withLock(function() {
      var rows = DB.getAllRows(CONFIG.SHEETS.DOCUMENT_NUMBERING.NAME);
      var docTypeRow = DB.findRow(CONFIG.SHEETS.DOCUMENT_TYPES.NAME, function(dt) {
        return dt.code === documentType || dt.id === documentType;
      });

      var found = null;
      for (var i = 0; i < rows.length; i++) {
        if (rows[i].year == year && 
           (rows[i].document_type == documentType || 
           (docTypeRow && (rows[i].document_type == docTypeRow.code || rows[i].document_type == docTypeRow.id)))) {
          found = rows[i];
          break;
        }
      }

      var nowStr = DateUtils.formatDateTime(new Date());
      var targetDocTypeCode = docTypeRow ? docTypeRow.code : documentType;

      if (found) {
        DB.updateRowById(CONFIG.SHEETS.DOCUMENT_NUMBERING.NAME, found.id || (found.year + "_" + found.document_type), {
          prefix: prefix,
          current_number: parseInt(currentNumber, 10),
          updated_at: nowStr
        });
      } else {
        DB.appendRowsBatch(CONFIG.SHEETS.DOCUMENT_NUMBERING.NAME, [{
          year: parseInt(year, 10),
          document_type: targetDocTypeCode,
          prefix: prefix,
          current_number: parseInt(currentNumber, 10),
          updated_at: nowStr
        }]);
      }

      AuditService.log({
        actor: actor,
        action: "UPDATE_NUMBERING_CONFIG",
        entity_type: "CONFIG",
        entity_id: targetDocTypeCode + "_" + year,
        message_snapshot: "Cập nhật sổ cấp số " + (docTypeRow ? docTypeRow.name : targetDocTypeCode) + " (" + year + "): Tiền tố " + prefix + ", số hiện tại " + currentNumber
      });

      return { success: true, message: "Cập nhật sổ cấp số thành công!" };
    });
  }
};
