# UI Polish Report: Sleeker and More Compact Components

This report outlines proposed changes to polish the Beancount for Obsidian plugin's UI. The primary goals are to make the components "sleeker and compact", eliminate hardcoded inline styles, and better integrate with Obsidian's native design tokens (CSS variables).

## 1. General Structural & CSS Guidelines

**Problem:** Currently, many components use hardcoded pixel values (e.g., `padding: 20px`, `margin-top: 15px`) and inline styles. This makes the UI feel disjointed from the rest of Obsidian, especially when users change themes or adjust font sizes.

**Proposed Solutions:**
*   **Remove Inline Styles:** Transition all inline styles (especially in `OnboardingModal.ts`) to external stylesheets or Svelte `<style>` blocks.
*   **Adopt Obsidian Design Tokens:** Replace hardcoded pixels with Obsidian's spacing and sizing variables.
    *   Instead of `padding: 20px`, use `padding: var(--size-4-5)`.
    *   Instead of `margin-bottom: 10px`, use `margin-bottom: var(--size-4-2)`.
    *   Instead of `border-radius: 5px`, use `border-radius: var(--radius-s)` or `var(--radius-m)`.
*   **Standardize Typography:** Ensure consistent use of `var(--font-ui-small)`, `var(--text-normal)`, `var(--text-muted)`, and `var(--text-faint)`.
*   **Compact Inputs:** Reduce the padding and height of input fields and buttons slightly to make forms feel tighter and more professional.

## 2. Onboarding Workflow (`src/ui/modals/OnboardingModal.ts`)

**Problem:** The `OnboardingModal` is currently built manually using Obsidian's DOM creation API (`createDiv`, `createEl`) with heavy use of inline styles (e.g., `style.backgroundColor = 'var(--background-modifier-success)'`, `style.padding = '15px'`). This results in bulky, inflexible UI sections that are difficult to maintain and look less modern.

**Proposed Solutions:**
*   **Refactor to Svelte:** The most significant improvement would be to rewrite `OnboardingModal` as a Svelte component (`OnboardingModal.svelte`). This allows for declarative UI, scoped CSS, and much easier state management across the different steps (Prerequisites -> Data Setup -> Folder Setup -> Verification).
*   **Sleeker Layout:**
    *   Use a card-based layout for the different setup options (Demo Data vs. Existing File) instead of standard radio buttons with borders.
    *   Reduce the vertical spacing between instructions and input fields.
    *   Utilize Obsidian's standard `setting-item` CSS classes to automatically get the correct layout, padding, and typography for configuration options.
*   **Refine Visual Cues:** Use subtle background colors (`var(--background-secondary)`) instead of heavy borders for section grouping. Replace the hardcoded green success box with a standard Obsidian Notice or a more subtle success state utilizing `var(--text-success)`.

## 3. Svelte Modals (`src/ui/modals/`)

**Components:** `TransactionEditModal.svelte`, `AddBudgetModal.svelte`, `AddTargetModal.svelte`, `CommodityCreateModal.svelte`.

**Problem:** The forms in these modals can feel spread out. Some use custom classes while others mix and match Obsidian standards.

**Proposed Solutions:**
*   **Grid Layouts for Forms:** Use CSS Grid for forms (like `TransactionEditModal`) to align labels and inputs compactly.
*   **Tighter Spacing:** Reduce the `gap` between form elements from large values to `var(--size-4-2)` or `var(--size-4-3)`.
*   **Unified Footer:** Ensure all modals have a standard footer (like `.modal-footer`) aligned to the bottom right, with consistent button spacing.
*   **Autocomplete Dropdowns:** Ensure the custom autocomplete dropdowns (e.g., in `AddBudgetModal`) have tight padding (`var(--size-4-1) var(--size-4-2)`) and don't take up excessive vertical space.

## 4. Dashboard Tabs (`src/ui/partials/dashboard/`)

**Components:** `OverviewTab.svelte`, `JournalTab.svelte`, `TransactionsTab.svelte`, `IncomeStatementTab.svelte`, `BalanceSheetTab.svelte`, `CommoditiesTab.svelte`.

**Problem:** The dashboard container and individual tabs sometimes have conflicting padding, leading to double-spacing.

**Proposed Solutions:**
*   **Container Padding:** The main `UnifiedDashboardView` should handle the outer padding (`padding: var(--size-4-4)`). Individual tabs should not add their own wrapper padding unless necessary, reducing wasted whitespace.
*   **Table Density (Income/Balance Tabs):**
    *   Reduce table cell padding (e.g., `padding: var(--size-4-1) var(--size-4-2)` instead of larger defaults).
    *   Use a slightly smaller font size (`var(--font-ui-small)`) for dense data tables to allow more information to fit on screen without scrolling.
*   **Controls/Filters:** The filter controls (e.g., Date inputs, text searches in `TransactionsTab`) should be flex-wrapped tightly. Use Obsidian's standard input sizing.

## 5. Component Cards (`src/ui/partials/dashboard/cards/`)

**Components:** `TransactionCard.svelte`, `BalanceCard.svelte`, `NoteCard.svelte`, `CommodityCard.svelte`.

**Problem:** Cards use hardcoded padding (e.g., `padding: 1rem`) and borders that can make a list of transactions feel visually overwhelming.

**Proposed Solutions:**
*   **Compact Padding:** Change padding to `var(--size-4-3)` or even `var(--size-4-2)` for denser lists.
*   **Subtle Borders:** Consider using `var(--background-secondary)` for the card background with no border, or a very faint border (`1px solid var(--background-modifier-border-hover)`).
*   **Hierarchy:** Use font weights and colors more strictly. Make the main amount prominent, but de-emphasize metadata (like dates or accounts) using `var(--text-muted)` and smaller font sizes.
*   **Line Heights:** Reduce `line-height` slightly in data-heavy cards to compress vertical space.

## Summary

The overarching theme for the UI polish is **standardization** and **density**. By migrating away from hardcoded inline styles (especially in the onboarding flow) and fully embracing Obsidian's CSS variable system, the plugin will look like a native, sleek, and highly professional tool.
