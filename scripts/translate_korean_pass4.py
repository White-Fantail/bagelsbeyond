#!/usr/bin/env python3
"""Fourth pass: fix remaining Korean."""

import os
import re
import subprocess

PROJECT_ROOT = "/home/runner/work/Beyond/Beyond"

FIXES = [
    # API error messages
    ("잘못된 Request 형식", "Invalid request format"),
    ("Data를 loading Failed했습니다", "Failed to load data"),
    ("Delete되었습니다", "Deleted"),
    ("Delete에 Failed했습니다", "Delete failed"),
    ("Edit에 Failed했습니다", "Edit failed"),
    ("External Data를 loading Failed했습니다", "Failed to load external data"),
    ("Imports List을 loading Failed했습니다", "Failed to load imports list"),
    ("Imports Task Create에 Failed했습니다", "Failed to create import task"),
    ("Imports Task을 loading Failed했습니다", "Failed to load import task"),
    ("Modifiers 그룹 Create에 Failed했습니다", "Failed to create modifier group"),
    ("Modifiers 그룹 Delete에 Failed했습니다", "Failed to delete modifier group"),
    ("Modifiers 그룹 Edit에 Failed했습니다", "Failed to edit modifier group"),
    ("Modifiers 그룹 Link Unlinked에 Failed했습니다", "Failed to unlink modifier group"),
    ("Modifiers 그룹 Link에 Failed했습니다", "Failed to link modifier group"),
    ("Modifiers 그룹 List을 loading Failed했습니다", "Failed to load modifier groups list"),
    ("Modifiers 그룹을 Not found", "Modifier group not found"),
    ("Modifier를 Not found", "Modifier not found"),
    ("Options Create에 Failed했습니다", "Failed to create option"),
    ("Options Delete에 Failed했습니다", "Failed to delete option"),
    ("Options Edit에 Failed했습니다", "Failed to edit option"),
    ("Options 그룹 Create에 Failed했습니다", "Failed to create option group"),
    ("Options 그룹 Delete에 Failed했습니다", "Failed to delete option group"),
    ("Options 그룹 Edit에 Failed했습니다", "Failed to edit option group"),
    ("Options 그룹이 Delete되었습니다", "Option group deleted"),
    ("Options이 Delete되었습니다", "Option deleted"),
    ("Performance Data를 loading Failed했습니다", "Failed to load performance data"),
    ("Predictions Create에 Failed했습니다", "Failed to create prediction"),
    ("Predictions List을 loading Failed했습니다", "Failed to load predictions list"),
    ("Predictions을 loading Failed했습니다", "Failed to load prediction"),
    ("Products이 Delete되었습니다", "Product deleted"),
    ("Request 본문이 올바르지 않습니다", "Invalid request body"),
    ("Save에 Failed했습니다", "Save failed"),
    ("알 수 없는 An error occurred.", "An unknown error occurred."),
    ("알 수 None", "Unknown"),
    # Partially translated
    ("Settings을 loading Failed했습니다", "Failed to load settings"),
    ("role 또는 isActive 중 하나는 반드시 제공해야 합니다", 
     "At least one of role or isActive must be provided"),
    # Loyverse errors
    ("잠시 후 다시 시도하세요", "Please try again later"),
    ("LOYVERSE_API_TOKEN을 Confirm하세요", "Please check your LOYVERSE_API_TOKEN"),
    ("Modifier 엔드포인트를 Not found (HTTP 404)", "Modifier endpoint not found (HTTP 404)"),
    ("Loyverse API Request 한도 초과 (HTTP 429)", "Loyverse API rate limit exceeded (HTTP 429)"),
    ("Loyverse modifier API Response이 비어 있습니다. (modifier 0)", 
     "Loyverse modifier API response is empty. (modifier 0)"),
    ("아직 modifier Sync가 has never been run.", "Modifier sync has never been run."),
    # Task service
    ("예외 발생:", "Exception:"),
    ("targetDate가 없습니다.", "targetDate is missing."),
    ("[externalFactor] weather No Data (null 반환) | date=", "[externalFactor] weather no data (returned null) | date="),
    # Option delete confirm
    ('"Options을 Delete하시겠습니까?"', '"Are you sure you want to delete this option?"'),
    ('Options을 Delete하시겠습니까?', 'Are you sure you want to delete this option?'),
    # Analytics utils
    ("같은 Day ${metrics.sameDayDataPointCount} 참고", 
     "same-day ${metrics.sameDayDataPointCount} data points"),
    ("같은 Day ", "same-day "),
    # Direction labels
    ('const direction = diff >= 0 ? "높아 상향" : "낮아 하향"',
     'const direction = diff >= 0 ? "above, adjusted up" : "below, adjusted down"'),
    ("높아 상향", "above (adjusted up)"),
    ("낮아 하향", "below (adjusted down)"),
    # Prediction service adjustment texts
    ("Effect로 Sold량이 상향 조정됨", "Effect — Sold qty adjusted up"),
    ("Effect로 Sales이 상향 조정됨", "Effect — Sales adjusted up"),
    ("으로 family Customer increase Available성 Reflected됨", 
     " — family customer demand increase reflected"),
    ("으로 인해 Sales이 slight 하향 조정됨", " — Sales slightly adjusted down"),
    ("로 인해 Sales이 하향 조정됨", " — Sales adjusted down"),
    ("School Holiday Period으로 family Customer increase Available성 Reflected됨",
     "School Holiday — family customer demand increase reflected"),
    ("높은 기온 (${maxTemp.toFixed(1)}°C)으로 인해 Sales이 slight 하향 조정됨",
     "High temperature (${maxTemp.toFixed(1)}°C) — Sales slightly adjusted down"),
    ("비 예보 (${rainMm.toFixed(1)}mm)로 인해 Sales이 하향 조정됨",
     "Rain forecast (${rainMm.toFixed(1)}mm) — Sales adjusted down"),
    # Prediction recommendation text
    ('`${production.recommendedBagelsToBake} 생산을 추천합니다.`',
     '`Recommended production: ${production.recommendedBagelsToBake}.`'),
    ("`Sold: ${predictedBagelsSold} baseline으로 `",
     "`Based on Sold: ${predictedBagelsSold} baseline — `"),
    # CSV parser
    ('"Date 필드가 없거나 parsing에 Failed했습니다"',
     '"Date field is missing or failed to parse"'),
    ("Date 필드가 없거나 parsing에 Failed했습니다",
     "Date field is missing or failed to parse"),
    # Validations
    ('"slug를 Enter해주세요"', '"Please enter a slug"'),
    ('"slug는 소문자, 숫자, 하이픈만 사용할 수 있습니다"',
     '"Slug can only contain lowercase letters, numbers, and hyphens"'),
    ('"Date 형식은 YYYY-MM-DD 이어야 합니다"', '"Date format must be YYYY-MM-DD"'),
    # Comment
    ("// Bagels Left 수량이 음수인 경우(전날 Inventory 사용 등) 0으로 보정하고 Notes에 records",
     "// If Bagels Left is negative (e.g. previous day inventory used), clamp to 0 and note"),
    # Weather icon
    ("patterns: /Wind|windy|강풍/i", "patterns: /Wind|windy/i"),
    ("patterns: /안|fog|mist/i", "patterns: /fog|mist/i"),
    # Type includes
    ("const type = text.includes(\"Rain\") || text.includes(\"기온\") ? \"weather\"",
     "const type = text.includes(\"Rain\") || text.includes(\"temperature\") ? \"weather\""),
    # Weather data comment
    ("Data가 충분하지 않아 DefaultValue을 사용했습니다.", 
     "Insufficient data — using default value."),
    # Admin page descriptions
    ("description: \"Actual Sales과 Predictions을 Calendar 형태로 한Snow에 보고, Weather 아이콘으로 External Factors도 Confirm하세요.\"",
     "description: \"View actual sales and predictions in Calendar view, and check external factors with weather icons.\""),
    ("description: \"Predictions Sold량과 과거 소진율을 based으로 최적의 Bagels Baked량을 추천해드립니다.\"",
     "description: \"Recommends the optimal baking quantity based on predicted sold qty and historical sell-through rate.\""),
    ("description: \"Store, Uber Eats, DoorDash, Other By Channel Sales과 생산량을 Date별로 간편하게 records하세요.\"",
     "description: \"Easily record daily store, Uber Eats, DoorDash, and other channel sales and production.\""),
    ("description: \"Weather, Holiday, School Holiday, Local Event, News Data를 Auto으로 Collect해 Analytics에 Reflected합니다.\"",
     "description: \"Automatically collects Weather, Holiday, School Holiday, Local Event, and News data for analytics.\""),
    ("description: \"daily·weekly·monthly·Day-of-Week Analysis과 Holiday·Weather segments 비교로 패턴을 파악하세요.\"",
     "description: \"Identify patterns with daily/weekly/monthly/day-of-week analytics and Holiday/Weather segment comparisons.\""),
    ("description: \"과거 Data와 External Factors Weights를 활용한 rule based Predictions 엔진으로 Tomorrow Sales을 미리 알아보세요.\"",
     "description: \"Preview tomorrow's sales with a rule-based prediction engine using historical data and external factor weights.\""),
    # Loyverse integration descriptions
    ("Loyverse catalog sync based으로 Products을 Categories별로 management합니다",
     "Manage products by category based on Loyverse catalog sync"),
    ("Loyverse에서 Products·Categories·Modifiers를 가져옵니다. Categories는 Sync 시 Auto으로 Updated됩니다.",
     "Fetches Products, Categories, and Modifiers from Loyverse. Categories are automatically updated on Sync."),
    # Step descriptions
    ("<li>Loyverse Categories View → 로컬 DB upsert</li>",
     "<li>Fetch Loyverse Categories → upsert to local DB</li>"),
    ("<li>Loyverse Modifiers 그룹/Options View → 로컬 DB upsert</li>",
     "<li>Fetch Loyverse Modifier groups/options → upsert to local DB</li>"),
    ("<li>Loyverse Products View → 로컬 DB upsert + Categories Link + Modifiers Link</li>",
     "<li>Fetch Loyverse Products → upsert to local DB + link Categories + link Modifiers</li>"),
    ("<li>Loyverse에서 Remove된 Products-Modifiers Link 정리</li>",
     "<li>Clean up Products-Modifiers links removed from Loyverse</li>"),
    # Settings labels
    ('<label className="block text-sm font-medium text-gray-700 mb-1">Default 도시 (City)</label>',
     '<label className="block text-sm font-medium text-gray-700 mb-1">Default City</label>'),
    ('<label className="block text-sm font-medium text-gray-700 mb-1">국가 코드 (Country Code)</label>',
     '<label className="block text-sm font-medium text-gray-700 mb-1">Country Code</label>'),
    ('<p className="mt-1 text-xs text-gray-400">Holiday View에 사용됩니다 (예: NZ, AU)</p>',
     '<p className="mt-1 text-xs text-gray-400">Used for Holiday lookup (e.g. NZ, AU)</p>'),
    ('<p className="mt-1 text-xs text-gray-400">예: Canterbury, Auckland</p>',
     '<p className="mt-1 text-xs text-gray-400">e.g. Canterbury, Auckland</p>'),
    # Products page
    ('<p className="mt-0.5 text-blue-700">Name·Price은 Loyverse 본 필드로 Edit Unavailable입니다. Internal 운영 필드(Inventory Tracking, Active, Sort)만 Edit Available합니다.</p>',
     '<p className="mt-0.5 text-blue-700">Name and Price are Loyverse original fields and cannot be edited. Only internal operation fields (Inventory Tracking, Active, Sort) can be edited.</p>'),
    ('<p className="mt-1 text-xs text-blue-500">🔒 Loyverse 본 필드 — Edit Unavailable</p>',
     '<p className="mt-1 text-xs text-blue-500">🔒 Loyverse original field — Read-only</p>'),
    ('<p className="mt-1 text-xs text-green-600">✏️ Internal 운영 필드 — Edit Available</p>',
     '<p className="mt-1 text-xs text-green-600">✏️ Internal operation field — Editable</p>'),
    # External factors page
    ('<p className="mt-1">위 &apos;External Data Collect&apos; 버튼을 눌러 Data를 가져올 수 있습니다.</p>',
     '<p className="mt-1">Click the &apos;Collect External Data&apos; button above to fetch data.</p>'),
    ('<p className="text-gray-400 text-sm">Log가 없습니다.</p>',
     '<p className="text-gray-400 text-sm">No logs.</p>'),
    ('<p className="text-gray-400 text-sm">recent 7일 Sales Data가 없습니다.</p>',
     '<p className="text-gray-400 text-sm">No sales data for the recent 7 days.</p>'),
    # Order detail page
    ('<p className="text-gray-500">Customer명</p>', '<p className="text-gray-500">Customer Name</p>'),
    ('<p className="text-gray-500">Pickup 시간</p>', '<p className="text-gray-500">Pickup Time</p>'),
    ('<span className="text-gray-500">Pickup 시간</span>', '<span className="text-gray-500">Pickup Time</span>'),
    ('<p className="text-gray-500">전화</p>', '<p className="text-gray-500">Phone</p>'),
    ('"<p className="text-sm font-medium text-gray-800 mt-1">{(durationMs / 1000).toFixed(2)}초</p>"',
     '"<p className="text-sm font-medium text-gray-800 mt-1">{(durationMs / 1000).toFixed(2)}s</p>"'),
    ('}초</p>', '}s</p>'),
    ('<p className="text-sm text-gray-500">Today Inventory Data가 없습니다.</p>',
     '<p className="text-sm text-gray-500">No inventory data for today.</p>'),
    # Products-Modifiers diagnosis
    ('<p className="text-xs font-semibold text-amber-800">Products-Modifiers Link 진단</p>',
     '<p className="text-xs font-semibold text-amber-800">Products-Modifiers Link Diagnosis</p>'),
    # Analytics subtext
    ('<p className="text-xs text-gray-400 mt-0.5">Select Period 내 Day별 Avg. Sales 및 Sold량</p>',
     '<p className="text-xs text-gray-400 mt-0.5">Daily avg. sales and sold qty for the selected period</p>'),
    ('<p className="text-xs text-gray-400">latest 순</p>',
     '<p className="text-xs text-gray-400">Latest first</p>'),
    ('<p className="text-xs text-gray-500 mb-1">Price차</p>',
     '<p className="text-xs text-gray-500 mb-1">Price diff</p>'),
    ('<p className="text-xs text-gray-500 mb-1">그룹</p>',
     '<p className="text-xs text-gray-500 mb-1">Group</p>'),
    ('<p className="text-xs text-gray-500 mb-1">마지막 ExternalFactor Collect</p>',
     '<p className="text-xs text-gray-500 mb-1">Last External Data Collect</p>'),
    ('<p className="text-xs text-gray-500 mb-1">마지막 Predictions Create</p>',
     '<p className="text-xs text-gray-500 mb-1">Last Prediction Created</p>'),
    ('<p className="text-xs text-gray-500">Error 메시지</p>',
     '<p className="text-xs text-gray-500">Error Message</p>'),
    ('<p className="text-xs text-gray-500">Failed한 Task</p>',
     '<p className="text-xs text-gray-500">Failed Task</p>'),
    ('<p className="text-xs text-gray-500">단가: ${item.unitPriceSnapshot.toFixed(2)}</p>',
     '<p className="text-xs text-gray-500">Unit price: ${item.unitPriceSnapshot.toFixed(2)}</p>'),
    ('<p className="text-xs text-gray-500">소요 시간</p>',
     '<p className="text-xs text-gray-500">Duration</p>'),
    ('<p className="text-xs text-gray-500">진Rows 중</p>',
     '<p className="text-xs text-gray-500">In progress</p>'),
    # Best/worst month/week
    ('<p className="text-xs text-green-600 font-medium mb-1">🏆 최고 월</p>',
     '<p className="text-xs text-green-600 font-medium mb-1">🏆 Best Month</p>'),
    ('<p className="text-xs text-green-600 font-medium mb-1">🏆 최고 주</p>',
     '<p className="text-xs text-green-600 font-medium mb-1">🏆 Best Week</p>'),
    ('<p className="text-xs text-red-600 font-medium mb-1">📉 최저 월</p>',
     '<p className="text-xs text-red-600 font-medium mb-1">📉 Worst Month</p>'),
    ('<p className="text-xs text-red-600 font-medium mb-1">📉 최저 주</p>',
     '<p className="text-xs text-red-600 font-medium mb-1">📉 Worst Week</p>'),
    # Required columns help
    ('<p className="text-xs">Required 컬럼: <code className="bg-amber-100 px-1 rounded">date</code></p>',
     '<p className="text-xs">Required column: <code className="bg-amber-100 px-1 rounded">date</code></p>'),
    # Categories no sync
    ('<p>아직 Sync된 Categories가 없습니다. Loyverse Sync를 Run now.</p>',
     '<p>No synced categories yet. Run Loyverse Sync.</p>'),
    # External factors no data
    ('<p>이 Date의 External Data가 없습니다.</p>',
     '<p>No external data for this date.</p>'),
    # Sync notification
    ('<span className="text-sm font-medium text-gray-700">Predictions/Sales Create 시 Automatic External Data Collection</span>',
     '<span className="text-sm font-medium text-gray-700">Automatic External Data Collection on Predictions/Sales Create</span>'),
    # Modifier not synced warning
    ('<span className="text-sm font-semibold text-amber-800">⚠ Modifier 미Sync</span>',
     '<span className="text-sm font-semibold text-amber-800">⚠ Modifier Not Synced</span>'),
    # School holiday
    ('<span className="text-sm text-gray-700">School Holiday Period입니다</span>',
     '<span className="text-sm text-gray-700">This is a School Holiday Period</span>'),
    # Mock mode warning
    ('<strong>⚠ API token이 없습니다.</strong> Mock mode로 operation합니다.',
     '<strong>⚠ No API token configured.</strong> Operating in Mock mode.'),
    # User count
    ('All <strong className="text-gray-700">{groups.length}</strong> 그룹',
     'All <strong className="text-gray-700">{groups.length}</strong> groups'),
    ('Search results <strong className="text-gray-700">{groups.length}</strong> 그룹',
     'Search results <strong className="text-gray-700">{groups.length}</strong> groups'),
    ('(All {totalGroups} 그룹)', '({totalGroups} groups total)'),
    ('{" "}<span className="text-gray-400">(All {totalGroups} 그룹)</span>',
     '{" "}<span className="text-gray-400">({totalGroups} groups total)</span>'),
    # Link or
    ('Link하거나,{" "}', 'link, or{" "}'),
    # Loyverse Settings link
    ('Loyverse Settings 및 Sync →', 'Loyverse Settings & Sync →'),
    # Admin page
    ('label="▶ 대기 Task Run"', 'label="▶ Run Pending Task"'),
    ('label="⟳ 대기 Task Run"', 'label="⟳ Run Pending Task"'),
    # Placeholders
    ('placeholder="Name 또는 Email..."', 'placeholder="Name or Email..."'),
    ('placeholder="Products Description을 Enter하세요 (Select)"', 
     'placeholder="Enter product description (optional)"'),
    ('placeholder="그룹명으로 Search..."', 'placeholder="Search by group name..."'),
    ('placeholder="예: Bagel Selection"', 'placeholder="e.g. Bagel Selection"'),
    ('placeholder="예: Plain Bagel"', 'placeholder="e.g. Plain Bagel"'),
    # Time select
    ('<option value="">시간 Select</option>', '<option value="">Select time</option>'),
    # All 그룹
    ('<option value="">All 그룹</option>', '<option value="">All groups</option>'),
    # CSV format
    ('<p className="font-semibold mb-1">CSV 파일 형식</p>', 
     '<p className="font-semibold mb-1">CSV File Format</p>'),
    # Predictions/Sales Create notice
    ('Predictions/Sales Create 시 Automatic External Data Collection',
     'Automatic External Data Collection on Predictions/Sales Create'),
    # Admin sync page
    ('{isAdmin && " 아래에서 Manual Send하거나 상단 버튼으로 All 재Run now."}',
     '{isAdmin && " Manually send below or use the top button to re-run all."}'),
    # Analytics subnav
    ('aria-label="Analytics 서브 네비게이션"', 'aria-label="Analytics sub-navigation"'),
    # Sold rate
    ('Sold율 ', 'Sell-through '),
    # Uber이츠 label
    ('{ label: "Uber이츠", amount: summary.uberSales, pct: summary.uberPercent, color: "bg-green-500" }',
     '{ label: "Uber Eats", amount: summary.uberSales, pct: summary.uberPercent, color: "bg-green-500" }'),
    ('label: "Uber이츠"', 'label: "Uber Eats"'),
    ('"Uber이츠"', '"Uber Eats"'),
    # monthly/weekly headers
    ('title: "monthly Total Sales"', 'title: "Monthly Total Sales"'),
    ('title: "weekly Sales Trend"', 'title: "Weekly Sales Trend"'),
    ('<h3 className="text-sm font-semibold text-gray-700">weekly Sales Trend (recent 8주)</h3>',
     '<h3 className="text-sm font-semibold text-gray-700">Weekly Sales Trend (recent 8 weeks)</h3>'),
    # Prediction stage comments
    ('{/* Stage A: HTTP 문 Response */}', '{/* Stage A: HTTP Raw Response */}'),
    ('{/* Stage B: JSON.parse 직후 */}', '{/* Stage B: After JSON.parse */}'),
    ('{/* Stage C: Parsed DTO (Active Products만) */}', '{/* Stage C: Parsed DTO (Active Products only) */}'),
    ('{/* Stage D: 링크 Create Result */}', '{/* Stage D: Link Create Result */}'),
    # Log comments
    ('// ── Stage A: JSON.parse 직후 (before deleted_at filter) ───────────────────',
     '// ── Stage A: After JSON.parse (before deleted_at filter) ───────────────────'),
    # Environment
    ("# In development environment 실제 API 없이 Mock Data 사용:",
     "# In development environment (uses Mock Data without a real API):"),
    # Subscription counts
    ('({bestMonth.recordCount}일)', '({bestMonth.recordCount} days)'),
    ('({bestWeek.recordCount}일)', '({bestWeek.recordCount} days)'),
    ('({worstMonth.recordCount}일)', '({worstMonth.recordCount} days)'),
    ('({worstWeek.recordCount}일)', '({worstWeek.recordCount} days)'),
    ('{bestMonth.recordCount}일 ·', '{bestMonth.recordCount} days ·'),
    ('{bestWeek.recordCount}일 ·', '{bestWeek.recordCount} days ·'),
    ('{worstMonth.recordCount}일 ·', '{worstMonth.recordCount} days ·'),
    ('{worstWeek.recordCount}일 ·', '{worstWeek.recordCount} days ·'),
    # No products
    ('"등록된 Products이 없습니다"', '"No products registered"'),
    # CSV example
    ('placeholder={`date,bagelsBaked,bagelsLeft,storeSales,uberSales,doordashSales,otherSales,notes\n2024-01-15,80,5,250.00,80.00,50.00,10.00,평일 보통\n2024-01-20,100,3,320.00,110.00,70.00,15.00,Sat 많음`}',
     'placeholder={`date,bagelsBaked,bagelsLeft,storeSales,uberSales,doordashSales,otherSales,notes\n2024-01-15,80,5,250.00,80.00,50.00,10.00,normal weekday\n2024-01-20,100,3,320.00,110.00,70.00,15.00,Sat busy`}'),
    ('"2024-01-15", "80", "5", "250.00", "80.00", "50.00", "10.00", "Normal weekday"',
     '"2024-01-15", "80", "5", "250.00", "80.00", "50.00", "10.00", "Normal weekday"'),
    ('"2024-01-20", "100", "3", "320.00", "110.00", "70.00", "15.00", "Sat 많음"',
     '"2024-01-20", "100", "3", "320.00", "110.00", "70.00", "15.00", "Sat busy"'),
    # Prediction sub labels
    ('sub="Recommended Production 대비"', 'sub="vs. Recommended Production"'),
    ('sub="베이글 baseline"', 'sub="bagel baseline"'),
    # Error rate label
    ('<p className="text-sm text-gray-500 mt-1">Error율 5% 이내 baseline</p>',
     '<p className="text-sm text-gray-500 mt-1">Error rate within 5% baseline</p>'),
    # Seed weight descriptions (remaining after prev passes)
    ('"Fri — Weekend 기대 demand increase"', '"Fri — anticipated pre-weekend demand increase"'),
    ('"Mon — 주중 most quiet 날"', '"Mon — quietest weekday"'),
    ('"Sat — most Sales 높은 날"', '"Sat — highest sales day"'),
    ('"Thu — Weekend 전 slight increase"', '"Thu — slight increase before weekend"'),
    ('"Tue — average 아래"', '"Tue — below average"'),
    ('"Sat 많음"', '"Sat busy"'),
    # Modifier groups count
    ('Modifiers 그룹 {result.modifierGroupsUpserted} · Options {result.modifierOptionsUpserted}',
     'Modifier groups {result.modifierGroupsUpserted} · Options {result.modifierOptionsUpserted}'),
    # Prediction + new buttons  
    ('+ New Prediction 만들기', '+ Create New Prediction'),
    # Sync된 Categories info
    ('"Sync된 Categories 수"', '"Synced Categories"'),
    ('"연동 Products 수"', '"Linked Products"'),
    ('"연동된 Products 수"', '"Linked Products"'),
    # "초" time unit
    (').toFixed(2)}초</p>', ').toFixed(2)}s</p>'),
    # subscription test
    ('"알레르기 주의"', '"allergy warning"'),
    # "Add 조정 None"
    (': "Add 조정 None"', ': "No adjustment added"'),
    # 진Rows 중
    ('진Rows 중', 'In progress'),
    # external factor
    ('External Data Collect 현황', 'External Data Collection Status'),
    # Predictions vs Actual
    ("Predictions vs 실제 비교", "Predictions vs Actual Comparison"),
    # remaining partial Korean
    ("한Snow에 보고", "at a glance"),
    ("based으로", "based on"),
    ("Auto으로", "automatically"),
    # Loyverse Modifiers link
    ("링크", "links"),
    # Product-modifier count
    ("<> · 그룹 {lastFullSync.modifierGroupsUpserted} · Options {lastFullSync.modifierOptionsUpserted} · 링크 {lastFullSync.modifierLinksUpdated}items</>",
     "<> · Groups {lastFullSync.modifierGroupsUpserted} · Options {lastFullSync.modifierOptionsUpserted} · Links {lastFullSync.modifierLinksUpdated}</>"),
    # "개" leftover count suffix (should be safe now since we're late in processing)
    ("그룹\n", "groups\n"),
    # Remaining day counts
    ("일 · Daily Avg.", " days · Daily Avg."),
    # Misc remaining
    ('": "Add 조정 None"', '": "No adjustment added"'),
    ('"Add 조정 None"', '"No adjustment added"'),
    ("대기 중", "Pending"),
    ("대기중", "Pending"),
    ("진행 중", "In progress"),
    ("완료됨", "Completed"),
    ("실패함", "Failed"),
    ("기다리는 중", "Waiting"),
    # task service missing
    ("'알 수 없는 오류'", "'Unknown error'"),
    # Log message
    ("id=${savedPrediction.id}, 예상Sales=${result.predictedSales}",
     "id=${savedPrediction.id}, predictedSales=${result.predictedSales}"),
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
