import importlib.util
import json
import traceback

try:
    spec = importlib.util.spec_from_file_location("journal_api", r"src/backend/journal_api.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    BeancountJournalAPI = mod.BeancountJournalAPI

    api = BeancountJournalAPI(r"C:\Users\Asus\Documents\Vaults\plugin_maker\ledger.beancount")

    logo_res = api.validate_logo_url('https://example.com/logo.png')
    price_res = api.validate_price_source('source: yahoo')

    print('LOGO VALIDATION:')
    print(json.dumps(logo_res, indent=2))
    print('\nPRICE VALIDATION:')
    print(json.dumps(price_res, indent=2))

except Exception as e:
    print('[ERROR]')
    traceback.print_exc()
