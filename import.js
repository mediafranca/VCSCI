// Apps Script for Google Sheets
// Adds a custom menu "VCSCI" to import and organise phrases from the JSON.
// Source JSON: https://raw.githubusercontent.com/mediafranca/VCSCI/refs/heads/main/core-phrase-list-all.json

function onOpen() {
  // Add a menu to run the importer from the spreadsheet UI
  SpreadsheetApp.getUi()
    .createMenu('VCSCI')
    .addItem('Importar y organizar frases', 'importAndOrganizeData')
    .addToUi();
}

function importAndOrganizeData() {
  // Main entry point: fetch JSON, wipe existing sheets, create one sheet per "function", and populate rows
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const url = 'https://raw.githubusercontent.com/mediafranca/VCSCI/refs/heads/main/core-phrase-list-all.json';
  const headers = ['english', 'spanish', 'domain', 'syntax']; // required header order

  try {
    // --- Fetch & parse JSON ---
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const status = response.getResponseCode();
    if (status !== 200) throw new Error('HTTP ' + status + ' al obtener el JSON');
    const data = JSON.parse(response.getContentText()); // expected: Array<{ function: string, phrases: Array<{spanish,english,domain,syntax}> }>

    if (!Array.isArray(data)) {
      throw new Error('El JSON no tiene el formato esperado (se esperaba un array de objetos).');
    }

    // --- Create a temporary sheet so we can delete all existing sheets safely ---
    const tempSheet = ss.insertSheet('_temp_delete_me');
    // Delete every other sheet
    ss.getSheets().forEach(sh => {
      if (sh.getSheetId() !== tempSheet.getSheetId()) {
        ss.deleteSheet(sh);
      }
    });

    // --- Build a map to avoid duplicate sheet names after sanitisation ---
    const usedNames = new Set();

    // --- For each function, create a sheet and populate ---
    data.forEach(block => {
      // Validate block structure
      if (!block || typeof block.function !== 'string' || !Array.isArray(block.phrases)) return;

      // Sanitise and uniquify the sheet name
      const baseName = sanitizeSheetName(block.function);
      const sheetName = makeUniqueName(baseName, usedNames);
      usedNames.add(sheetName);

      // Create the sheet
      const sheet = ss.insertSheet(sheetName);

      // Write headers
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

      // Transform phrases to rows in the required column order
      const rows = block.phrases.map(p => [
        valueOrEmpty(p.english), // english
        valueOrEmpty(p.spanish), // spanish
        valueOrEmpty(p.domain),  // domain
        valueOrEmpty(p.syntax)   // syntax
      ]);

      // Write rows if any
      if (rows.length > 0) {
        sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
      }

      // Basic formatting (optional but useful)
      sheet.setFrozenRows(1); // freeze header
      const lastRow = Math.max(1 + rows.length, 2);
      const lastCol = headers.length;
      sheet.getRange(1, 1, lastRow, lastCol).createFilter(); // add filter on header
      sheet.autoResizeColumns(1, headers.length); // auto-size columns
    });

    // --- Remove temporary sheet ---
    ss.deleteSheet(tempSheet);

    // --- Optional: set the first created function sheet as active ---
    const allSheets = ss.getSheets();
    if (allSheets.length > 0) ss.setActiveSheet(allSheets[0]);

    // Report completion via toast
    ss.toast('Importación y organización completadas.', 'VCSCI', 5);

  } catch (err) {
    // Surface any error to the user
    SpreadsheetApp.getActiveSpreadsheet().toast('Error: ' + err.message, 'VCSCI', 10);
    throw err; // also throw to show in execution log
  }
}

// --- Helpers ---

function sanitizeSheetName(name) {
  // Google Sheets sheet names cannot contain: : \ / ? * [ ]
  // Also limit length to 99 characters (Google limit is 100)
  const illegal = /[:\\\/\?\*\[\]]/g;
  let out = (name || 'Sheet').replace(illegal, ' ');
  out = out.trim();
  if (out.length === 0) out = 'Sheet';
  if (out.length > 99) out = out.substring(0, 99);
  return out;
}

function makeUniqueName(base, used) {
  // Ensure uniqueness: "Name", "Name (2)", "Name (3)", ...
  if (!used.has(base) && !sheetExists(base)) return base;
  let i = 2;
  while (true) {
    const candidate = `${base} (${i})`;
    if (!used.has(candidate) && !sheetExists(candidate)) return candidate;
    i++;
  }
}

function sheetExists(name) {
  // Check if a sheet with this name already exists in the active spreadsheet
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(name) !== null;
}

function valueOrEmpty(v) {
  // Normalise undefined/null to empty string to avoid setValues errors
  return (v === undefined || v === null) ? '' : String(v);
}