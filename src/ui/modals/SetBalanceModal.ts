// src/ui/modals/SetBalanceModal.ts
//
// Lightweight Obsidian modal for the LiabilitiesTab "Force balance"
// action. Replaces the previous `window.prompt()` flow, which Electron
// blocks in renderer contexts ("prompt() is not supported.").
//
// The actual pad+balance write happens in the caller's onSubmit
// callback so this file stays UI-only.

import { App, Modal, Setting } from 'obsidian';

interface Opts {
    account: string;
    currency: string;
    /** Currently-displayed balance, pre-fills the input. */
    current: number;
    /** Called with the parsed numeric amount when the user confirms. */
    onSubmit: (amount: number) => void | Promise<void>;
}

export class SetBalanceModal extends Modal {
    private opts: Opts;
    private inputValue: string;

    constructor(app: App, opts: Opts) {
        super(app);
        this.opts = opts;
        this.inputValue = String(opts.current);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl('h2', { text: 'Force balance' });

        const desc = contentEl.createEl('p');
        desc.style.fontSize = 'var(--font-ui-small)';
        desc.style.color = 'var(--text-muted)';
        desc.innerHTML =
            `Write a <code>pad</code> + <code>balance</code> assertion pair so ` +
            `<code>${escapeHtml(this.opts.account)}</code> is reconciled to the ` +
            `value below. Bean-check inserts one auto-balancing adjustment ` +
            `transaction so the assertion passes.`;

        new Setting(contentEl)
            .setName(`New balance (${this.opts.currency})`)
            .setDesc('Numbers only — commas are stripped.')
            .addText(t => t
                .setValue(this.inputValue)
                .onChange(v => (this.inputValue = v))
                .inputEl.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        this.submit();
                    }
                }));

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Cancel')
                .onClick(() => this.close()))
            .addButton(btn => btn
                .setButtonText('Force balance')
                .setCta()
                .onClick(() => this.submit()));
    }

    private submit() {
        const cleaned = this.inputValue.replace(/,/g, '').trim();
        const amount = Number(cleaned);
        if (!isFinite(amount)) {
            // Inline error: re-render with a notice.
            const notice = this.contentEl.querySelector('.set-balance-error');
            if (notice) notice.remove();
            const err = this.contentEl.createDiv({ cls: 'set-balance-error' });
            err.style.color = 'var(--text-error)';
            err.style.fontSize = 'var(--font-ui-small)';
            err.style.marginTop = 'var(--size-4-2)';
            err.textContent = `Invalid amount: ${this.inputValue}`;
            return;
        }
        this.close();
        // Fire-and-forget — caller handles errors via Notice.
        void this.opts.onSubmit(amount);
    }

    onClose() {
        this.contentEl.empty();
    }
}

function escapeHtml(s: string): string {
    return s.replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]!));
}
