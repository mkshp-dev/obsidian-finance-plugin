import importlib.util
import json
import traceback

try:
    spec = importlib.util.spec_from_file_location("journal_api", r"src/backend/journal_api.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    BeancountJournalAPI = mod.BeancountJournalAPI

    print("[DEBUG] Instantiating BeancountJournalAPI...")
    api = BeancountJournalAPI(r"C:\Users\Asus\Documents\Vaults\plugin_maker\ledger.beancount")
    print("[DEBUG] Loaded Beancount data. Entries count:", len(api.entries) if api.entries else 0)

    result = api.update_commodity_metadata("BTC", {
        "logo": "https://example.com/logo.png",
        "price": "source: yahoo"
    })

    print(json.dumps(result, indent=2))
except Exception as e:
    print("[ERROR] Exception while running update:")
    traceback.print_exc()
    print(json.dumps({"success": False, "error": str(e)}))
