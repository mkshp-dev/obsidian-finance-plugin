import importlib.util
import json
import traceback

try:
    spec = importlib.util.spec_from_file_location("journal_api", r"src/backend/journal_api.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    BeancountJournalAPI = mod.BeancountJournalAPI

    api = BeancountJournalAPI(r"C:\Users\Asus\Documents\Vaults\plugin_maker\ledger.beancount")

    details = api.get_commodity_details('BTC')
    print('COMMODITY DETAILS (api.get_commodity_details):')
    print(json.dumps(details, indent=2))

    # Find the actual Commodity entry object to show date and meta
    commodity_entry = None
    for entry in api.entries:
        from beancount.core import data
        if isinstance(entry, data.Commodity) and entry.currency == 'BTC':
            commodity_entry = entry
            break

    if commodity_entry:
        print('\nCOMMODITY ENTRY INFO:')
        entry_info = {
            'date': commodity_entry.date.isoformat() if hasattr(commodity_entry, 'date') else None,
            'currency': commodity_entry.currency,
            'meta': dict(commodity_entry.meta) if getattr(commodity_entry, 'meta', None) else {}
        }
        print(json.dumps(entry_info, indent=2))

        # Reconstruct declaration text
        decl_lines = [f"{entry_info['date']} commodity {entry_info['currency']}"]
        for k, v in entry_info['meta'].items():
            if isinstance(v, str):
                decl_lines.append(f"  {k}: \"{v}\"")
            else:
                decl_lines.append(f"  {k}: {v}")
        print('\nRECONSTRUCTED DECLARATION:')
        print('\n'.join(decl_lines))
    else:
        print('\nNo Commodity entry object found for BTC')

except Exception as e:
    print('[ERROR]')
    traceback.print_exc()