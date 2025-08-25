/** 
 * Apps Script for Google Sheets
 * Export all function sheets to individual JSON files in Google Drive.
 * File name pattern: core-phrase-list-XX-<function-slug>.json
 * Data shape per file:
 * {
 *   "function": "<sheet name>",
 *   "phrases": [
 *     {"english": "...", "spanish": "...", "domain": "...", "syntax": "..."},
 *     ...
 *   ]
 * }
 */

function onOpen() {
  // Add a menu to run the exporter from the spreadsheet UI
  SpreadsheetApp.getUi()
    .createMenu('VCSCI')
    .addItem('Exportar JSONs', 'exportSheetsToJsons')
    .addToUi();
}

function exportSheetsToJsons() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();                 // active spreadsheet
  const sheets = ss.getSheets();                                     // all sheets
  const baseName = 'core-phrase-list';                               // constant prefix
  const expectedHeaders = ['english', 'spanish', 'domain', 'syntax'];// expected header order
  const timestamp = Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd_HHmm'); // time tag

  // Create an output folder in Drive to store the JSON files (root of My Drive)
  const outFolderName = `VCSCI_export_${timestamp}`;
  const outFolder = DriveApp.createFolder(outFolderName);            // new folder in root

  // Loop through sheets and export each as a JSON file
  let sheetIndex = 0;                                                // visible counter (1-based in filenames)
  sheets.forEach((sh) => {
    sheetIndex++;                                                    // increment for each sheet
    const sheetName = sh.getName();                                  // e.g., "request", "comment", etc.
    const slug = slugify(sheetName);                                 // turn sheet name into a safe slug
    const indexPadded = zeroPad(sheetIndex, 2);                      // "01", "02", ...

    // Read current sheet range and convert to objects
    const dataRange = sh.getDataRange();                             // includes headers + rows
    const values = dataRange.getValues();                            // 2D array
    if (values.length < 2) {
      // No data rows (only header or empty); still write an empty "phrases" array
      const emptyObj = { function: sheetName, phrases: [] };
      writeJsonFile(outFolder, `${baseName}-${indexPadded}-${slug}.json`, emptyObj);
      return;                                                        // continue to next sheet
    }

    // Validate headers (first row)
    const headers = values[0].map(h => String(h).trim().toLowerCase());// normalise header row
    const colIndex = mapHeaderIndexes(headers, expectedHeaders);     // map column indexes for expected fields

    // Build phrase rows (skip header row)
    const phrases = [];
    for (let r = 1; r < values.length; r++) {
      const row = values[r];

      // Skip completely empty rows (all empty strings)
      if (row.every(cell => String(cell).trim() === '')) continue;

      // Extract fields by mapped indexes; fall back to empty string if not found
      const english = pickCell(row, colIndex.english);
      const spanish = pickCell(row, colIndex.spanish);
      const domain  = pickCell(row, colIndex.domain);
      const syntax  = pickCell(row, colIndex.syntax);

      // If the three key text fields are empty, treat as blank row
      if ([english, spanish, domain, syntax].every(v => v === '')) continue;

      phrases.push({ english, spanish, domain, syntax });            // append phrase object
    }

    // Build final object per spec
    const obj = {
      function: sheetName,
      phrases: phrases
    };

    // Write JSON file for this sheet
    writeJsonFile(outFolder, `${baseName}-${indexPadded}-${slug}.json`, obj);
  });

  // Notify user with a toast; link can be found in Apps Script logs
  SpreadsheetApp.getActiveSpreadsheet().toast(`Exportación completa en carpeta: ${outFolder.getName()}`, 'VCSCI', 8);
  Logger.log('Carpeta de salida: %s', outFolder.getUrl());          // log folder URL for quick access
}

/* =========================
   Helpers
   ========================= */

function writeJsonFile(folder, filename, obj) {
  // Serialize object with pretty-print for readability
  const json = JSON.stringify(obj, null, 2);                         // 2-space indent
  // Create (or overwrite) a Drive file with JSON MIME type
  // Note: DriveApp has no direct overwrite; if existing file with same name exists in this folder, both will coexist.
  folder.createFile(filename, json, MimeType.JSON);                  // create file in given folder
}

function mapHeaderIndexes(actualHeaders, expectedHeaders) {
  // Build a mapping object {english: idx, spanish: idx, domain: idx, syntax: idx}
  // If a header is missing, set index to -1 so we can fallback to empty strings.
  const idx = {};
  expectedHeaders.forEach(h => {
    const i = actualHeaders.indexOf(h);
    idx[h] = (i >= 0 ? i : -1);
  });
  return idx;                                                         // e.g., {english:0, spanish:1, domain:2, syntax:3}
}

function pickCell(row, idx) {
  // Return normalised cell content by index; empty string if index invalid
  if (idx < 0 || idx >= row.length) return '';
  const v = row[idx];
  return (v === null || v === undefined) ? '' : String(v).trim();
}

function slugify(name) {
  // Convert sheet name to a safe slug for file names
  // Lowercase, replace spaces with '-', remove/replace unsafe characters
  return String(name)
    .toLowerCase()
    .normalize('NFKD')                  // separate accents
    .replace(/[\u0300-\u036f]/g, '')    // remove diacritics
    .replace(/[^a-z0-9]+/g, '-')        // non-alphanumerics to hyphen
    .replace(/^-+|-+$/g, '')            // trim hyphens
    .substring(0, 80) || 'sheet';       // limit length and fallback
}

function zeroPad(n, width) {
  // Left-pad an integer with zeros to given width
  const s = String(Math.floor(Math.max(0, n)));
  return s.length >= width ? s : '0'.repeat(width - s.length) + s;
}