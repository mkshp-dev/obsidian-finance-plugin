# Postings Tab Improvements

## ✅ **Balance Column Added + Tab Renamed**

### **Changes Made**

1. **🏷️ Tab Renamed**: "Transactions" → "Postings"
   - More accurate since it shows individual postings, not full transactions
   - Updated in `UnifiedDashboardView.svelte`

2. **📊 Balance Column Added**: 
   - Added `balance` to BQL query to get running balances
   - Updated table headers to include sortable "Balance" column
   - Updated table body to display balance values
   - Right-aligned balance display for better readability

### **Files Modified**

#### **1. `src/queries/index.ts`**
```typescript
// BEFORE
const selectPart = `SELECT date, payee, narration, position`;

// AFTER  
const selectPart = `SELECT date, payee, narration, position, balance`;
```

#### **2. `src/controllers/TransactionController.ts`**
```typescript
// BEFORE
const defaultHeaders = ['date', 'payee', 'narration', 'position'];

// AFTER
const defaultHeaders = ['date', 'payee', 'narration', 'position', 'balance'];
```

#### **3. `src/components/tabs/TransactionsTab.svelte`**

**Updated Sorting Type:**
```typescript
// BEFORE
type SortColumn = 'date' | 'payee' | 'narration' | 'amount';

// AFTER
type SortColumn = 'date' | 'payee' | 'narration' | 'amount' | 'balance';
```

**Updated Headers Array:**
```typescript
// BEFORE
const headers = ['date', 'payee', 'narration', 'amount'];

// AFTER
const headers = ['date', 'payee', 'narration', 'amount', 'balance'];
```

**Updated Table Header:**
```html
<!-- ADDED -->
<th on:click={() => handleSort('balance')} class:active={sortColumn === 'balance'}>
    Balance {sortColumn === 'balance' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
</th>
```

**Updated Table Body:**
```html
<!-- BEFORE -->
{#each sortedTransactions as [date, payee, narration, position]}
    <tr>
        <td>{date}</td>
        <td>{payee}</td>
        <td>{narration}</td>
        <td class="align-right">{position}</td>
    </tr>
{/each}

<!-- AFTER -->
{#each sortedTransactions as [date, payee, narration, position, balance]}
    <tr>
        <td>{date}</td>
        <td>{payee}</td>
        <td>{narration}</td>
        <td class="align-right">{position}</td>
        <td class="align-right">{balance}</td>
    </tr>
{/each}
```

#### **4. `src/views/UnifiedDashboardView.svelte`**
```typescript
// BEFORE
type Tab = 'Overview' | 'Transactions' | 'Balance Sheet' | 'Accounts' | 'Commodities' | 'Journal';

// AFTER
type Tab = 'Overview' | 'Postings' | 'Balance Sheet' | 'Accounts' | 'Commodities' | 'Journal';

// BEFORE
<button class:active={activeTab === 'Transactions'}>Transactions</button>

// AFTER  
<button class:active={activeTab === 'Postings'}>Postings</button>
```

### **New Features**

#### **✅ Sortable Balance Column**
- Click "Balance" header to sort by running balance (ascending/descending)
- Shows running balances for each posting
- Right-aligned for better number readability
- Integrates with existing sorting system

#### **✅ Complete Posting Information**
The tab now shows 5 columns:
1. **Date**: Transaction date
2. **Payee**: Transaction payee/description  
3. **Narration**: Transaction narration/memo
4. **Amount**: Posting amount (position)
5. **Balance**: Running balance for the account ⭐ **NEW**

#### **✅ Accurate Tab Name**
- **Before**: "Transactions" (misleading - showed postings)
- **After**: "Postings" (accurate - shows individual account postings)

### **Expected Data Display**

```
| Date       | Payee         | Narration     | Amount      | Balance     |
|------------|---------------|---------------|-------------|-------------|
| 2025-11-03 | Grocery Store | Weekly shop   | -150.00 USD | 2,850.00 USD|
| 2025-11-01 | Salary Inc.   | Monthly pay   | 3,000.00 USD| 3,000.00 USD|
| 2025-10-31 | Rent Payment  | October rent  | -1,200.00 USD| 1,800.00 USD|
```

### **Benefits**

1. **📊 Running Balance Tracking**: See account balance progression over time
2. **🔍 Better Financial Insight**: Understand cash flow impacts immediately  
3. **📱 Sortable Balances**: Sort by balance to see highest/lowest balance periods
4. **🏷️ Accurate Naming**: Tab name reflects actual content (postings vs transactions)
5. **💫 Enhanced UX**: Right-aligned numbers for better readability

### **Testing**

1. **Load Plugin**: Ensure latest build in Obsidian vault
2. **Open Dashboard**: Navigate to "Postings" tab (renamed from "Transactions")
3. **Check Columns**: Verify 5 columns including new "Balance" column
4. **Test Sorting**: Click "Balance" header to sort by running balance
5. **Verify Data**: Confirm balance values show running totals correctly

The Postings tab now provides comprehensive posting information with running balance tracking! 📊