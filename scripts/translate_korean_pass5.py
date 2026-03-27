#!/usr/bin/env python3
"""Fifth pass: fix all remaining Korean."""

import os
import re
import subprocess

PROJECT_ROOT = "/home/runner/work/Beyond/Beyond"

FIXES = [
    # Loyverse integration labels
    ('"Sync된 Categories 수"', '"Synced Categories"'),
    ('"연동 Products 수"', '"Linked Products"'),
    ('"연동된 Products 수"', '"Linked Products"'),
    ('<dt className="text-gray-500">Sync된 Categories 수</dt>',
     '<dt className="text-gray-500">Synced Categories</dt>'),
    ('<dt className="text-gray-500">연동 Products 수</dt>',
     '<dt className="text-gray-500">Linked Products</dt>'),
    ('<dt className="text-gray-500">연동된 Products 수</dt>',
     '<dt className="text-gray-500">Linked Products</dt>'),
    # CSV placeholder
    ("평일 보통", "normal weekday"),
    ("Sat 많음", "Sat busy"),
    # Mock mode
    ('{mockMode && " (현재 Mock Data 사용)"}', '{mockMode && " (Mock Data in use)"}'),
    # Sync fetched counts  
    ("가져옴 {result.fetched} · 신규 {result.created} · Updated {result.updated}",
     "Fetched {result.fetched} · New {result.created} · Updated {result.updated}"),
    # Group count
    ("그룹 <strong>{syncMeta.groupCount}</strong>",
     "Groups <strong>{syncMeta.groupCount}</strong>"),
    # Loyverse API token message
    ("실제 연동을 위해 <code className=\"font-mono text-xs\">LOYVERSE_API_TOKEN</code> environment variable를 Settings하세요.",
     "Set the <code className=\"font-mono text-xs\">LOYVERSE_API_TOKEN</code> environment variable for live integration."),
    # Link group button text
    ("위의 <strong className=\"text-amber-600\">+ Link Group</strong> 버튼으로 기존 그룹을",
     "Use the <strong className=\"text-amber-600\">+ Link Group</strong> button above to link an existing group,"),
    # Prediction date no record
    ("이 Date({formatDate(prediction.targetDate)})의 실제 Sales Records이 없습니다.",
     "No actual sales records for this date ({formatDate(prediction.targetDate)})."),
    # Internal job secret
    ('"INTERNAL_JOB_SECRET environment variable가 Settings되지 않았습니다. " +',
     '"INTERNAL_JOB_SECRET environment variable is not configured. " +'),
    ('"보안을 위해 엔드포인트를 사용하기 전에 반드시 Settings하세요.",',
     '"Please configure it before using this endpoint for security.",'),
    # Analytics comment
    ("* vs. All: 해당 Period Daily Avg. Sales 대비 각 Day Avg. Sales의 증감률",
     "* vs. All: change rate of each day's avg. sales vs. the period's daily avg. sales"),
    # Import buttons
    ("+ 새 CSV Imports", "+ New CSV Import"),
    ("+ 새 Enter Sales", "+ Enter Sales"),
    # Sold rate
    ('<InfoItem label="Sold율" value={`${(sellThrough * 100).toFixed(1)}%`} />',
     '<InfoItem label="Sell-through Rate" value={`${(sellThrough * 100).toFixed(1)}%`} />'),
    # Bagels left label (폐기 베이글 = leftover/discarded bagels)
    ('<InfoItem label="폐기 베이글" value={`${record.bagelsLeft}`} />',
     '<InfoItem label="Leftover Bagels" value={`${record.bagelsLeft}`} />'),
    # Quick actions
    ('<QuickAction href="/predictions/new" label="새 Predictions 만들기" icon="🔮" color="blue" />',
     '<QuickAction href="/predictions/new" label="Create New Prediction" icon="🔮" color="blue" />'),
    ('<QuickAction href="/sales/new" label="새 Enter Sales" icon="➕" color="amber" />',
     '<QuickAction href="/sales/new" label="Enter Sales" icon="➕" color="amber" />'),
    # tracksInventory code note
    ('<code className="bg-purple-100 rounded px-1">tracksInventory=true</code>인 Modifier Option은 여러 Products에서 공유되어도 Inventory는 Options 1 baseline으로만 management됩니다.',
     '<code className="bg-purple-100 rounded px-1">tracksInventory=true</code> modifier options are shared across products but have only one Inventory entry.'),
    # .env file note
    ('<code className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded">.env</code> 파일 또는 배포 environment에 아래 변수를 Settings하세요.',
     'Set the following variables in your <code className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded">.env</code> file or deployment environment.'),
    # No orders matching filter
    ('<div className="p-10 text-center text-gray-500">No results matching your filters Orders이 없습니다</div>',
     '<div className="p-10 text-center text-gray-500">No orders match your filters</div>'),
    # Subscriptions no occurrences
    ('<div className="p-10 text-center text-gray-500">해당 Date에 Subscriptions 발생이 없습니다</div>',
     '<div className="p-10 text-center text-gray-500">No subscription occurrences for this date</div>'),
    # Product headings
    ('<h2 className="font-semibold text-gray-900">본 Info</h2>',
     '<h2 className="font-semibold text-gray-900">Original Info</h2>'),
    ('<h2 className="text-base font-semibold text-gray-900 border-b border-gray-100 pb-2">Link된 Data</h2>',
     '<h2 className="text-base font-semibold text-gray-900 border-b border-gray-100 pb-2">Linked Data</h2>'),
    ('<h2 className="text-base font-semibold text-gray-900 mb-3">🎌 Holiday별 Details</h2>',
     '<h2 className="text-base font-semibold text-gray-900 mb-3">🎌 Holiday Details</h2>'),
    ('<h2 className="text-base font-semibold text-gray-900">Modifiers 그룹</h2>',
     '<h2 className="text-base font-semibold text-gray-900">Modifier Groups</h2>'),
    ('<h2 className="text-base font-semibold text-gray-900">Price 및 Status</h2>',
     '<h2 className="text-base font-semibold text-gray-900">Price & Status</h2>'),
    ('<h2 className="text-base font-semibold text-gray-900">① CSV 파일 Upload</h2>',
     '<h2 className="text-base font-semibold text-gray-900">① Upload CSV File</h2>'),
    ('<h2 className="text-base font-semibold text-gray-900">② CSV Content 직접 Paste</h2>',
     '<h2 className="text-base font-semibold text-gray-900">② Paste CSV Content Directly</h2>'),
    ('<h2 className="text-sm font-semibold text-blue-900 mb-3">💡 Predictions 근거</h2>',
     '<h2 className="text-sm font-semibold text-blue-900 mb-3">💡 Prediction Basis</h2>'),
    # Placeholders
    ('placeholder="예: Christmas Day"', 'placeholder="e.g. Christmas Day"'),
    ('placeholder="예: Clear, 비, Cloudy"', 'placeholder="e.g. Clear, Rain, Cloudy"'),
    # Labels
    ('<label className="block text-sm font-medium text-gray-700 mb-1">Default 생산 버퍼</label>',
     '<label className="block text-sm font-medium text-gray-700 mb-1">Default Production Buffer</label>'),
    ('<label className="block text-sm font-medium text-gray-700 mb-1">Sort 순서</label>',
     '<label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>'),
    ('<label className="block text-xs font-medium text-gray-600 mb-1">Options명 *</label>',
     '<label className="block text-xs font-medium text-gray-600 mb-1">Option Name *</label>'),
    ('<label className="block text-xs font-medium text-gray-600 mb-1">Sort 순서</label>',
     '<label className="block text-xs font-medium text-gray-600 mb-1">Sort Order</label>'),
    ('<label className="block text-xs font-medium text-gray-600 mb-1">그룹명 *</label>',
     '<label className="block text-xs font-medium text-gray-600 mb-1">Group Name *</label>'),
    ('<label className="block text-xs font-medium text-gray-600 mb-1">최대 Select</label>',
     '<label className="block text-xs font-medium text-gray-600 mb-1">Max Select</label>'),
    ('<label className="block text-xs font-medium text-gray-600 mb-1">최소 Select</label>',
     '<label className="block text-xs font-medium text-gray-600 mb-1">Min Select</label>'),
    ('<label className="block text-xs font-medium text-gray-700 mb-1">Pickup 시간 <span className="text-red-500">*</span></label>',
     '<label className="block text-xs font-medium text-gray-700 mb-1">Pickup Time <span className="text-red-500">*</span></label>'),
    ('<label className="text-xs font-medium text-gray-600">그룹</label>',
     '<label className="text-xs font-medium text-gray-600">Group</label>'),
    # Sync list items
    ('<li>Cancel(CANCELLED) Orders은 Send 대상에서 제외</li>',
     '<li>Cancelled (CANCELLED) Orders are excluded from sending</li>'),
    ('<li>Categories는 Loyverse에서 그대로 가져옵니다 — 로컬에서 Categories를 정의하지 않습니다</li>',
     '<li>Categories are fetched as-is from Loyverse — do not define categories locally</li>'),
    ('<li>Categories를 직접 Create하거나 Manual으로 management하지 말고, Loyverse Sync를 Default으로 사용하세요</li>',
     '<li>Do not manually create or manage categories — use Loyverse Sync as the default</li>'),
    ('<li>Internal Orders은 Send Failed와 무관하게 정상 유지됨</li>',
     '<li>Internal Orders are kept intact regardless of send failures</li>'),
    ('<li>Products Loyverse 매핑 누락 시 Send Failed로 records</li>',
     '<li>Orders with missing Loyverse product mapping are recorded as send failed</li>'),
    ('<li>Products은 Loyverse category id baseline으로 Link됩니다</li>',
     '<li>Products are linked based on Loyverse category ID</li>'),
    ('<li>Success Send된 Orders은 Default적으로 재Send하지 않음 (중복 방지)</li>',
     '<li>Successfully sent Orders are not re-sent by default (to prevent duplicates)</li>'),
    ('<li>Today Pickup 예정인 INTERNAL + SUBSCRIPTION Orders만 Auto Send</li>',
     '<li>Only INTERNAL + SUBSCRIPTION Orders scheduled for today\'s pickup are auto-sent</li>'),
    ('<li>미래 Date Orders은 미리 POS에 Send하지 않음</li>',
     '<li>Future-date Orders are not sent to POS in advance</li>'),
    # Performance list items  
    ('<li>• <strong>accurate</strong>: Error율 ±5% 이내</li>',
     '<li>• <strong>accurate</strong>: Error rate within ±5%</li>'),
    ('<li>• <strong>high/low Predictions</strong>: Error율 ±10~20%</li>',
     '<li>• <strong>high/low Predictions</strong>: Error rate ±10~20%</li>'),
    ('<li>• <strong>significantly high/low Predictions</strong>: Error율 20% 초과</li>',
     '<li>• <strong>significantly high/low Predictions</strong>: Error rate > 20%</li>'),
    ('<li>• <strong>slightly high/low Predictions</strong>: Error율 ±5~10%</li>',
     '<li>• <strong>slightly high/low Predictions</strong>: Error rate ±5~10%</li>'),
    # Time select option
    ('<option value="">시간 Select 안함</option>', '<option value="">No time selected</option>'),
    # Sync order
    ('<p className="font-medium text-gray-700">Sync 순서</p>',
     '<p className="font-medium text-gray-700">Sync Order</p>'),
    ('<p className="font-semibold">⚠ Sync 이력 None</p>',
     '<p className="font-semibold">⚠ No Sync History</p>'),
    # Auto collect message
    ('<p className="mt-1 text-xs text-gray-400 ml-5">Activate 시 새 Sales/Predictions Create 때 External Data를 automatically Collect합니다.</p>',
     '<p className="mt-1 text-xs text-gray-400 ml-5">When activated, External Data is automatically collected on new Sales/Predictions.</p>'),
    # Waste notes
    ('<p className="mt-1 text-xs text-gray-400">예: 0.05 = 5% 폐기 허용</p>',
     '<p className="mt-1 text-xs text-gray-400">e.g. 0.05 = 5% waste allowance</p>'),
    ('<p className="mt-1 text-xs text-gray-400">예: 1.1 = Predictions 수량의 10% Add 생산</p>',
     '<p className="mt-1 text-xs text-gray-400">e.g. 1.1 = produce 10% more than predicted qty</p>'),
    # Auto collect note
    ('<p className="text-gray-400 text-sm mt-1">Sales Records 또는 Predictions Create 시 Auto Collect됩니다.</p>',
     '<p className="text-gray-400 text-sm mt-1">Auto-collected on new Sales Records or Predictions.</p>'),
    # Click to collect
    ('<p className="text-gray-400 text-sm mt-1">위 &apos;External Data Collect&apos; 버튼을 눌러 Collect을 Started하세요.</p>',
     '<p className="text-gray-400 text-sm mt-1">Click the &apos;Collect External Data&apos; button above to start collection.</p>'),
    # Search filter hint
    ('<p className="text-gray-400 text-xs mt-1">Search어 또는 Filter를 변경해 보세요.</p>',
     '<p className="text-gray-400 text-xs mt-1">Try changing your search term or filter.</p>'),
    ('<p className="text-gray-400">Data가 없습니다.</p>',
     '<p className="text-gray-400">No data.</p>'),
    # No predictions
    ('<p className="text-gray-500 mb-4">아직 Create된 Predictions이 없습니다.</p>',
     '<p className="text-gray-500 mb-4">No predictions created yet.</p>'),
    ('<p className="text-gray-500 mb-4">아직 Enter된 Sales Data가 없습니다.</p>',
     '<p className="text-gray-500 mb-4">No sales data entered yet.</p>'),
    ('<p className="text-gray-500 mb-4">아직 Imports Task이 없습니다.</p>',
     '<p className="text-gray-500 mb-4">No import tasks yet.</p>'),
    # Users management
    ('<p className="text-gray-500 mt-0.5 text-sm">All Users List 및 Role/Active Status를 management합니다</p>',
     '<p className="text-gray-500 mt-0.5 text-sm">Manage all users, their roles and active status</p>'),
    ('<p className="text-gray-500 mt-0.5 text-sm">Products Info를 Edit합니다</p>',
     '<p className="text-gray-500 mt-0.5 text-sm">Edit product information</p>'),
    ('<p className="text-gray-500 mt-0.5 text-sm">그룹: {option.optionGroup.name}</p>',
     '<p className="text-gray-500 mt-0.5 text-sm">Group: {option.optionGroup.name}</p>'),
    # External factors note
    ('<p className="text-gray-500 mt-1">Date별 Auto Collect된 External Factors Data</p>',
     '<p className="text-gray-500 mt-1">External factors data auto-collected by date</p>'),
    # Login message  
    ('<p className="text-gray-500 mt-1">Login하여 계속하세요</p>',
     '<p className="text-gray-500 mt-1">Log in to continue</p>'),
    ('<p className="text-gray-500 mt-1">새 계정을 만들어 Started하세요</p>',
     '<p className="text-gray-500 mt-1">Create a new account to get started</p>'),
    # Tasks
    ('<p className="text-gray-500 mt-1">스케줄된 Task과 Run Status를 management합니다.</p>',
     '<p className="text-gray-500 mt-1">Manage scheduled tasks and run status.</p>'),
    # Subscriptions list
    ('<p className="text-gray-500 mt-1">정기 View your subscription list</p>',
     '<p className="text-gray-500 mt-1">View your recurring subscription list</p>'),
    # External collected
    ('<p className="text-gray-500 mt-2">Collect된 External Data가 없습니다.</p>',
     '<p className="text-gray-500 mt-2">No external data collected.</p>'),
    # Orders management  
    ('<p className="text-gray-500 text-sm mt-0.5">All Orders View 및 Status management (STAFF 이상)</p>',
     '<p className="text-gray-500 text-sm mt-0.5">View all orders and manage status (STAFF and above)</p>'),
    ('<p className="text-gray-500 text-sm mt-0.5">All Subscriptions View (STAFF 이상)</p>',
     '<p className="text-gray-500 text-sm mt-0.5">View all subscriptions (STAFF and above)</p>'),
    # Subscriptions
    ('<p className="text-gray-500">아직 No subscriptions yet</p>',
     '<p className="text-gray-500">No subscriptions yet</p>'),
    ('<p className="text-gray-500">아직 스케줄된 Task이 없습니다.</p>',
     '<p className="text-gray-500">No scheduled tasks yet.</p>'),
    # External data no data
    ('<p className="text-gray-600 mt-3 font-medium">이 Date의 External Data가 없습니다.</p>',
     '<p className="text-gray-600 mt-3 font-medium">No external data for this date.</p>'),
    # Modifier groups select
    ('<p className="text-sm font-medium text-amber-800">Modifiers 그룹 Select</p>',
     '<p className="text-sm font-medium text-amber-800">Select Modifier Group</p>'),
    # Coming soon
    ('<p className="text-sm font-medium text-gray-400">추후 Add 예정</p>',
     '<p className="text-sm font-medium text-gray-400">Coming soon</p>'),
    # Deleted/not found product
    ('<p className="text-sm text-gray-400 mt-1">Delete되었거나 존재하지 않는 Products입니다</p>',
     '<p className="text-sm text-gray-400 mt-1">This product has been deleted or does not exist</p>'),
    # Inventory counts
    ('<p className="text-sm text-gray-500">Inventory Enter 수</p>',
     '<p className="text-sm text-gray-500">Inventory Entries</p>'),
    ('<p className="text-sm text-gray-500">Sales Records 수</p>',
     '<p className="text-sm text-gray-500">Sales Records</p>'),
    # No subscribable products
    ('<p className="text-sm text-gray-500">Subscribable한 Products이 없습니다</p>',
     '<p className="text-sm text-gray-500">No subscribable products available</p>'),
    # No records
    ('<p className="text-sm text-gray-500">records이 없습니다.</p>',
     '<p className="text-sm text-gray-500">No records.</p>'),
    # Payment methods
    ('<p className="text-sm text-gray-500">등록된 Payment Method을 Confirm하고 management합니다.</p>',
     '<p className="text-sm text-gray-500">View and manage your registered payment methods.</p>'),
    # Loyverse sync never run
    ('<p className="text-xs mt-0.5">아직 Loyverse All Sync가 has never been run. 아래 버튼으로 Sync하세요.</p>',
     '<p className="text-xs mt-0.5">Loyverse Full Sync has never been run. Use the button below to sync.</p>'),
    # Loyverse link
    ('<p className="text-xs text-blue-600">Loyverse 연동</p>',
     '<p className="text-xs text-blue-600">Loyverse Integration</p>'),
    # Re-collect
    ('<p className="text-xs text-blue-600">import된 Date 범위의 Weather·Holiday·Event Data를 다시 Collect할 수 있습니다.</p>',
     '<p className="text-xs text-blue-600">You can re-collect Weather, Holiday, and Event data for the imported date range.</p>'),
    # Record count
    ('<p className="text-xs text-gray-400 mt-1">{summary.recordCount}일 records</p>',
     '<p className="text-xs text-gray-400 mt-1">{summary.recordCount} days recorded</p>'),
    # Business days note
    ('<p className="text-xs text-gray-400 mt-1">영업일(월~토) baseline, 최소 1일 전 Orders</p>',
     '<p className="text-xs text-gray-400 mt-1">Business days (Mon–Sat), at least 1 day in advance</p>'),
    # Other POS
    ('<p className="text-xs text-gray-400">Square, Toast 등 다른 POS 연동</p>',
     '<p className="text-xs text-gray-400">Integrate with other POS systems (Square, Toast, etc.)</p>'),
    # All groups
    ('<p className="text-xs text-gray-500">All 그룹</p>',
     '<p className="text-xs text-gray-500">All groups</p>'),
    # Timestamps
    ('<p className="text-xs text-gray-500">Completed 시각</p>',
     '<p className="text-xs text-gray-500">Completed At</p>'),
    ('<p className="text-xs text-gray-500">Retry 횟수</p>',
     '<p className="text-xs text-gray-500">Retry Count</p>'),
    ('<p className="text-xs text-gray-500">Started 시각</p>',
     '<p className="text-xs text-gray-500">Started At</p>'),
    # Validation messages
    ('{ error: "orderId가 필요합니다" }', '{ error: "orderId is required" }'),
    ('{ message: "마지막 Active Admin(ADMIN)는 cannot be deactivated" }',
     '{ message: "The last active Admin cannot be deactivated" }'),
    ('{ message: "이미 사용 중인 slug입니다" }', '{ message: "Slug is already in use" }'),
    ('{ scheduledTaskId: t2.id, message: "News provider error: API 키가 Settings되지 않았습니다", level: "warning" }',
     '{ scheduledTaskId: t2.id, message: "News provider error: API key is not configured", level: "warning" }'),
    ('{ scheduledTaskId: t3.id, message: "기존 ExternalFactor 사용", level: "info" }',
     '{ scheduledTaskId: t3.id, message: "Using existing ExternalFactor", level: "info" }'),
    ('{ scheduledTaskId: t4.id, message: "Exception: Data 부족: recent records None", level: "error" }',
     '{ scheduledTaskId: t4.id, message: "Exception: Insufficient data: no recent records", level: "error" }'),
    # Prediction baseline text
    ('{ type: "baseline", text: `recent 30일 Avg. Sales이 baselineValue(${Math.round(baselineSales).toLocaleString("en-NZ")}) is used as the baseline` }',
     '{ type: "baseline", text: `Recent 30-day avg. sales ($${Math.round(baselineSales).toLocaleString("en-NZ")}) used as baseline` }'),
    ('{ type: "weekday", text: `${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][dow]} Day Weights가 Reflected됨` }',
     '{ type: "weekday", text: `${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][dow]} day-of-week weights applied` }'),
    # Button states
    ('{isPending ? "Processing..." : "발생 Create"}',
     '{isPending ? "Processing..." : "Create Occurrence"}'),
    ('{isPending ? "변경 중…" : "Change Password"}',
     '{isPending ? "Changing…" : "Change Password"}'),
    ('{loading ? "Retry 중…" : done ? "✓ Retry Completed" : "🔄 Retry"}',
     '{loading ? "Retrying…" : done ? "✓ Retry complete" : "🔄 Retry"}'),
    ('{loading ? "Sync 중…" : "🔄 Loyverse Full Sync"}',
     '{loading ? "Syncing…" : "🔄 Loyverse Full Sync"}'),
    ('{loading ? "Sync 중…" : "🔄 Loyverse catalog Sync"}',
     '{loading ? "Syncing…" : "🔄 Loyverse Catalog Sync"}'),
    ('{state === "loading" ? "Running..." : "지금 Auto Send Run"}',
     '{state === "loading" ? "Running..." : "Run Auto-Send Now"}'),
    ('{state === "loading" ? "Send 중…" : state === "success" ? "✓ Success" : "Retry"}',
     '{state === "loading" ? "Sending…" : state === "success" ? "✓ Success" : "Retry"}'),
    # Weights manager
    ('일반적으로 <strong>-1.0 ~ +1.0</strong> 범위 권장.',
     'Typically recommended range: <strong>-1.0 ~ +1.0</strong>.'),
    # Tasks not found
    ('<p className="text-gray-500">Task을 Not found</p>',
     '<p className="text-gray-500">Task not found</p>'),
    # Status change label
    ('<span className="text-xs text-gray-500 self-center">Status 변경:</span>',
     '<span className="text-xs text-gray-500 self-center">Change Status:</span>'),
    # Confirm delete dialogs
    ('`"${group.name}" 그룹을 이 Products에서 Remove하시겠습니까?\\n\\n그룹 자체는 Delete되지 않으며, 이 Products에서만 Link이 Unlinked됩니다.`',
     '`Remove "${group.name}" group from this product?\\n\\nThe group itself will not be deleted — only this product\'s link will be removed.`'),
    ('`"${groupName}" Modifiers 그룹을 Delete하시겠습니까?\\n\\n그룹 내 모든 Options도 함께 Delete되며, Link된 Products에서도 Remove됩니다.`',
     '`Delete "${groupName}" modifier group?\\n\\nAll options in the group will also be deleted and links from all products will be removed.`'),
    ('`"${productName}" Products을 Delete하시겠습니까?\\n\\n이 Task은 This action cannot be undone.`',
     '`Delete "${productName}"?\\n\\nThis action cannot be undone.`'),
    # Log messages
    ('`[STAGE A: JSON.parse 직후] total=${result.rawItemsTotal} `',
     '`[STAGE A: after JSON.parse] total=${result.rawItemsTotal} `'),
    # Adjustment texts
    ('adjustmentTexts.push(`${dowLabel}은 average보다 Sales이 낮은 Day로 하향 Reflected됨 (${(dowWeight * 100).toFixed(0)}%)`)',
     'adjustmentTexts.push(`${dowLabel} is below average, adjusted down (${(dowWeight * 100).toFixed(0)}%)`)',),
    ('adjustmentTexts.push(`${dowLabel}은 average보다 Sales이 높은 Day로 상향 Reflected됨 (+${(dowWeight * 100).toFixed(0)}%)`)',
     'adjustmentTexts.push(`${dowLabel} is above average, adjusted up (+${(dowWeight * 100).toFixed(0)}%)`)',),
    ('adjustmentTexts.push(`News impact으로 인해 Sales이 slight 하향 Reflected됨`)',
     'adjustmentTexts.push(`News impact slightly reduced sales`)',),
    # Error messages
    ('alert(e instanceof Error ? e.message : "Remove에 Failed했습니다")',
     'alert(e instanceof Error ? e.message : "Remove failed")',),
    # Log messages
    ('await addLog(taskId, `ExternalFactor None → Collect 시도: ${dateStr}`)',
     'await addLog(taskId, `No ExternalFactor found — attempting to collect: ${dateStr}`)',),
    ('await addLog(taskId, `Predictions이 Already exists (id: ${existingPrediction.id}). Skipped.`)',
     'await addLog(taskId, `Prediction already exists (id: ${existingPrediction.id}). Skipped.`)',),
    ('await addLog(taskId, `기존 ExternalFactor 사용: ${dateStr}`)',
     'await addLog(taskId, `Using existing ExternalFactor: ${dateStr}`)',),
    ('await markDone(taskId, "skipped", { resultSummary: "Predictions 이미 존재" })',
     'await markDone(taskId, "skipped", { resultSummary: "Prediction already exists" })',),
    # Console log
    ('console.log(`[weather] Response 수신 | date=${dateStr} | status=${res.status}`)',
     'console.log(`[weather] Response received | date=${dateStr} | status=${res.status}`)',),
    # Bagels left negative note
    ('const adjustmentNote = `Bagels Left 수량이 음수(${originalValue})로 records되어 0으로 Processing됨`',
     'const adjustmentNote = `Bagels Left recorded as negative (${originalValue}), clamped to 0`',),
    # Unknown error
    ('const errorMsg = err instanceof Error ? err.message : "알 수 없는 Error"',
     'const errorMsg = err instanceof Error ? err.message : "Unknown error"',),
    # CSV no data rows
    ('totalRows === 0 ? "CSV 파일에 Data Rows이 없습니다" : null',
     'totalRows === 0 ? "CSV file has no data rows" : null',),
    # Validation error messages
    ('errors.push(`${f.label}는 0 이상이어야 합니다`)',
     'errors.push(`${f.label} must be 0 or more`)',),
    # Factor labels
    ('factorLabel: "더위 (기온)"', 'factorLabel: "Heat (temperature)"'),
    ('factorLabel: "비 (Rainfall)"', 'factorLabel: "Rain (Rainfall)"'),
    ('factorValue: "School Holiday 중"', 'factorValue: "During School Holiday"'),
    # Load failures
    ('if (!res.ok) throw new Error("불러오기 Failed")',
     'if (!res.ok) throw new Error("Load failed")',),
    ('if (!res.ok) throw new Error(data.message ?? "import에 Failed했습니다")',
     'if (!res.ok) throw new Error(data.message ?? "Import failed")',),
    # Subscription reason
    ('reason: `Subscriptions 발생 Create Failed: ${err instanceof Error ? err.message : String(err)}`',
     'reason: `Subscription occurrence create failed: ${err instanceof Error ? err.message : String(err)}`',),
    # CSV row error
    ('result.errors.push({ rowNumber: row.rowNumber, error: "Date Info가 없습니다" })',
     'result.errors.push({ rowNumber: row.rowNumber, error: "Date information is missing" })',),
    # API responses
    ('return NextResponse.json({ message: "CSV Content이 필요합니다" }, { status: 400 })',
     'return NextResponse.json({ message: "CSV content is required" }, { status: 400 })',),
    ('return NextResponse.json({ message: "External Data를 Not found" }, { status: 404 })',
     'return NextResponse.json({ message: "External data not found" }, { status: 404 })',),
    ('return NextResponse.json({ message: "Imports Task을 Not found" }, { status: 404 })',
     'return NextResponse.json({ message: "Import task not found" }, { status: 404 })',),
    ('return NextResponse.json({ message: "Predictions을 Not found" }, { status: 404 })',
     'return NextResponse.json({ message: "Prediction not found" }, { status: 404 })',),
    ('return NextResponse.json({ message: "Valid하지 않은 Date입니다" }, { status: 400 })',
     'return NextResponse.json({ message: "Invalid date" }, { status: 400 })',),
    ('return NextResponse.json({ message: "import된 Rows이 없습니다", totalDates: 0, processedDates: 0, errors: [] })',
     'return NextResponse.json({ message: "No imported rows", totalDates: 0, processedDates: 0, errors: [] })',),
    ('return NextResponse.json({ message: "records을 Not found" }, { status: 404 })',
     'return NextResponse.json({ message: "Record not found" }, { status: 404 })',),
    ('return NextResponse.json({ message: "이미 해당 Date의 records이 있습니다. 다른 Please select a date." }, { status: 409 })',
     'return NextResponse.json({ message: "A record already exists for this date. Please select a different date." }, { status: 409 })',),
    ('return NextResponse.json({ message: "이미 해당 Date의 records이 있습니다. 해당 Date의 records을 Edit하려면 Edit 페이지를 이용해주세요." }, { status: 409 })',
     'return NextResponse.json({ message: "A record already exists for this date. To edit it, use the Edit page." }, { status: 409 })',),
    # Loyverse parsing errors
    ('return `Modifier Response parsing에 Failed했습니다: ${meta.errorMessage}`',
     'return `Modifier response parsing failed: ${meta.errorMessage}`',),
    ('return `네트워크 Error로 Loyverse에 Link할 수 없습니다: ${meta.errorMessage}`',
     'return `Network error — cannot connect to Loyverse: ${meta.errorMessage}`',),
    # Error messages from components
    ('setAssignError(e instanceof Error ? e.message : "Link에 Failed했습니다")',
     'setAssignError(e instanceof Error ? e.message : "Link failed")',),
    ('setError("CSV 파일만 Upload할 수 있습니다 (.csv)")',
     'setError("Only CSV files can be uploaded (.csv)")',),
    ('setError("CSV 파일을 Select하거나 아래 텍스트 영역에 CSV Content을 붙여넣으세요")',
     'setError("Select a CSV file or paste CSV content in the text area below")',),
    ('setError("클립보드 Copy에 Failed했습니다. 템플릿 Download를 이용해주세요.")',
     'setError("Clipboard copy failed. Please use the template download instead.")',),
    ('setError(err instanceof Error ? err.message : "네트워크 An error occurred")',
     'setError(err instanceof Error ? err.message : "Network error")',),
    ('setErrorMsg(err instanceof Error ? err.message : "네트워크 Error")',
     'setErrorMsg(err instanceof Error ? err.message : "Network error")',),
    ('setFetchError("서버 Link에 Failed했습니다")',
     'setFetchError("Failed to connect to server")',),
    ('setMessage(err instanceof Error ? err.message : "네트워크 Error")',
     'setMessage(err instanceof Error ? err.message : "Network error")',),
    ('setMessage({ type: "error", text: "서버 Link에 Failed했습니다" })',
     'setMessage({ type: "error", text: "Failed to connect to server" })',),
    ('setNewGroupError(e instanceof Error ? e.message : "Create에 Failed했습니다")',
     'setNewGroupError(e instanceof Error ? e.message : "Create failed")',),
    ('setNewOptionError(e instanceof Error ? e.message : "Create에 Failed했습니다")',
     'setNewOptionError(e instanceof Error ? e.message : "Create failed")',),
    # Prediction summary
    ('summary: `Predicted Sales ${Math.round(predictedSales).toLocaleString("en-NZ")}, Sold: ${predictedBagelsSold} baseline으로 ${recommendedBagelsToBake} 생산을 추천합니다.`',
     'summary: `Predicted Sales $${Math.round(predictedSales).toLocaleString("en-NZ")}, recommended production: ${recommendedBagelsToBake} (based on Sold: ${predictedBagelsSold})`',),
    # Prediction baseline text
    ('text: `recent ${metrics.dataPointCount} days Avg. Sales(${Math.round(metrics.avgSales).toLocaleString("en-NZ")})이 baselineValue으로 사용됨`',
     'text: `Recent ${metrics.dataPointCount}-day avg. sales ($${Math.round(metrics.avgSales).toLocaleString("en-NZ")}) used as baseline`',),
    ('text: `same-day average이 All average보다 ${Math.abs(diff).toFixed(0)} ${direction} Reflected됨 (${metrics.sameDayDataPointCount} 참고)`',
     'text: `Same-day average is $${Math.abs(diff).toFixed(0)} ${direction} vs. overall average (${metrics.sameDayDataPointCount} data points)`',),
    # Title
    ('title: "Event 있는 날 vs Regular days"', 'title: "Days with Event vs Regular days"'),
    # Error messages
    ('{ message: "Categories List을 loading Failed했습니다" }',
     '{ message: "Failed to load categories list" }'),
    ('{ message: "Change Password에 Failed했습니다" }',
     '{ message: "Failed to change password" }'),
    ('{ message: "Current Password가 올바르지 않습니다" }',
     '{ message: "Current password is incorrect" }'),
    ('{ message: "Date 파라미터(date)가 필요합니다" }',
     '{ message: "Date parameter is required" }'),
    ('{ message: "Inventory Info를 loading Failed했습니다" }',
     '{ message: "Failed to load inventory info" }'),
    ('{ message: "Modifier Info를 loading Failed했습니다" }',
     '{ message: "Failed to load modifier info" }'),
    ('{ message: "Modifier List을 loading Failed했습니다" }',
     '{ message: "Failed to load modifier list" }'),
    ('{ message: "New Password는 Current Password와 달라야 합니다" }',
     '{ message: "New password must be different from current password" }'),
    ('{ message: "Products Create에 Failed했습니다" }',
     '{ message: "Failed to create product" }'),
    ('{ message: "Products Info를 loading Failed했습니다" }',
     '{ message: "Failed to load product info" }'),
    ('{ message: "Products List을 loading Failed했습니다" }',
     '{ message: "Failed to load products list" }'),
    ('{ message: "Users Info Updated에 Failed했습니다" }',
     '{ message: "Failed to update user info" }'),
    ('{ message: "Users List을 loading Failed했습니다" }',
     '{ message: "Failed to load users list" }'),
    ('{ message: "자기 자신을 cannot be deactivated" }',
     '{ message: "You cannot deactivate yourself" }'),
    ('{ message: "자기 자신의 Role을 ADMIN 아래로 낮출 수 없습니다" }',
     '{ message: "You cannot lower your own role below ADMIN" }'),
    # Modifier mapping comment
    ('{/* Modifier 매핑 안내 및 links Remove됨 */}',
     '{/* Modifier mapping guide and links removed */}'),
    # Price and Status
    ('{/* Price 및 Status */}', '{/* Price & Status */}'),
    # Save success
    ('{status === "success" && <div className="p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm">✅ Save되었습니다.</div>}',
     '{status === "success" && <div className="p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm">✅ Saved.</div>}'),
    # NZ holiday names in seed
    ('"01-01": "뉴이어 데이"', '"01-01": "New Year\'s Day"'),
    ('"02-06": "와이탕이 데이"', '"02-06": "Waitangi Day"'),
    ('"04-25": "안작 데이"', '"04-25": "Anzac Day"'),
    ('"12-26": "박싱 데이"', '"12-26": "Boxing Day"'),
    # Remaining adjustment texts
    ('adjustmentTexts.push(`높은 기온 (${maxTemp.toFixed(1)}°C) — Sales slightly adjusted down`)',
     'adjustmentTexts.push(`High temperature (${maxTemp.toFixed(1)}°C) — Sales slightly adjusted down`)'),
    ('adjustmentTexts.push(`비 예보 (${rainMm.toFixed(1)}mm) — Sales adjusted down (${(rainWeight * 100).toFixed(0)}%)`)',
     'adjustmentTexts.push(`Rain forecast (${rainMm.toFixed(1)}mm) — Sales adjusted down (${(rainWeight * 100).toFixed(0)}%)`)'),
    # Remaining API response fixed/deleted
    ('return NextResponse.json({ message: "Modifiers 그룹 Delete failed" }, { status: 500 })',
     'return NextResponse.json({ message: "Failed to delete modifier group" }, { status: 500 })'),
    ('return NextResponse.json({ message: "Modifiers 그룹 Edit failed" }, { status: 500 })',
     'return NextResponse.json({ message: "Failed to edit modifier group" }, { status: 500 })'),
    ('return NextResponse.json({ message: "Options 그룹 Delete failed" }, { status: 500 })',
     'return NextResponse.json({ message: "Failed to delete option group" }, { status: 500 })'),
    ('return NextResponse.json({ message: "Options 그룹 Edit failed" }, { status: 500 })',
     'return NextResponse.json({ message: "Failed to edit option group" }, { status: 500 })'),
    ('return NextResponse.json({ message: "Options 그룹이 Deleted" })',
     'return NextResponse.json({ message: "Option group deleted" })'),
    ('return NextResponse.json({ message: "Options이 Deleted" })',
     'return NextResponse.json({ message: "Option deleted" })'),
    ('return NextResponse.json({ message: "Products이 Deleted" })',
     'return NextResponse.json({ message: "Product deleted" })'),
    # Prediction log
    ('id=${savedPrediction.id}, predictedSales=${result.predictedSales}',
     'id=${savedPrediction.id}, predictedSales=${result.predictedSales}'),
    # Baseline text variants
    ("baselineValue으로 사용됨", "used as baseline"),
    ("이 기준값으로 사용됨", "used as baseline"),
    ("기준값으로 사용됨", "used as baseline"),
    # Remaining Korean phrases
    ("참고", "reference"),
    ("반영됨", "applied"),
    ("상향 조정됨", "adjusted up"),
    ("하향 조정됨", "adjusted down"),
    ("하향 Reflected됨", "adjusted down"),
    ("상향 Reflected됨", "adjusted up"),
    ("Reflected됨", "applied"),
    ("조정됨", "adjusted"),
]

def process_file(filepath: str) -> bool:
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
    
    import re
    changed = 0
    for filepath in all_files:
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            if not re.search(r'[가-힣ㄱ-ㅎㅏ-ㅣ]', content):
                continue
        except (UnicodeDecodeError, IOError):
            continue
        
        if process_file(filepath):
            rel = filepath.replace(PROJECT_ROOT + '/', '')
            print(f"  FIXED: {rel}")
            changed += 1
    
    print(f"\nTotal fixed: {changed} files")


if __name__ == "__main__":
    main()
