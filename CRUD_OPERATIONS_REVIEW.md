# CRUD Operations Review - Obsidian Finance Plugin

**Generated:** February 10, 2026  
**Status:** ✅ All functions reviewed and validated

---

## Overview

This document provides a comprehensive audit of all Create, Read, Update, and Delete operations in the plugin, specifically focusing on:
- **File targeting**: How each function determines which file to write/modify
- **Line targeting**: How update/delete functions locate the correct line
- **Data integrity**: Whether operations use hardcoded paths or query-derived paths

---

## ✅ FILE PATH RESOLUTION SYSTEM

All CREATE operations use the **`resolveFilePath()`** helper function:

```typescript
function resolveFilePath(plugin, operationType, date?) {
    return getTargetFile(plugin, operationType, date);
}
```

### Structured Layout File Mapping
| Operation Type | Target File | Location Logic |
|---------------|-------------|----------------|
| `transaction` | `transactions/{YEAR}.beancount` | Year extracted from transaction date |
| `account` | `accounts.beancount` | Fixed file |
| `commodity` | `commodities.beancount` | Fixed file |
| `price` | `prices.beancount` | Fixed file |
| `balance` | `balances.beancount` | Fixed file |
| `note` | `notes.beancount` | Fixed file |
| `pad` | `pads.beancount` | Fixed file |
| `event` | `events.beancount` | Fixed file |

**✅ STATUS:** All CREATE operations correctly use `resolveFilePath()` and support structured layouts.

---

## 📝 CREATE OPERATIONS (Append to End of File)

### 1. **createTransaction()**
- **File:** `resolveFilePath(plugin, 'transaction', transactionDate)`
  - Routes to: `transactions/{year}.beancount`
- **Line:** Appends to end of file
- **Auto-creates:** Year file if doesn't exist
- **Backup:** ✅ Yes (if enabled)
- **Atomic write:** ✅ Yes (temp file + rename)
- **Status:** ✅ CORRECT

### 2. **createBalanceAssertion()**
- **File:** `resolveFilePath(plugin, 'balance', date)`
  - Routes to: `balances.beancount`
- **Line:** Appends to end of file
- **Format:** `YYYY-MM-DD balance Account Amount Currency ~ Tolerance`
- **Backup:** ✅ Yes (if enabled)
- **Atomic write:** ✅ Yes
- **Status:** ✅ CORRECT

### 3. **createNote()**
- **File:** `resolveFilePath(plugin, 'note', date)`
  - Routes to: `notes.beancount`
- **Line:** Appends to end of file
- **Format:** `YYYY-MM-DD note Account "Comment" #tag1 #tag2 ^link1`
- **Backup:** ✅ Yes (if enabled)
- **Atomic write:** ✅ Yes
- **Status:** ✅ CORRECT

### 4. **createCommodity()**
- **File:** `resolveFilePath(plugin, 'commodity', date)`
  - Routes to: `commodities.beancount`
- **Line:** Appends to end of file
- **Format:** 
  ```
  YYYY-MM-DD commodity SYMBOL
    price: "value"
    logo: "url"
  ```
- **Validation:** Symbol format `/^[A-Z0-9._-]+$/i`
- **Backup:** ✅ Yes (if enabled)
- **Atomic write:** ✅ Yes
- **Status:** ✅ CORRECT

### 5. **saveOpenDirective()** (Account Opening)
- **File:** `resolveFilePath(plugin, 'account', date)`
  - Routes to: `accounts.beancount`
- **Line:** Appends to end of file
- **Format:** `YYYY-MM-DD open Account [currencies] ["booking"]`
- **Backup:** ✅ Yes (if enabled)
- **Atomic write:** ✅ Yes
- **Status:** ✅ CORRECT

### 6. **saveCloseDirective()** (Account Closing)
- **File:** `resolveFilePath(plugin, 'account', date)`
  - Routes to: `accounts.beancount`
- **Line:** Appends to end of file
- **Format:** `YYYY-MM-DD close Account`
- **Backup:** ✅ Yes (if enabled)
- **Atomic write:** ✅ Yes
- **Status:** ✅ CORRECT

---

## 🔄 UPDATE OPERATIONS (Replace Existing Lines)

### 7. **updateTransaction()**
- **File Discovery:** BQL query → `SELECT filename, lineno FROM postings WHERE id = "{transactionId}"`
- **File Used:** ✅ `records[0]['filename']` (from query)
- **Line Discovery:** ✅ `records[0]['lineno']` (from query)
- **Line Type:** Posting line (not header)
- **Scanning Logic:**
  1. Scan **backward** from lineno to find transaction header (non-indented line)
  2. Scan **forward** from lineno to find end of transaction
  3. Replace entire transaction block
- **Backup:** ✅ Yes (if enabled)
- **Atomic write:** ✅ Yes (temp file + rename)
- **Status:** ✅ CORRECT (Fixed Feb 10, 2026)

### 8. **updateBalance()**
- **File Discovery:** BQL query → `SELECT filename, lineno FROM #entries WHERE type='balance' AND date={date} AND '{account}' IN accounts`
- **File Used:** ✅ `records[0]['filename']` (from query)
- **Line Discovery:** ✅ `records[0]['lineno']` (from query)
- **Line Type:** Exact balance directive line
- **Operation:** Replace single line at lineno
- **Format:** `YYYY-MM-DD balance Account Amount Currency ~ Tolerance`
- **Backup:** ✅ Yes (if enabled)
- **Atomic write:** ✅ Yes
- **Status:** ✅ CORRECT (Fixed Feb 10, 2026)

### 9. **updateNote()**
- **File Discovery:** BQL query → `SELECT filename, lineno FROM #entries WHERE type='note' AND date={date} AND '{account}' IN accounts`
- **File Used:** ✅ `records[0]['filename']` (from query)
- **Line Discovery:** ✅ `records[0]['lineno']` (from query)
- **Line Type:** Exact note directive line
- **Operation:** Replace single line at lineno
- **Format:** `YYYY-MM-DD note Account "Comment" #tags ^links`
- **Backup:** ✅ Yes (if enabled)
- **Atomic write:** ✅ Yes
- **Status:** ✅ CORRECT (Fixed Feb 10, 2026)

### 10. **saveCommodityMetadata()**
- **File:** Explicitly passed as parameter (from CommodityDetailModal)
- **Line:** Explicitly passed as parameter (from BQL query result)
- **Validation:** ✅ Verifies commodity symbol matches at given location
- **Operation:** 
  1. Find commodity block (header + indented metadata lines)
  2. Replace entire block with updated metadata
- **Format:**
  ```
  YYYY-MM-DD commodity SYMBOL
    key1: "value1"
    key2: "value2"
  ```
- **Backup:** ✅ Yes (if enabled)
- **Atomic write:** ✅ Yes
- **Status:** ✅ CORRECT (receives correct file/line from controller)

---

## ❌ DELETE OPERATIONS (Remove Lines)

### 11. **deleteTransaction()**
- **File Discovery:** BQL query → `SELECT filename, lineno FROM postings WHERE id = "{transactionId}"`
- **File Used:** ✅ `records[0]['filename']` (from query)
- **Line Discovery:** ✅ `records[0]['lineno']` (from query)
- **Line Type:** Posting line (not header)
- **Scanning Logic:**
  1. Scan **backward** from lineno to find transaction header (non-indented line)
  2. Scan **forward** from lineno to find end of transaction
  3. Includes trailing blank line if present
  4. Removes entire transaction block
- **Backup:** ✅ Yes (if enabled)
- **Atomic write:** ✅ Yes
- **Status:** ✅ CORRECT (Fixed Feb 10, 2026)

### 12. **deleteBalance()**
- **File Discovery:** BQL query → `SELECT filename, lineno FROM #entries WHERE type='balance' AND date={date} AND '{account}' IN accounts`
- **File Used:** ✅ `records[0]['filename']` (from query)
- **Line Discovery:** ✅ `records[0]['lineno']` (from query)
- **Line Type:** Exact balance directive line
- **Operation:** Remove single line at lineno
- **Backup:** ✅ Yes (if enabled)
- **Atomic write:** ✅ Yes
- **Status:** ✅ CORRECT (Fixed Feb 10, 2026)

### 13. **deleteNote()**
- **File Discovery:** BQL query → `SELECT filename, lineno FROM #entries WHERE type='note' AND date={date} AND '{account}' IN accounts`
- **File Used:** ✅ `records[0]['filename']` (from query)
- **Line Discovery:** ✅ `records[0]['lineno']` (from query)
- **Line Type:** Exact note directive line
- **Operation:** Remove single line at lineno
- **Backup:** ✅ Yes (if enabled)
- **Atomic write:** ✅ Yes
- **Status:** ✅ CORRECT (Fixed Feb 10, 2026)

---

## � SUMMARY STATISTICS

| Category | Total | ✅ Correct | ⚠️ Issues |
|----------|-------|-----------|----------|
| **CREATE** | 6 | 6 | 0 |
| **UPDATE** | 4 | 4 | 0 |
| **DELETE** | 3 | 3 | 0 |
| **TOTAL** | 13 | 13 | 0 |

**All operations verified and validated as of Feb 10, 2026.**

---

## 🎯 FILE PATH USAGE COMPARISON

### Before Fix (Feb 10, 2026)
| Function | File Source | Status |
|----------|-------------|--------|
| createTransaction | `resolveFilePath()` | ✅ |
| updateTransaction | ❌ `settings.beancountFilePath` | ❌ WRONG |
| deleteTransaction | ❌ `settings.beancountFilePath` | ❌ WRONG |
| updateBalance | ❌ `settings.beancountFilePath` | ❌ WRONG |
| deleteBalance | ❌ `settings.beancountFilePath` | ❌ WRONG |
| updateNote | ❌ `settings.beancountFilePath` | ❌ WRONG |
| deleteNote | ❌ `settings.beancountFilePath` | ❌ WRONG |

### After Fix (Feb 10, 2026)
| Function | File Source | Status |
|----------|-------------|--------|
| createTransaction | `resolveFilePath()` | ✅ CORRECT |
| updateTransaction | ✅ `records[0]['filename']` from BQL | ✅ CORRECT |
| deleteTransaction | ✅ `records[0]['filename']` from BQL | ✅ CORRECT |
| updateBalance | ✅ `records[0]['filename']` from BQL | ✅ CORRECT |
| deleteBalance | ✅ `records[0]['filename']` from BQL | ✅ CORRECT |
| updateNote | ✅ `records[0]['filename']` from BQL | ✅ CORRECT |
| deleteNote | ✅ `records[0]['filename']` from BQL | ✅ CORRECT |

---

## 🛡️ SAFETY FEATURES (ALL OPERATIONS)

✅ **Backup System:**
- All write operations support optional backups
- Backups created via `createBackupFile()` before modification
- Configurable via `plugin.settings.createBackups`

✅ **Atomic Writes:**
- All operations use temp file + rename pattern
- Prevents partial writes on failure
- File corruption protection

✅ **WSL Path Handling:**
- All operations convert WSL paths to Windows paths
- Uses `convertWslPathToWindows()` helper
- Enables cross-platform compatibility

✅ **Validation:**
- Commodity symbols validated with regex
- Line numbers validated against file length
- Improved error messages include context (file has X lines)

---

## 🔧 RECOMMENDATIONS

### 1. ~~**CRITICAL: Fix deleteTransaction() backward scan**~~ ✅ COMPLETED
**Priority:** ~~P0 - Critical~~ **FIXED Feb 10, 2026**  
**Impact:** Data corruption prevented  
**Action:** ✅ Copied backward scan logic from `updateTransaction()` to `deleteTransaction()`

### 2. **Consider adding updateAccount/deleteAccount**
**Priority:** P2 - Enhancement  
**Observation:** Only create operations exist for accounts (open/close)  
**Use case:** Modifying account metadata, changing currencies  
**Effort:** Medium

### 3. **Consider price management CRUD**
**Priority:** P3 - Future  
**Observation:** No price CRUD operations currently  
**Use case:** Manual price entry/editing  
**Effort:** Medium

### 4. **Add integration tests**
**Priority:** P2 - Quality  
**Coverage:** Test all 13 CRUD operations against both single-file and structured layouts  
**Scenarios:** Create → Update → Delete chains  
**Effort:** High

---

## 📝 NOTES

- All functions properly log operations for debugging
- Consistent error handling with try-catch + return objects
- Good separation of concerns (file resolution, backup, write)
- Path normalization handled consistently
- Good progress from initial implementation → current state

**Latest changes:** All UPDATE and DELETE operations now correctly use BQL-queried filenames instead of hardcoded paths, fixing a critical bug with structured layouts.
