import difflib
import sys

a_path = r"C:\Users\Asus\Documents\Vaults\plugin_maker\dependencies\commodities.beancount.backup.20251117_043940"
b_path = r"C:\Users\Asus\Documents\Vaults\plugin_maker\dependencies\commodities.beancount"

try:
    with open(a_path, 'r', encoding='utf-8') as f:
        a = f.readlines()
    with open(b_path, 'r', encoding='utf-8') as f:
        b = f.readlines()

    diff = list(difflib.unified_diff(a, b, fromfile=a_path, tofile=b_path, lineterm=''))
    if not diff:
        print('[OK] No differences found between backup and target file')
    else:
        for line in diff:
            print(line)
except Exception as e:
    print('[ERROR]', e)
    sys.exit(1)
