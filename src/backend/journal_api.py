#!/usr/bin/env python3
"""
Beancount Journal API Backend
Provides REST API endpoints for complete transaction data parsing
"""

import os
import sys
import json
import argparse
import re
import shutil
from datetime import datetime, date
from decimal import Decimal
from typing import List, Dict, Any, Optional, Union
from flask import Flask, jsonify, request
from flask_cors import CORS
import subprocess
import urllib.request
import urllib.error

# Beancount imports
try:
    from beancount import loader
    from beancount.core import data
    from beancount.core.amount import Amount
    from beancount.core.position import Position
    from beancount.core.inventory import Inventory
    from beancount.core.compare import hash_entry
    from beancount.parser import options
except ImportError:
    print("Error: Beancount is not installed. Install it with: pip install beancount")
    sys.exit(1)

class BeancountJournalAPI:
    """
    Main API class for Beancount journal data.

    Handles loading, parsing, and querying of the Beancount file, as well as
    providing methods to modify the file (add, update, delete entries).
    """

    @staticmethod
    def filter_user_metadata(meta: dict) -> dict:
        """
        Return only user-supplied metadata, filtering out internal fields.

        Args:
            meta (dict): The metadata dictionary from a Beancount entry.

        Returns:
            dict: A new dictionary containing only user-supplied metadata.
        """
        if not meta:
            return {}
        return {k: v for k, v in meta.items() if k not in ('lineno', 'filename')}
    
    def __init__(self, beancount_file: str, create_backups: bool = True, max_backup_files: int = 10):
        """
        Initialize the BeancountJournalAPI.

        Args:
            beancount_file (str): The file path to the main Beancount ledger file.
            create_backups (bool): Whether to create backup files before modifications.
            max_backup_files (int): Maximum number of backup files to keep (0 = unlimited).
        """
        self.beancount_file = beancount_file
        self.create_backups = create_backups
        self.max_backup_files = max_backup_files
        self.entries = None
        self.errors = None
        self.options_map = None
        self.load_data()
    
    def load_data(self):
        """
        Load and parse the Beancount file.

        Populates self.entries, self.errors, and self.options_map.
        Prints errors to stdout if parsing fails or has warnings.

        Raises:
            Exception: If loading the file fails completely.
        """
        try:
            self.entries, self.errors, self.options_map = loader.load_file(self.beancount_file)
            if self.errors:
                print(f"Warning: {len(self.errors)} errors found in Beancount file")
                for error in self.errors[:5]:  # Show first 5 errors
                    print(f"  - {error}")
        except Exception as e:
            print(f"Error loading Beancount file: {e}")
            raise
    
    def reload_data(self):
        """
        Reload the Beancount file.

        Useful when the file has been modified externally or by this API.
        """
        self.load_data()
    
    def create_backup_if_enabled(self, target_file: str = None) -> Optional[str]:
        """
        Create a backup of the target file if backups are enabled.
        Also manages cleanup of old backups based on max_backup_files setting.

        Args:
            target_file (str): Path to the file to backup. Defaults to self.beancount_file.

        Returns:
            Optional[str]: Path to the backup file if created, None otherwise.
        """
        if not self.create_backups:
            return None
        
        file_to_backup = target_file or self.beancount_file
        backup_path = f"{file_to_backup}.backup.{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        shutil.copy2(file_to_backup, backup_path)
        print(f"[DEBUG] Created backup: {backup_path}")
        
        # Cleanup old backups if max_backup_files is set
        if self.max_backup_files > 0:
            self.cleanup_old_backups(file_to_backup)
        
        return backup_path
    
    def cleanup_old_backups(self, target_file: str = None):
        """
        Remove old backup files, keeping only the most recent max_backup_files.

        Args:
            target_file (str): Path to the original file. Backups will be identified by pattern.
        """
        file_to_check = target_file or self.beancount_file
        backup_pattern = f"{file_to_check}.backup.*"
        
        import glob
        backup_files = glob.glob(backup_pattern)
        
        if len(backup_files) > self.max_backup_files:
            # Sort by modification time (oldest first)
            backup_files.sort(key=os.path.getmtime)
            
            # Remove oldest files
            files_to_remove = backup_files[:len(backup_files) - self.max_backup_files]
            for old_backup in files_to_remove:
                try:
                    os.remove(old_backup)
                    print(f"[DEBUG] Removed old backup: {old_backup}")
                except Exception as e:
                    print(f"[WARN] Failed to remove old backup {old_backup}: {e}")
    
    def get_entries(self, 
                   start_date: Optional[str] = None,
                   end_date: Optional[str] = None,
                   account_filter: Optional[str] = None,
                   payee_filter: Optional[str] = None,
                   tag_filter: Optional[str] = None,
                   search_term: Optional[str] = None,
                   entry_types: Optional[List[str]] = None,
                   limit: int = 100,
                   offset: int = 0) -> Dict[str, Any]:
        """
        Get all entries (transactions and other directives) with filtering and pagination.

        Args:
            start_date (Optional[str]): Filter entries on or after this date (YYYY-MM-DD).
            end_date (Optional[str]): Filter entries on or before this date (YYYY-MM-DD).
            account_filter (Optional[str]): Filter entries involving this account name.
            payee_filter (Optional[str]): Filter transactions by payee name.
            tag_filter (Optional[str]): Filter transactions containing this tag.
            search_term (Optional[str]): General search term matching payee, narration, or account.
            entry_types (Optional[List[str]]): List of entry types to include (e.g., ['transaction', 'note']).
                                               Defaults to ['transaction', 'balance', 'pad', 'note'].
            limit (int): Maximum number of entries to return. Defaults to 100.
            offset (int): Number of entries to skip. Defaults to 0.

        Returns:
            Dict[str, Any]: A dictionary containing:
                - entries (List[Dict]): The list of filtered entry objects.
                - total_count (int): Total number of entries after filtering (before pagination).
                - returned_count (int): Number of entries returned in this page.
                - offset (int): The offset used.
                - limit (int): The limit used.
                - has_more (bool): True if there are more entries available after this page.
        """
        entries = []
        
        # Default to essential journal entry types if none specified
        if not entry_types:
            entry_types = ['transaction', 'balance', 'pad', 'note']
        
        print(f"[DEBUG] Processing entries with types: {entry_types}")
        print(f"[DEBUG] Total beancount entries: {len(self.entries)}")
        
        # Filter entries based on type and other criteria
        for i, entry in enumerate(self.entries):
            try:
                entry_type = self.get_entry_type(entry)
                
                # Skip if entry type not requested
                if entry_type not in entry_types:
                    continue
                
                # Apply date filters
                if start_date:
                    start_dt = datetime.strptime(start_date, '%Y-%m-%d').date()
                    if entry.date < start_dt:
                        continue
                
                if end_date:
                    end_dt = datetime.strptime(end_date, '%Y-%m-%d').date()
                    if entry.date > end_dt:
                        continue
                
                # Apply account filter (different logic for different entry types)
                if account_filter:
                    if not self.entry_matches_account(entry, account_filter):
                        continue
                
                # Apply payee filter
                if payee_filter:
                    if isinstance(entry, data.Transaction):
                        if not entry.payee or payee_filter.lower() not in entry.payee.lower():
                            continue
                    else:
                        # Skip non-transactions when filtering by payee
                        continue
                
                # Apply tag filter
                if tag_filter:
                    if isinstance(entry, data.Transaction):
                        if not entry.tags or tag_filter.lower() not in [t.lower() for t in entry.tags]:
                            continue
                    else:
                        # Skip non-transactions when filtering by tag
                        continue
                
                # Apply search term
                if search_term:
                    if not self.entry_matches_search(entry, search_term):
                        continue
                
                # Convert entry to dict
                entry_data = self.entry_to_dict(entry)
                entries.append(entry_data)
                
                if len(entries) % 100 == 0:
                    print(f"[DEBUG] Processed {len(entries)} entries so far...")
                    
            except Exception as e:
                print(f"[ERROR] Failed to process entry {i}: {e}")
                continue
        
        print(f"[DEBUG] Filtered to {len(entries)} entries before pagination")
        
        # Sort by date descending (newest first)
        entries.sort(key=lambda x: x['date'], reverse=True)
        
        # Apply pagination
        total_count = len(entries)
        entries = entries[offset:offset + limit]
        
        return {
            'entries': entries,
            'total_count': total_count,
            'returned_count': len(entries),
            'offset': offset,
            'limit': limit,
            'has_more': offset + len(entries) < total_count
        }
    
    def get_entry_type(self, entry) -> str:
        """
        Get the string type representation of a Beancount entry.

        Args:
            entry: A Beancount directive object.

        Returns:
            str: One of 'transaction', 'note', 'balance', 'pad', or 'unknown'.
        """
        if isinstance(entry, data.Transaction):
            return 'transaction'
        elif isinstance(entry, data.Note):
            return 'note'
        elif isinstance(entry, data.Balance):
            return 'balance'
        elif isinstance(entry, data.Pad):
            return 'pad'
        else:
            return 'unknown'
    
    def entry_matches_account(self, entry, account_filter: str) -> bool:
        """
        Check if an entry matches the account filter.

        Args:
            entry: The Beancount entry to check.
            account_filter (str): The account name substring to match.

        Returns:
            bool: True if the entry involves the account, False otherwise.
        """
        account_lower = account_filter.lower()
        
        if isinstance(entry, data.Transaction):
            return any(account_lower in posting.account.lower() for posting in entry.postings)
        elif isinstance(entry, (data.Note, data.Balance, data.Pad)):
            return account_lower in entry.account.lower()
        
        return False
    
    def entry_matches_search(self, entry, search_term: str) -> bool:
        """
        Check if an entry matches a general search term.

        Args:
            entry: The Beancount entry to check.
            search_term (str): The term to search for in payee, narration, or accounts.

        Returns:
            bool: True if the search term matches any relevant field.
        """
        search_lower = search_term.lower()
        
        if isinstance(entry, data.Transaction):
            matches_payee = entry.payee and search_lower in entry.payee.lower()
            matches_narration = entry.narration and search_lower in entry.narration.lower()
            matches_account = any(search_lower in posting.account.lower() for posting in entry.postings)
            return matches_payee or matches_narration or matches_account
        
        elif isinstance(entry, data.Note):
            matches_account = search_lower in entry.account.lower()
            matches_comment = search_lower in entry.comment.lower()
            return matches_account or matches_comment
        
        elif isinstance(entry, (data.Balance, data.Pad)):
            return search_lower in entry.account.lower()
        
        return False
    
    def entry_to_dict(self, entry) -> Dict[str, Any]:
        """
        Convert any supported Beancount entry to a dictionary.

        Args:
            entry: The Beancount entry object.

        Returns:
            Dict[str, Any]: A dictionary representation of the entry, suitable for JSON serialization.
        """
        # Safely convert metadata
        safe_metadata = {}
        if hasattr(entry, 'meta') and entry.meta:
            for key, value in entry.meta.items():
                try:
                    # Only include JSON-serializable values
                    if value is None or isinstance(value, (str, int, float, bool)):
                        safe_metadata[key] = value
                    elif hasattr(value, 'isoformat'):  # Date objects
                        safe_metadata[key] = value.isoformat()
                    else:
                        # Convert other types to string
                        safe_metadata[key] = str(value)
                except Exception as e:
                    print(f"[WARNING] Skipping metadata key '{key}' due to serialization error: {e}")
                    continue
        
        base_data = {
            'id': self.generate_entry_id(entry),
            'type': self.get_entry_type(entry),
            'date': entry.date.isoformat(),
            'metadata': safe_metadata
        }
        
        if isinstance(entry, data.Transaction):
            return {**base_data, **self.transaction_to_dict_data(entry)}
        elif isinstance(entry, data.Note):
            return {**base_data, **self.note_to_dict_data(entry)}
        elif isinstance(entry, data.Balance):
            return {**base_data, **self.balance_to_dict_data(entry)}
        elif isinstance(entry, data.Pad):
            return {**base_data, **self.pad_to_dict_data(entry)}
        else:
            return base_data
    
    def generate_entry_id(self, entry) -> str:
        """
        Generate a unique ID using Beancount's official hash_entry function.

        Args:
            entry: The Beancount entry.

        Returns:
            str: A hash string uniquely identifying the entry.
        """
        # Use Beancount's built-in stable hash function
        # This includes metadata (filename, lineno) by default for true uniqueness
        return hash_entry(entry, exclude_meta=False)
    
    def transaction_to_dict_data(self, transaction: data.Transaction) -> Dict[str, Any]:
        """
        Convert transaction-specific data to a dictionary.

        Args:
            transaction (data.Transaction): The transaction object.

        Returns:
            Dict[str, Any]: Dictionary containing flag, payee, narration, tags, links, and postings.
        """
        postings = []
        for posting in transaction.postings:
            posting_data = {
                'account': posting.account,
                'amount': None,
                'currency': None,
                'price': None,
                'cost': None,
                'flag': posting.flag if hasattr(posting, 'flag') and posting.flag else None,
                'comment': None,
                'metadata': {}
            }
            
            # Extract posting-level metadata
            if hasattr(posting, 'meta') and posting.meta:
                for key, value in posting.meta.items():
                    # Skip internal beancount metadata fields
                    if key not in ['filename', 'lineno']:
                        if isinstance(value, (str, int, float, bool)):
                            posting_data['metadata'][key] = str(value)
            
            if posting.units:
                posting_data['amount'] = str(posting.units.number)
                posting_data['currency'] = posting.units.currency
            
            if posting.price:
                posting_data['price'] = {
                    'amount': str(posting.price.number),
                    'currency': posting.price.currency
                }
            
            if posting.cost:
                posting_data['cost'] = {
                    'number': str(posting.cost.number) if posting.cost.number else None,
                    'currency': posting.cost.currency,
                    'date': posting.cost.date.isoformat() if posting.cost.date else None,
                    'label': posting.cost.label
                }
            
            postings.append(posting_data)
        
        return {
            'flag': transaction.flag,
            'payee': transaction.payee,
            'narration': transaction.narration,
            'tags': list(transaction.tags) if transaction.tags else [],
            'links': list(transaction.links) if transaction.links else [],
            'postings': postings
        }
    
    def note_to_dict_data(self, note: data.Note) -> Dict[str, Any]:
        """
        Convert Note directive data to a dictionary.

        Args:
            note (data.Note): The note object.

        Returns:
            Dict[str, Any]: Dictionary containing account and comment.
        """
        return {
            'account': note.account,
            'comment': note.comment
        }
    
    def balance_to_dict_data(self, balance: data.Balance) -> Dict[str, Any]:
        """
        Convert Balance directive data to a dictionary.

        Args:
            balance (data.Balance): The balance object.

        Returns:
            Dict[str, Any]: Dictionary containing account, amount, currency, tolerance, and diff_amount.
        """
        return {
            'account': balance.account,
            'amount': str(balance.amount.number),
            'currency': balance.amount.currency,
            'tolerance': str(balance.tolerance) if balance.tolerance else None,
            'diff_amount': str(balance.diff_amount.number) if balance.diff_amount else None
        }
    
    def pad_to_dict_data(self, pad: data.Pad) -> Dict[str, Any]:
        """
        Convert Pad directive data to a dictionary.

        Args:
            pad (data.Pad): The pad object.

        Returns:
            Dict[str, Any]: Dictionary containing account and source_account.
        """
        return {
            'account': pad.account,
            'source_account': pad.source_account
        }
    
    def get_transactions(self, 
                        start_date: Optional[str] = None,
                        end_date: Optional[str] = None,
                        account_filter: Optional[str] = None,
                        payee_filter: Optional[str] = None,
                        tag_filter: Optional[str] = None,
                        search_term: Optional[str] = None,
                        limit: int = 100,
                        offset: int = 0) -> Dict[str, Any]:
        """
        Legacy method to get only transactions (for backward compatibility).

        Delegates to get_entries with entry_types=['transaction'].

        Args:
            start_date (Optional[str]): Start date filter.
            end_date (Optional[str]): End date filter.
            account_filter (Optional[str]): Account name filter.
            payee_filter (Optional[str]): Payee name filter.
            tag_filter (Optional[str]): Tag filter.
            search_term (Optional[str]): General search term.
            limit (int): Max results.
            offset (int): Pagination offset.

        Returns:
            Dict[str, Any]: Dictionary containing list of 'transactions' and pagination metadata.
        """
        result = self.get_entries(
            start_date=start_date,
            end_date=end_date,
            account_filter=account_filter,
            payee_filter=payee_filter,
            tag_filter=tag_filter,
            search_term=search_term,
            entry_types=['transaction'],
            limit=limit,
            offset=offset
        )
        
        # Rename 'entries' to 'transactions' for backward compatibility
        return {
            'transactions': result['entries'],
            'total_count': result['total_count'],
            'returned_count': result['returned_count'],
            'offset': result['offset'],
            'limit': result['limit'],
            'has_more': result['has_more']
        }
    

    
    def find_first_directive_date(self) -> Optional[date]:
        """
        Return the earliest date found across all entries (best-effort).

        Returns:
            Optional[date]: The earliest date, or None if no dated entries exist.
        """
        first = None
        for entry in self.entries:
            try:
                if hasattr(entry, 'date') and entry.date:
                    if first is None or entry.date < first:
                        first = entry.date
            except Exception:
                continue
        return first

    def create_commodity_declaration(self, symbol: str, metadata: Dict[str, Any], date_for_decl: Optional[date] = None) -> Dict[str, Any]:
        """
        Append a new commodity declaration to the Beancount file.

        Args:
            symbol (str): The commodity symbol.
            metadata (Dict[str, Any]): Metadata key-value pairs to attach.
            date_for_decl (Optional[date]): The date for the directive. Defaults to first directive date or today.

        Returns:
            Dict[str, Any]: Result object with 'success' (bool) and optional 'message' or 'error'.
        """
        try:
            print(f"[DEBUG] create_commodity_declaration called for symbol={symbol} metadata={metadata} date_for_decl={date_for_decl}")
            if not isinstance(metadata, dict):
                print(f"[DEBUG] metadata is not a dict, got {type(metadata)}; setting to empty dict.")
                metadata = {}
            if date_for_decl is None:
                date_for_decl = self.find_first_directive_date() or date.today()
            # Build commodity declaration text
            lines = [f"{date_for_decl.isoformat()} commodity {symbol}"]
            if metadata:
                for k, v in metadata.items():
                    if isinstance(v, str):
                        lines.append(f"  {k}: \"{v}\"")
                    else:
                        lines.append(f"  {k}: {v}")
            # If no metadata, just header line
            text = '\n'.join(lines) + '\n'

            # Determine target file for appending: prefer the beancount file by default
            target_file = self.beancount_file

            # If there are existing entries referencing this commodity, prefer their file
            for entry in self.entries:
                try:
                    if isinstance(entry, data.Price) and entry.currency == symbol and hasattr(entry, 'meta') and entry.meta and 'filename' in entry.meta:
                        target_file = entry.meta.get('filename') or target_file
                        break
                    if isinstance(entry, data.Transaction):
                        for posting in entry.postings:
                            if posting.units and posting.units.currency == symbol and hasattr(entry, 'meta') and entry.meta and 'filename' in entry.meta:
                                target_file = entry.meta.get('filename') or target_file
                                break
                except Exception:
                    continue

            # Backup and append to the target file
            print(f"[DEBUG] Appending commodity declaration to target_file={target_file}")
            backup_path = self.create_backup_if_enabled(target_file)
            with open(target_file, 'a', encoding='utf-8') as f:
                f.write('\n' + text)
            print(f"[DEBUG] Appended declaration:\n{text}")

            self.reload_data()
            return {'success': True, 'message': f'Created commodity declaration for {symbol}', 'backup_file': backup_path, 'target_file': target_file}
        except Exception as e:
            print(f"[ERROR] create_commodity_declaration failed: {e}")
            import traceback
            traceback.print_exc()
            return {'success': False, 'error': str(e)}

    def update_commodity_metadata(self, symbol: str, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """
        Update or create commodity declaration metadata.

        Args:
            symbol (str): The commodity symbol.
            metadata (Dict[str, Any]): The new metadata to apply.

        Returns:
            Dict[str, Any]: Result object with 'success' (bool) and details.
        """
        try:
            print(f"[DEBUG] update_commodity_metadata called for symbol={symbol} metadata={metadata}")
            if not isinstance(metadata, dict):
                print(f"[DEBUG] metadata is not a dict, got {type(metadata)}; setting to empty dict.")
                metadata = {}

            # Find existing commodity declaration
            commodity_entry = None
            for entry in self.entries:
                if isinstance(entry, data.Commodity) and entry.currency == symbol:
                    commodity_entry = entry
                    break

            if not commodity_entry:
                # No explicit commodity declaration; create one (append) using logic in create_commodity_declaration
                print(f"[DEBUG] No existing commodity declaration found for {symbol}, creating new declaration.")
                return self.create_commodity_declaration(symbol, metadata)

            # Use filename and lineno from entry meta when available
            entry_meta = getattr(commodity_entry, 'meta', {}) or {}
            lineno = entry_meta.get('lineno', None)
            target_file = entry_meta.get('filename') or self.beancount_file
            print(f"[DEBUG] Found commodity entry meta: filename={entry_meta.get('filename')} lineno={lineno}")

            # If lineno not present, fall back to appending to a reasonable file
            if lineno is None:
                print(f"[DEBUG] Linenumber not present in metadata for {symbol}; appending new declaration instead of editing in-place")
                return self.create_commodity_declaration(symbol, metadata)

            # Ensure lineno is always an int
            try:
                lineno = int(float(lineno))
            except Exception as conv_exc:
                print(f"[ERROR] Could not convert lineno to int: {lineno} ({conv_exc}) - appending new declaration instead.")
                return self.create_commodity_declaration(symbol, metadata)

            # Read the correct file where the declaration lives
            print(f"[DEBUG] Reading target file for in-place edit: {target_file}")
            with open(target_file, 'r', encoding='utf-8') as f:
                lines = f.read().split('\n')

            try:
                start = lineno - 1
                end = start
                # Find end of declaration (next non-indented line)
                while end + 1 < len(lines) and (lines[end + 1].startswith(' ') or lines[end + 1].startswith('\t')):
                    end += 1

                # Preserve original header date if present
                header_parts = lines[start].split(' commodity ')
                header_prefix = header_parts[0] if header_parts else lines[start].split(' commodity ')[0]

                decl_lines = [header_prefix + f" commodity {symbol}"]
                if metadata and isinstance(metadata, dict) and len(metadata) > 0:
                    for k, v in metadata.items():
                        if isinstance(v, str):
                            decl_lines.append(f"  {k}: \"{v}\"")
                        else:
                            decl_lines.append(f"  {k}: {v}")
                # If metadata is empty, only header line will be written

                print(f"[DEBUG] Replacing lines {start+1}-{end+1} in {target_file} with:\n" + '\n'.join(decl_lines))

                new_lines = lines[:start] + decl_lines + lines[end + 1:]
            except TypeError as te:
                import traceback as _tb
                print(f"[ERROR] TypeError while preparing file edit: {te}")
                print(f"[ERROR] lineno type={type(lineno)} value={repr(lineno)}")
                try:
                    print(f"[ERROR] start value attempt: {int(lineno)-1}")
                except Exception as e2:
                    print(f"[ERROR] Could not int(lineno): {e2}")
                print(f"[ERROR] lines length={len(lines)}")
                print('[ERROR] First 10 lines of target file:')
                for i, ln in enumerate(lines[:10]):
                    print(f"  {i+1}: ({type(ln)}) {ln}")
                _tb.print_exc()
                # Fallback: append a new declaration instead of editing in-place
                print('[DEBUG] Falling back to appending new commodity declaration due to TypeError')
                return self.create_commodity_declaration(symbol, metadata)
            except Exception as e:
                import traceback as _tb
                print(f"[ERROR] Unexpected error while preparing file edit: {e}")
                _tb.print_exc()
                print('[DEBUG] Falling back to appending new commodity declaration due to unexpected error')
                return self.create_commodity_declaration(symbol, metadata)

            # Backup and write to the file where the declaration was found
            backup_path = f"{target_file}.backup.{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            print(f"[DEBUG] Creating backup before write: {backup_path}")
            shutil.copy2(target_file, backup_path)
            with open(target_file, 'w', encoding='utf-8') as f:
                f.write('\n'.join(new_lines))

            self.reload_data()
            print(f"[DEBUG] Updated metadata for {symbol} written to {target_file}")
            return {'success': True, 'message': f'Updated metadata for {symbol}', 'backup_file': backup_path, 'target_file': target_file}

        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    def get_statistics(self) -> Dict[str, Any]:
        """
        Get comprehensive statistics about the ledger (focused on journal essentials).

        Returns:
            Dict[str, Any]: Dictionary containing counts of transactions, notes, etc.,
                            and date ranges.
        """
        stats = {
            'transaction_count': 0,
            'note_count': 0,
            'balance_count': 0,
            'pad_count': 0,
            'total_entries': 0,
            'date_range': {'start': None, 'end': None},
            'account_count': 0,
            'file_path': self.beancount_file,
            'last_loaded': datetime.now().isoformat()
        }
        
        for entry in self.entries:
            entry_type = self.get_entry_type(entry)
            
            # Only count essential entry types
            if entry_type in ['transaction', 'note', 'balance', 'pad']:
                stats[f'{entry_type}_count'] += 1
                stats['total_entries'] += 1
                
                # Update date range
                if stats['date_range']['start'] is None or entry.date < stats['date_range']['start']:
                    stats['date_range']['start'] = entry.date
                
                if stats['date_range']['end'] is None or entry.date > stats['date_range']['end']:
                    stats['date_range']['end'] = entry.date
        
        stats['account_count'] = len(self.get_accounts())
        
        # Convert dates to ISO format
        if stats['date_range']['start']:
            stats['date_range']['start'] = stats['date_range']['start'].isoformat()
        if stats['date_range']['end']:
            stats['date_range']['end'] = stats['date_range']['end'].isoformat()
        
        return stats

    def find_entry_by_id(self, entry_id: str) -> Optional[Any]:
        """
        Find an entry (Transaction, Note, Balance, Pad) by its ID.

        Args:
            entry_id (str): The hash ID of the entry.

        Returns:
            Optional[Any]: The entry object or None.
        """
        for entry in self.entries:
            # Check supported entry types
            if isinstance(entry, (data.Transaction, data.Note, data.Balance, data.Pad)):
                eid = self.generate_entry_id(entry)
                if eid == entry_id:
                    return entry
        return None

    def find_transaction_by_id(self, transaction_id: str) -> Optional[data.Transaction]:
        """
        Legacy method: Find a transaction by its ID.
        DEPRECATED: Use find_entry_by_id instead.
        """
        entry = self.find_entry_by_id(transaction_id)
        if isinstance(entry, data.Transaction):
            return entry
        return None

    def update_transaction_in_file(self, transaction_id: str, updated_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Update a transaction in the Beancount file.

        Args:
            transaction_id (str): The ID of the transaction to update.
            updated_data (Dict[str, Any]): The new transaction data (payee, narration, postings, etc.).

        Returns:
            Dict[str, Any]: Result object with 'success' (bool).
        """
        try:
            # Find the original transaction
            original_transaction = self.find_transaction_by_id(transaction_id)
            if not original_transaction:
                return {'success': False, 'error': 'Transaction not found'}

            # Create backup
            backup_path = self.create_backup_if_enabled()

            # Read the file content
            with open(self.beancount_file, 'r', encoding='utf-8') as f:
                content = f.read()

            # Find the transaction in the file by looking for its line number
            if hasattr(original_transaction, 'meta') and 'lineno' in original_transaction.meta:
                lineno = original_transaction.meta['lineno']
                lines = content.split('\n')
                
                # Generate new transaction text
                new_transaction_text = self.generate_transaction_text(updated_data)
                
                # Find the start and end of the transaction
                start_line = lineno - 1  # Convert to 0-based indexing
                end_line = start_line
                
                # Find the end of the transaction (next non-indented line or empty line)
                while end_line + 1 < len(lines):
                    next_line = lines[end_line + 1].strip()
                    if next_line == '' or not lines[end_line + 1].startswith((' ', '\t')):
                        break
                    end_line += 1
                
                # Replace the transaction
                lines[start_line:end_line + 1] = new_transaction_text.split('\n')
                
                # Write back to file
                with open(self.beancount_file, 'w', encoding='utf-8') as f:
                    f.write('\n'.join(lines))
                
                # Reload the data
                self.reload_data()
                
                return {
                    'success': True, 
                    'message': 'Transaction updated successfully',
                    'backup_file': backup_path
                }
            else:
                return {'success': False, 'error': 'Could not locate transaction in file'}

        except Exception as e:
            return {'success': False, 'error': f'Failed to update transaction: {str(e)}'}

    def update_balance_in_file(self, balance_id: str, updated_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Update a balance assertion in the Beancount file.

        Args:
            balance_id (str): The ID of the balance entry to update.
            updated_data (Dict[str, Any]): The new balance data (date, account, amount, currency).

        Returns:
            Dict[str, Any]: Result object with 'success' (bool).
        """
        try:
            # Find the original balance entry
            original_entry = self.find_entry_by_id(balance_id)
            if not original_entry or not isinstance(original_entry, data.Balance):
                return {'success': False, 'error': 'Balance entry not found'}

            # Create backup
            backup_path = self.create_backup_if_enabled()

            # Read the file content
            with open(self.beancount_file, 'r', encoding='utf-8') as f:
                content = f.read()

            # Find the entry in the file by looking for its line number
            if hasattr(original_entry, 'meta') and 'lineno' in original_entry.meta:
                lineno = original_entry.meta['lineno']
                lines = content.split('\n')
                
                # Generate new balance text
                new_balance_text = self.generate_balance_text(updated_data)
                
                # Find the start and end of the balance entry
                start_line = lineno - 1  # Convert to 0-based indexing
                end_line = start_line
                
                # Balance assertions are typically single-line, but check for continuations
                while end_line + 1 < len(lines):
                    next_line = lines[end_line + 1].strip()
                    if next_line == '' or not lines[end_line + 1].startswith((' ', '\t')):
                        break
                    end_line += 1
                
                # Replace the balance entry
                lines[start_line:end_line + 1] = [new_balance_text]
                
                # Write back to file
                with open(self.beancount_file, 'w', encoding='utf-8') as f:
                    f.write('\n'.join(lines))
                
                # Reload the data
                self.reload_data()
                
                return {
                    'success': True, 
                    'message': 'Balance entry updated successfully',
                    'backup_file': backup_path
                }
            else:
                return {'success': False, 'error': 'Could not locate balance entry in file'}

        except Exception as e:
            return {'success': False, 'error': f'Failed to update balance entry: {str(e)}'}

    def update_note_in_file(self, note_id: str, updated_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Update a note in the Beancount file.

        Args:
            note_id (str): The ID of the note to update.
            updated_data (Dict[str, Any]): The new note data (date, account, comment).

        Returns:
            Dict[str, Any]: Result object with 'success' (bool).
        """
        try:
            # Find the original note entry
            original_entry = self.find_entry_by_id(note_id)
            if not original_entry or not isinstance(original_entry, data.Note):
                return {'success': False, 'error': 'Note entry not found'}

            # Create backup
            backup_path = self.create_backup_if_enabled()

            # Read the file content
            with open(self.beancount_file, 'r', encoding='utf-8') as f:
                content = f.read()

            # Find the entry in the file by looking for its line number
            if hasattr(original_entry, 'meta') and 'lineno' in original_entry.meta:
                lineno = original_entry.meta['lineno']
                lines = content.split('\n')
                
                # Generate new note text
                new_note_text = self.generate_note_text(updated_data)
                
                # Find the start and end of the note entry
                start_line = lineno - 1  # Convert to 0-based indexing
                end_line = start_line
                
                # Notes are typically single-line, but check for continuations
                while end_line + 1 < len(lines):
                    next_line = lines[end_line + 1].strip()
                    if next_line == '' or not lines[end_line + 1].startswith((' ', '\t')):
                        break
                    end_line += 1
                
                # Replace the note entry
                lines[start_line:end_line + 1] = [new_note_text]
                
                # Write back to file
                with open(self.beancount_file, 'w', encoding='utf-8') as f:
                    f.write('\n'.join(lines))
                
                # Reload the data
                self.reload_data()
                
                return {
                    'success': True, 
                    'message': 'Note entry updated successfully',
                    'backup_file': backup_path
                }
            else:
                return {'success': False, 'error': 'Could not locate note entry in file'}

        except Exception as e:
            return {'success': False, 'error': f'Failed to update note entry: {str(e)}'}

    def update_entry_in_file(self, entry_id: str, updated_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Update any entry (transaction, balance, or note) in the Beancount file.
        Routes to the appropriate specific update method based on entry type.

        Args:
            entry_id (str): The ID of the entry to update.
            updated_data (Dict[str, Any]): The new entry data.

        Returns:
            Dict[str, Any]: Result object with 'success' (bool).
        """
        entry_type = updated_data.get('type', 'transaction')
        
        if entry_type == 'transaction':
            return self.update_transaction_in_file(entry_id, updated_data)
        elif entry_type == 'balance':
            return self.update_balance_in_file(entry_id, updated_data)
        elif entry_type == 'note':
            return self.update_note_in_file(entry_id, updated_data)
        else:
            return {'success': False, 'error': f'Unsupported entry type: {entry_type}'}

    def delete_entry_from_file(self, entry_id: str) -> Dict[str, Any]:
        """
        Delete an entry (Transaction, Note, Balance, Pad) from the Beancount file.

        Args:
            entry_id (str): The ID of the entry to delete.

        Returns:
            Dict[str, Any]: Result object with 'success' (bool).
        """
        try:
            # Find the original entry
            original_entry = self.find_entry_by_id(entry_id)
            if not original_entry:
                return {'success': False, 'error': 'Entry not found'}

            # Create backup
            backup_path = self.create_backup_if_enabled()

            # Read the file content
            with open(self.beancount_file, 'r', encoding='utf-8') as f:
                content = f.read()

            # Find the entry in the file by looking for its line number
            if hasattr(original_entry, 'meta') and 'lineno' in original_entry.meta:
                lineno = original_entry.meta['lineno']
                lines = content.split('\n')
                
                # Find the start and end of the entry
                start_line = lineno - 1  # Convert to 0-based indexing
                end_line = start_line
                
                # Find the end of the entry (next non-indented line or empty line)
                while end_line + 1 < len(lines):
                    next_line = lines[end_line + 1].strip()
                    if next_line == '' or not lines[end_line + 1].startswith((' ', '\t')):
                        break
                    end_line += 1
                
                # Remove the entry lines
                del lines[start_line:end_line + 1]
                
                # Write back to file
                with open(self.beancount_file, 'w', encoding='utf-8') as f:
                    f.write('\n'.join(lines))
                
                # Reload the data
                self.reload_data()
                
                return {
                    'success': True, 
                    'message': 'Entry deleted successfully',
                    'backup_file': backup_path
                }
            else:
                return {'success': False, 'error': 'Could not locate entry in file'}

        except Exception as e:
            return {'success': False, 'error': f'Failed to delete entry: {str(e)}'}

    def delete_transaction_from_file(self, transaction_id: str) -> Dict[str, Any]:
        """
        Legacy method: redirects to delete_entry_from_file.
        """
        return self.delete_entry_from_file(transaction_id)

    def generate_transaction_text(self, transaction_data: Dict[str, Any]) -> str:
        """
        Generate Beancount transaction text from transaction data.

        Args:
            transaction_data (Dict[str, Any]): The transaction data dictionary.

        Returns:
            str: Formatted Beancount string.
        """
        date_str = transaction_data['date']
        flag = transaction_data.get('flag', '*')
        payee = transaction_data.get('payee', '')
        narration = transaction_data.get('narration', '')
        tags = transaction_data.get('tags', [])
        links = transaction_data.get('links', [])
        
        # Format payee and narration
        if payee and narration:
            payee_narration = f'"{payee}" "{narration}"'
        elif payee:
            payee_narration = f'"{payee}" ""'
        elif narration:
            payee_narration = f'"{narration}"'
        else:
            payee_narration = '""'
        
        # Build the transaction header with tags and links
        header_parts = [date_str, flag, payee_narration]
        
        # Add tags (with # prefix, strip any existing # to avoid double prefixes)
        if tags:
            for tag in tags:
                # Strip any existing # prefix to avoid duplication
                clean_tag = tag.lstrip('#')
                if clean_tag:  # Only add non-empty tags
                    header_parts.append(f"#{clean_tag}")
        
        # Add links (with ^ prefix)
        if links:
            for link in links:
                header_parts.append(f"^{link}")
        
        # Start with the transaction line
        lines = [" ".join(header_parts)]
        
        # Add transaction-level metadata if present
        txn_metadata = transaction_data.get('metadata', {})
        if txn_metadata:
            for key, value in txn_metadata.items():
                lines.append(f"  {key}: \"{value}\"")
        
        # Add postings
        for posting in transaction_data.get('postings', []):
            account = posting['account']
            amount = posting.get('amount')
            currency = posting.get('currency')
            cost = posting.get('cost')
            price = posting.get('price')
            posting_flag = posting.get('flag')
            posting_comment = posting.get('comment')
            posting_metadata = posting.get('metadata', {})
            
            # Start posting line with optional flag
            posting_line = f"  "
            if posting_flag:
                posting_line += f"{posting_flag} "
            posting_line += account
            
            if amount and currency:
                posting_line += f"  {amount} {currency}"
                
                # Add cost if present (e.g., {100.00 USD} or {100.00 USD, 2024-01-15} or {100.00 USD, "label"})
                if cost:
                    cost_number = cost.get('number')
                    cost_currency = cost.get('currency')
                    cost_date = cost.get('date')
                    cost_label = cost.get('label')
                    is_total_cost = cost.get('isTotal', False)
                    
                    if cost_number and cost_currency:
                        # Use {{}} for total cost, {} for per-unit cost
                        open_brace = '{{' if is_total_cost else '{'
                        close_brace = '}}' if is_total_cost else '}'
                        
                        posting_line += f" {open_brace}{cost_number} {cost_currency}"
                        
                        # Add cost date if present
                        if cost_date:
                            posting_line += f", {cost_date}"
                        
                        # Add cost label if present
                        if cost_label:
                            posting_line += f', "{cost_label}"'
                        
                        posting_line += close_brace
                    elif cost_date:
                        # Cost with only date (for lot matching) {2014-02-11}
                        posting_line += f" {{{cost_date}}}"
                    elif cost_label:
                        # Cost with only label (for lot matching) {"ref-001"}
                        posting_line += f' {{"{cost_label}"}}'
                
                # Add price if present (e.g., @ 100.00 USD or @@ 1000.00 USD)
                if price and price.get('amount') and price.get('currency'):
                    price_amount = price.get('amount')
                    price_currency = price.get('currency')
                    is_total_price = price.get('isTotal', False)
                    
                    # Use @@ for total price, @ for per-unit price
                    price_symbol = '@@' if is_total_price else '@'
                    posting_line += f" {price_symbol} {price_amount} {price_currency}"
            
            # Add inline comment if present
            if posting_comment:
                posting_line += f"  ; {posting_comment}"
            
            lines.append(posting_line)
            
            # Add posting-level metadata if present (indented 4 spaces total)
            # Beancount posting metadata: 2 spaces for posting + 2 more for metadata
            if posting_metadata:
                for key, value in posting_metadata.items():
                    lines.append(f"    {key}: \"{value}\"")
        
        return '\n'.join(lines)

    def add_entry_to_file(self, entry_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Add a new entry (transaction, balance, or note) to the Beancount file.

        Args:
            entry_data (Dict[str, Any]): Dictionary containing entry type and data.

        Returns:
            Dict[str, Any]: Result object with 'success' (bool).
        """
        try:
            # Create backup
            backup_path = self.create_backup_if_enabled()

            # Generate entry text based on type
            entry_type = entry_data.get('type', 'transaction')
            if entry_type == 'transaction':
                entry_text = self.generate_transaction_text(entry_data)
            elif entry_type == 'balance':
                entry_text = self.generate_balance_text(entry_data)
            elif entry_type == 'note':
                entry_text = self.generate_note_text(entry_data)
            elif entry_type == 'open':
                entry_text = self.generate_open_text(entry_data)
            elif entry_type == 'close':
                entry_text = self.generate_close_text(entry_data)
            else:
                raise ValueError(f"Unsupported entry type: {entry_type}")
            
            # Append to file with proper newlines
            with open(self.beancount_file, 'a', encoding='utf-8') as f:
                f.write('\n' + entry_text + '\n')
            
            # Reload the data
            self.reload_data()
            
            return {
                'success': True, 
                'message': f'{entry_type.capitalize()} added successfully',
                'backup_file': backup_path
            }

        except Exception as e:
            return {'success': False, 'error': f'Failed to add {entry_data.get("type", "entry")}: {str(e)}'}

    def generate_balance_text(self, balance_data: Dict[str, Any]) -> str:
        """
        Generate balance assertion text for Beancount file.

        Args:
            balance_data (Dict[str, Any]): Balance data including date, account, amount, etc.

        Returns:
            str: Formatted Beancount balance string.
        """
        date_str = balance_data['date']
        account = balance_data['account']
        amount = balance_data['amount']
        currency = balance_data['currency']
        tolerance = balance_data.get('tolerance')
        
        if tolerance:
            return f"{date_str} balance {account} {amount} {currency} ~ {tolerance} {currency}"
        else:
            return f"{date_str} balance {account} {amount} {currency}"

    def generate_note_text(self, note_data: Dict[str, Any]) -> str:
        """
        Generate note directive text for Beancount file.

        Args:
            note_data (Dict[str, Any]): Note data including date, account, and comment.

        Returns:
            str: Formatted Beancount note string.
        """
        date_str = note_data['date']
        account = note_data['account']
        comment = note_data['comment']
        
        return f'{date_str} note {account} "{comment}"'

    def generate_open_text(self, open_data: Dict[str, Any]) -> str:
        """
        Generate open directive text for Beancount file.

        Args:
            open_data (Dict[str, Any]): Open data including date, account, and optionally currencies and booking method.

        Returns:
            str: Formatted Beancount open string.
        """
        date_str = open_data['date']
        account = open_data['account']
        currencies = open_data.get('currencies', [])
        booking = open_data.get('booking')
        
        # Build the open directive
        parts = [date_str, 'open', account]
        
        # Add currencies if specified
        if currencies and len(currencies) > 0:
            parts.append(','.join(currencies))
        
        # Add booking method if specified
        if booking:
            parts.append(f'"{booking}"')
        
        return ' '.join(parts)

    def generate_close_text(self, close_data: Dict[str, Any]) -> str:
        """
        Generate close directive text for Beancount file.

        Args:
            close_data (Dict[str, Any]): Close data including date and account.

        Returns:
            str: Formatted Beancount close string.
        """
        date_str = close_data['date']
        account = close_data['account']
        
        return f"{date_str} close {account}"

    def add_transaction_to_file(self, transaction_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Legacy method - redirects to add_entry_to_file.

        Args:
            transaction_data (Dict[str, Any]): Transaction data.

        Returns:
            Dict[str, Any]: Result from add_entry_to_file.
        """
        transaction_data['type'] = 'transaction'
        return self.add_entry_to_file(transaction_data)

# Flask App Setup
def create_app(beancount_file: str, create_backups: bool = True, max_backup_files: int = 10) -> Flask:
    """
    Create and configure the Flask app.

    Args:
        beancount_file (str): Path to the Beancount file.
        create_backups (bool): Whether to create backup files before modifications.
        max_backup_files (int): Maximum number of backup files to keep (0 = unlimited).

    Returns:
        Flask: The configured Flask application instance.
    """
    app = Flask(__name__)
    CORS(app)  # Enable CORS for all routes
    
    # Initialize the API with backup settings
    api = BeancountJournalAPI(beancount_file, create_backups, max_backup_files)
    
    @app.route('/health', methods=['GET'])
    def health():
        """Health check endpoint"""
        return jsonify({'status': 'ok', 'timestamp': datetime.now().isoformat()})
    
    @app.route('/reload', methods=['POST'])
    def reload():
        """Reload the Beancount file"""
        try:
            api.reload_data()
            return jsonify({'status': 'success', 'message': 'Data reloaded successfully'})
        except Exception as e:
            return jsonify({'status': 'error', 'message': str(e)}), 500
    
    @app.route('/transactions', methods=['GET'])
    def get_transactions():
        """Get transactions with optional filtering (legacy endpoint)"""
        try:
            # Get query parameters
            start_date = request.args.get('start_date')
            end_date = request.args.get('end_date')
            account_filter = request.args.get('account')
            payee_filter = request.args.get('payee')
            tag_filter = request.args.get('tag')
            search_term = request.args.get('search')
            limit = int(request.args.get('limit', 100))
            offset = int(request.args.get('offset', 0))
            
            result = api.get_transactions(
                start_date=start_date,
                end_date=end_date,
                account_filter=account_filter,
                payee_filter=payee_filter,
                tag_filter=tag_filter,
                search_term=search_term,
                limit=limit,
                offset=offset
            )
            
            return jsonify(result)
        
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    @app.route('/transactions', methods=['POST'])
    def create_entry():
        """Create a new entry (transaction, balance, or note)"""
        try:
            if not request.json:
                return jsonify({'error': 'No JSON data provided'}), 400
            
            # Validate required fields based on entry type
            entry_type = request.json.get('type', 'transaction')
            
            if entry_type == 'transaction':
                required_fields = ['date', 'narration', 'postings']
                for field in required_fields:
                    if field not in request.json:
                        return jsonify({'error': f'Missing required field: {field}'}), 400
                
                # Validate postings
                postings = request.json['postings']
                if not isinstance(postings, list) or len(postings) < 2:
                    return jsonify({'error': 'At least 2 postings are required'}), 400
                
                for i, posting in enumerate(postings):
                    if 'account' not in posting:
                        return jsonify({'error': f'Posting {i + 1} missing account'}), 400
                        
            elif entry_type == 'balance':
                required_fields = ['date', 'account', 'amount', 'currency']
                for field in required_fields:
                    if field not in request.json:
                        return jsonify({'error': f'Missing required field: {field}'}), 400
                        
            elif entry_type == 'note':
                required_fields = ['date', 'account', 'comment']
                for field in required_fields:
                    if field not in request.json:
                        return jsonify({'error': f'Missing required field: {field}'}), 400
            else:
                return jsonify({'error': f'Unsupported entry type: {entry_type}'}), 400
            
            result = api.add_entry_to_file(request.json)
            
            if result['success']:
                return jsonify(result), 201
            else:
                return jsonify(result), 400
                
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    @app.route('/entries', methods=['GET'])
    def get_entries():
        """Get all entries (transactions and other directives) with optional filtering"""
        try:
            # Get query parameters
            start_date = request.args.get('start_date')
            end_date = request.args.get('end_date')
            account_filter = request.args.get('account')
            payee_filter = request.args.get('payee')
            tag_filter = request.args.get('tag')
            search_term = request.args.get('search')
            limit = int(request.args.get('limit', 100))
            offset = int(request.args.get('offset', 0))
            
            # Parse entry types filter
            entry_types_param = request.args.get('types')
            entry_types = None
            if entry_types_param:
                entry_types = [t.strip() for t in entry_types_param.split(',')]
            
            print(f"[DEBUG] get_entries called with entry_types: {entry_types}")
            
            result = api.get_entries(
                start_date=start_date,
                end_date=end_date,
                account_filter=account_filter,
                payee_filter=payee_filter,
                tag_filter=tag_filter,
                search_term=search_term,
                entry_types=entry_types,
                limit=limit,
                offset=offset
            )
            
            print(f"[DEBUG] get_entries returning {len(result.get('entries', []))} entries")
            return jsonify(result)
        
        except Exception as e:
            print(f"[ERROR] get_entries failed: {e}")
            import traceback
            traceback.print_exc()
            return jsonify({'error': str(e)}), 500
    


    @app.route('/transactions/<transaction_id>', methods=['PUT'])
    def update_transaction(transaction_id: str):
        """Update a transaction, balance, or note entry"""
        try:
            if not request.json:
                return jsonify({'error': 'No JSON data provided'}), 400
            
            entry_type = request.json.get('type', 'transaction')
            
            # Validate required fields based on entry type
            if entry_type == 'transaction':
                # For transactions: date and postings are required
                # narration is optional (can be empty string)
                required_fields = ['date', 'postings']
                for field in required_fields:
                    if field not in request.json:
                        return jsonify({'error': f'Missing required field: {field}'}), 400
                
                # Validate postings
                postings = request.json['postings']
                if not isinstance(postings, list) or len(postings) < 2:
                    return jsonify({'error': 'At least 2 postings are required'}), 400
                
                for i, posting in enumerate(postings):
                    if 'account' not in posting:
                        return jsonify({'error': f'Posting {i + 1} missing account'}), 400
            
            elif entry_type == 'balance':
                # For balance assertions: date, account, amount, and currency are required
                required_fields = ['date', 'account', 'amount', 'currency']
                for field in required_fields:
                    if field not in request.json:
                        return jsonify({'error': f'Missing required field: {field}'}), 400
            
            elif entry_type == 'note':
                # For notes: date, account, and comment are required
                required_fields = ['date', 'account', 'comment']
                for field in required_fields:
                    if field not in request.json:
                        return jsonify({'error': f'Missing required field: {field}'}), 400
            
            else:
                return jsonify({'error': f'Unsupported entry type: {entry_type}'}), 400
            
            # Use the new unified update method
            result = api.update_entry_in_file(transaction_id, request.json)
            
            if result['success']:
                return jsonify(result), 200
            else:
                return jsonify(result), 400
                
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @app.route('/transactions/<transaction_id>', methods=['DELETE'])
    def delete_transaction(transaction_id: str):
        """Delete a transaction"""
        try:
            result = api.delete_transaction_from_file(transaction_id)
            
            if result['success']:
                return jsonify(result), 200
            else:
                return jsonify(result), 400
                
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @app.route('/transactions/<transaction_id>', methods=['GET'])
    def get_transaction_by_id(transaction_id: str):
        """Get a specific transaction by ID"""
        try:
            transaction = api.find_transaction_by_id(transaction_id)
            if transaction:
                transaction_dict = api.entry_to_dict(transaction)
                return jsonify(transaction_dict)
            else:
                return jsonify({'error': 'Transaction not found'}), 404
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    return app

def main():
    """
    Main entry point.

    Parses command line arguments and starts the Flask server.
    """
    parser = argparse.ArgumentParser(description='Beancount Journal API Server')
    parser.add_argument('beancount_file', help='Path to the Beancount file')
    parser.add_argument('--port', type=int, default=5001, help='Port to run the server on')
    parser.add_argument('--host', default='localhost', help='Host to bind the server to')
    parser.add_argument('--debug', action='store_true', help='Run in debug mode')
    parser.add_argument('--validate-only', action='store_true', help='Only validate the setup and exit (for testing)')
    parser.add_argument('--no-backup', action='store_true', help='Disable automatic backup file creation')
    parser.add_argument('--max-backups', type=int, default=10, help='Maximum number of backup files to keep (0 = unlimited)')
    
    args = parser.parse_args()
    
    if not os.path.exists(args.beancount_file):
        print(f"Error: Beancount file '{args.beancount_file}' not found")
        sys.exit(1)
    
    # If validate-only mode, just test the setup and exit
    if args.validate_only:
        try:
            print(f"Validating Beancount Journal API setup...")
            print(f"[OK] Beancount file found: {args.beancount_file}")
            
            # Test loading the Beancount data
            api = BeancountJournalAPI(args.beancount_file)
            entries_count = len(api.entries) if api.entries else 0
            errors_count = len(api.errors) if api.errors else 0
            
            print(f"[OK] Beancount data loaded successfully")
            print(f"[OK] Found {entries_count} entries")
            if errors_count > 0:
                print(f"[WARN] {errors_count} parsing errors found")
            else:
                print(f"[OK] No parsing errors")
            
            # Test Flask app creation
            app = create_app(args.beancount_file, not args.no_backup, args.max_backups)
            print(f"[OK] Flask application created successfully")
            print(f"[OK] Server would run on: http://{args.host}:{args.port}")
            print("[OK] Backend validation completed successfully!")
            sys.exit(0)
            
        except Exception as e:
            print(f"[ERROR] Backend validation failed: {e}")
            sys.exit(1)
    
    print(f"Starting Beancount Journal API server...")
    print(f"Beancount file: {args.beancount_file}")
    print(f"Server: http://{args.host}:{args.port}")
    print(f"Backups: {'disabled' if args.no_backup else f'enabled (max {args.max_backups} files)'}")
    
    app = create_app(args.beancount_file, not args.no_backup, args.max_backups)
    app.run(host=args.host, port=args.port, debug=args.debug)

if __name__ == '__main__':
    main()
