// src/utils/directives/noteDirectives.ts

import type BeancountPlugin from '../../main';
import type { NoteData } from './types';
import type { JournalNote } from '../../models/journal';
import { getTargetFile } from '../structuredLayout';
import { atomicFileWrite, createBackupFile, convertWslPathToWindows, getNewlineCharacter, readFileContent } from '../fileEditor';
import { Logger } from '../logger';
import { blockEndIndex, formatNoteHeader, loadDirective, locationFromMetadata, parseNoteHeader, type LoadedDirective, type NoteHeader } from './directiveText';

export async function createNote(
	plugin: BeancountPlugin,
	date: string,
	account: string,
	comment: string,
	tags?: string[],
	links?: string[],
	createBackup = true
): Promise<{ success: boolean; error?: string }> {
	try {
		const filePath = getTargetFile(plugin, 'note', date);
		if (!filePath) return { success: false, error: 'Beancount file path not set' };

		const normalizedPath = convertWslPathToWindows(filePath);
		const extras: string[] = [];
		if (tags) for (const t of tags) { const c = t.replace(/^#/, ''); if (c) extras.push(`#${c}`); }
		if (links) for (const l of links) extras.push(`^${l}`);
		const content = await readFileContent(plugin, normalizedPath);
		const newline = getNewlineCharacter(content);
		// A multi-line comment is a valid multi-line beancount string.
		const directiveText = formatNoteHeader({ date, account, comment, rest: extras.map((e) => ` ${e}`).join('') }).split('\n').join(newline);

		await createBackupFile(plugin, normalizedPath, createBackup, 'createNote');
		const newContent = content.endsWith(newline) ? `${content}${directiveText}${newline}` : `${content}${newline}${directiveText}${newline}`;
		await atomicFileWrite(plugin, normalizedPath, newContent);

		Logger.log(`[createNote] Saved note for ${account}`);
		return { success: true };
	} catch (error) {
		Logger.error('[createNote] Error:', error);
		return { success: false, error: error instanceof Error ? error.message : String(error) };
	}
}

/** Loads the note a Journal entry was read from, checking the line still holds it. */
async function loadNote(
	plugin: BeancountPlugin,
	entry: Pick<JournalNote, 'date' | 'account' | 'metadata'>
): Promise<{ directive: LoadedDirective; parsed: NoteHeader }> {
	const location = locationFromMetadata(entry.metadata);
	if (!location) throw new Error("Couldn't find this note in your ledger files. Refresh and try again.");
	const directive = await loadDirective(plugin, location);
	const parsed = parseNoteHeader(directive.header);
	if (!parsed || parsed.date !== entry.date || parsed.account !== entry.account)
		throw new Error('This note has changed in your ledger since it was loaded. Refresh and try again.');
	return { directive, parsed };
}

/**
 * Rewrites date/account/text in place. Tags, links, a trailing comment and
 * metadata lines are kept as written (the edit form doesn't show them).
 */
export async function updateNote(
	plugin: BeancountPlugin,
	entry: Pick<JournalNote, 'date' | 'account' | 'metadata'>,
	noteData: Pick<NoteData, 'date' | 'account' | 'comment'>
): Promise<{ success: boolean; error?: string }> {
	try {
		const { directive, parsed } = await loadNote(plugin, entry);
		const { path, lines, newline, start, headerEnd } = directive;

		const header = formatNoteHeader({ ...parsed, date: noteData.date, account: noteData.account, comment: noteData.comment });

		await createBackupFile(plugin, path, plugin.settings.createBackups ?? true, 'updateNote');
		lines.splice(start, headerEnd - start + 1, ...header.split('\n'));
		await atomicFileWrite(plugin, path, lines.join(newline));
		Logger.log(`[updateNote] Updated ${path}:${start + 1}`);
		return { success: true };
	} catch (error) {
		Logger.error('[updateNote] Error:', error);
		return { success: false, error: error instanceof Error ? error.message : String(error) };
	}
}

/** Removes the note together with its metadata lines. */
export async function deleteNote(
	plugin: BeancountPlugin,
	entry: Pick<JournalNote, 'date' | 'account' | 'metadata'>
): Promise<{ success: boolean; error?: string }> {
	try {
		const { directive } = await loadNote(plugin, entry);
		const { path, lines, newline, start } = directive;

		await createBackupFile(plugin, path, plugin.settings.createBackups ?? true, 'deleteNote');
		lines.splice(start, blockEndIndex(lines, start) - start + 1);
		await atomicFileWrite(plugin, path, lines.join(newline));
		Logger.log(`[deleteNote] Deleted ${path}:${start + 1}`);
		return { success: true };
	} catch (error) {
		Logger.error('[deleteNote] Error:', error);
		return { success: false, error: error instanceof Error ? error.message : String(error) };
	}
}
