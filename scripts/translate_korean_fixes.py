#!/usr/bin/env python3
"""Fix review issues: awkward messages, double periods, bad concatenations."""
import os
import re
import subprocess

PROJECT_ROOT = "/home/runner/work/Beyond/Beyond"

FIXES = [
    # API error messages (wrong word order)
    ('"External Failed to load data"', '"Failed to load external data"'),
    ('"Weekly Analysis Failed to load data"', '"Failed to load weekly analytics data"'),
    ('"segments Analytics Failed to load data"', '"Failed to load segment analytics data"'),
    ('"Analytics Failed to load data"', '"Failed to load analytics data"'),
    ('"monthly Analytics Failed to load data"', '"Failed to load monthly analytics data"'),
    ('"daily Analytics Failed to load data"', '"Failed to load daily analytics data"'),
    # Validation messages
    ('"Product Please enter your name"', '"Please enter a product name"'),
    ('"Options Please enter a group name"', '"Please enter an option group name"'),
    ('"Current Please enter your password"', '"Please enter your current password"'),
    ('"Products Edit failed"', '"Failed to edit product"'),
    ('"Products Delete failed"', '"Failed to delete product"'),
    ('"Options Edit failed"', '"Failed to edit option"'),
    ('"Options Delete failed"', '"Failed to delete option"'),
    ('"Inventory Info Save failed"', '"Failed to save inventory info"'),
    ('"Modifier Edit failed"', '"Failed to edit modifier"'),
    # Status labels
    ('ORDER_CREATED: "OrdersCreate"', 'ORDER_CREATED: "Order Created"'),
    # Concatenated no-results messages
    ('"No results matching your filters No subscriptions yet"',
     '"No subscriptions match your filters"'),
    # Table headers
    ('"SubscriptionsAvailable"', '"Subscription Available"'),
    ('<th className="text-center px-4 py-3 font-medium text-gray-600">SubscriptionsAvailable</th>',
     '<th className="text-center px-4 py-3 font-medium text-gray-600">Subscription Available</th>'),
    # Page headings
    ('"Products Edit"', '"Edit Product"'),
    ('<h1 className="text-2xl font-bold text-gray-900">Products Edit</h1>',
     '<h1 className="text-2xl font-bold text-gray-900">Edit Product</h1>'),
    # Back to list repeated
    ('"Back to List Back"', '"Back to List"'),
    ('Back to List Back', 'Back to List'),
    # InventoryYes
    ('"InventoryYes"', '"In Stock"'),
    ('InventoryYes', 'In Stock'),
    # Options Add saveLabel
    ('saveLabel="Options Add"', 'saveLabel="Add Option"'),
    # Daily capitalization
    ('"daily Inventory Management"', '"Daily Inventory Management"'),
    ('<span className="text-gray-700 font-medium">daily Inventory Management</span>',
     '<span className="text-gray-700 font-medium">Daily Inventory Management</span>'),
    ('<h1 className="text-2xl font-bold text-gray-900">daily Inventory Management</h1>',
     '<h1 className="text-2xl font-bold text-gray-900">Daily Inventory Management</h1>'),
    # OccurrencesAdminActions button text
    ('"Orders Create"', '"Create Order"'),
    ('{isPending ? "Processing..." : "Orders Create"}',
     '{isPending ? "Processing..." : "Create Order"}'),
    # Double periods
    ('List of modifier groups linked to this product..{" "}',
     'List of modifier groups linked to this product.{" "}'),
    ('to create or edit groups and options..',
     'to create or edit groups and options.'),
    ('Create a new group there..',
     'Create a new group there.'),
    ('Bagel types (Bagel Type) are managed by modifier, not variant..',
     'Bagel types (Bagel Type) are managed by modifier, not variant.'),
    ('All options must be mapped before sending orders..',
     'All options must be mapped before sending orders.'),
    ('Syncs categories → modifier groups/options → products → links all at once..',
     'Syncs categories → modifier groups/options → products → links all at once.'),
    ('⚠ Never commit actual tokens to source code or a repository..',
     '⚠ Never commit actual tokens to source code or a repository.'),
    # Double periods in InventoryManager
    ('Changing the date will automatically load inventory for that date..',
     'Changing the date will automatically load inventory for that date.'),
    # Double periods in ModifierMappingManager
    ('After successful Loyverse sync, close this mode and select from the dropdown..',
     'After successful Loyverse sync, close this mode and select from the dropdown.'),
    ('After successful Loyverse sync, close this mode and select from the dropdown.\n',
     'After successful Loyverse sync, close this mode and select from the dropdown.\n'),
    # Double periods in pages
    ('No data for this period..', 'No data for this period.'),
    ('No data for this segment..', 'No data for this segment.'),
    # Monthly analytics missing space
    ('({months.length}months)', '({months.length} months)'),
    # Redundant "link, or" (double link text)
    ('link an existing group, link, or{" "}',
     'link an existing group, or{" "}'),
    # Modifier page double periods
    ('No data for this period..', 'No data for this period.'),
    # Loyverse page extra space
    ('Active  <', 'Active <'),
    # modifiers page double periods
    ('Bagel types are managed by modifier, not variant..',
     'Bagel types are managed by modifier, not variant.'),
    # Connecting/Removing with too many dots
    ('"Connecting......"', '"Connecting..."'),
    ('"Removing......"', '"Removing..."'),
]


def process_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except (UnicodeDecodeError, IOError):
        return False

    original = content
    for old, new in FIXES:
        content = content.replace(old, new)

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False


def main():
    result = subprocess.run(
        ["find", PROJECT_ROOT, "-type", "f", "(", "-name", "*.ts", "-o", "-name", "*.tsx", ")"],
        capture_output=True, text=True
    )
    all_files = [f for f in result.stdout.strip().split('\n')
                 if f and 'node_modules' not in f and '.next' not in f and 'scripts/' not in f]

    changed = 0
    for filepath in all_files:
        if process_file(filepath):
            rel = filepath.replace(PROJECT_ROOT + '/', '')
            print(f"  FIXED: {rel}")
            changed += 1

    print(f"\nTotal fixed: {changed} files")


if __name__ == "__main__":
    main()
