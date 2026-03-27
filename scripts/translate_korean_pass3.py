#!/usr/bin/env python3
"""Third pass: fix remaining Korean."""

import os
import re
import subprocess

PROJECT_ROOT = "/home/runner/work/Beyond/Beyond"

FIXES = [
    # Garbled from previous passes
    ("발/테스트", "dev/test"),
    ("발 환경에서", "In development environment"),
    ("# 발 환경에서 실제 API 없이 Mock Data 사용:", "# In development: uses Mock Data without a real API:"),
    ("실 비교", "actual comparison"),
    ("예 (실제 HTTP None)", "Yes (no actual HTTP)"),
    ("인증이 필요합니다", "Authentication required"),
    ("접근 Unauthorized", "Access unauthorized"),
    ("접근 Unauthorized", "Unauthorized"),
    # Partially translated
    ("Settings을 loading Failed했습니다", "Failed to load settings"),
    ("Subscriptions Create 중 An error occurred", "Error creating subscription"),
    ("Subscriptions List을 불러오지 못했습니다", "Failed to load subscription list"),
    ("Users를 Not found", "User not found"),
    ("발생 Create 중 An error occurred", "Error creating occurrence"),
    ("발생 List을 불러오지 못했습니다", "Failed to load occurrence list"),
    ("발생 Item을 Not found", "Occurrence not found"),
    ("발생 중 An error occurred", "Error during occurrence"),
    ("Email 또는 Password가 올바르지 않습니다", "Incorrect email or password"),
    ("Products Info가 올바르지 않습니다", "Invalid product information"),
    ("Subscriptions Create 중 An error occurred", "Error creating subscription"),
    ("최소 1 이상의 Products을 Please select", "Please select at least 1 product"),
    ("장바구니에 담겼습니다 ✓", "Added to cart ✓"),
    ("이미 import가 Completed된 Task입니다", "Import task is already completed"),
    ("Subscriptions을 Not found", "Subscription not found"),
    ("Scheduled Status의 Item만 items너뛸 수 있습니다", "Only SCHEDULED status items can be skipped"),
    # 마지막 All Sync patterns
    ('✗ 마지막 All Sync Failed"', '✗ Last Full Sync Failed"'),
    ('아직 None"', 'Not yet"'),
    ('⚠ 마지막 All Sync Partial Completed"', '⚠ Last Full Sync partially complete"'),
    ('✓ 마지막 All Sync Success"', '✓ Last Full Sync successful"'),
    ('⚠ Loyverse 마지막 All Sync Partial Completed"', '⚠ Loyverse Last Full Sync partially complete"'),
    ('✓ Loyverse 마지막 All Sync Success"', '✓ Loyverse Last Full Sync successful"'),
    (': "✗ Loyverse 마지막 All Sync Failed"', ': "✗ Loyverse Last Full Sync Failed"'),
    # Analytics/predictions labels
    ("예상 Remaining", "Predicted Remaining"),
    ("예상 Sold", "Predicted Sold"),
    ("예상 Waste Rate", "Predicted Waste Rate"),
    ("예상", "Predicted"),
    # Stat cards
    ("Recommended Production 대비", "vs. Recommended Production"),
    ("베이글 baseline", "bagel baseline"),
    # Admin page nav items
    ("→ All Sales Analytics (ADMIN 전용)", "→ All Sales Analytics (ADMIN only)"),
    ("→ Integrations (Loyverse POS 카탈Log Sync)", "→ Integrations (Loyverse POS Catalog Sync)"),
    ("→ Order Management (Pickup Orders View·Status 변경)", "→ Order Management (View Pickup Orders · Change Status)"),
    ("→ Product Management (Products·Options 등록 및 Edit)", "→ Product Management (Register and Edit Products & Options)"),
    ("→ Users (Role·Active Status 변경)", "→ Users (Change Role & Active Status)"),
    ("→ 앱 Settings", "→ App Settings"),
    ("→ 일별 Inventory Management (생산량·Sold량 Enter)", "→ Daily Inventory Management (Enter Production & Sold Qty)"),
    # ModifierMappingManager debug labels
    ("[A] HTTP 문 Response", "[A] HTTP Raw Response"),
    ("[B] JSON.parse 직후 (deleted_at Filter 전)", "[B] After JSON.parse (before deleted_at filter)"),
    ("[C] Parsed DTO (Active Products만)", "[C] Parsed DTO (Active Products only)"),
    ("[D] 링크 Create Result", "[D] Link Create Result"),
    ("Cache 사용:", "Cache used:"),
    ("Fallback 사용:", "Fallback used:"),
    ("modifier 매칭 Failed:", "modifier match failed:"),
    ("modifier_ids 필드 None:", "modifier_ids field absent:"),
    ("링크 Create Failed:", "link create failed:"),
    ("마지막 sync:", "last sync:"),
    # Product page
    ("이 Products은 Loyverse에서 Sync된 Data입니다. 본 필드(Name, 슬러그, Description,", 
     "This product is synced from Loyverse. Original fields (Name, slug, Description,"),
    ("base price)는 Edit할 수 없으며 Internal 운영 필드만 Edit Available합니다.",
     "base price) cannot be edited. Only internal operation fields can be modified."),
    # ModifierMappingManager
    ("아래 테이블의 &ldquo;Loyverse Modifier&rdquo; 열에서 modifier option ID를 직접 Enter할 수",
     "You can directly enter the modifier option ID in the &ldquo;Loyverse Modifier&rdquo; column of the table below"),
    ("있습니다. Loyverse Sync가 성공하면 이 모드를 닫고 드롭다운에서 Select하세요",
     "After successful Loyverse sync, close this mode and select from the dropdown."),
    # Inventory/picker
    ("{pickerSearch ? \"Search Result가 없습니다\" : \"Link Available한 그룹이 없습니다\"}",
     "{pickerSearch ? \"No search results\" : \"No groups available to link\"}"),
    ("Search Result가 없습니다", "No search results"),
    ("Link Available한 그룹이 없습니다", "No groups available to link"),
    # Manual modifier mode
    (': "▼ Manual modifier ID Enter (비상 fallback)"}',
     ': "▼ Manually enter modifier ID (emergency fallback)"}'),
    # Modifier groups table remaining
    ("<> · 그룹 {lastFullSync.modifierGroupsUpserted} · Options {lastFullSync.modifierOptionsUpserted} · 링크 {lastFullSync.modifierLinksUpdated}items</>",
     "<> · Groups {lastFullSync.modifierGroupsUpserted} · Options {lastFullSync.modifierOptionsUpserted} · Links {lastFullSync.modifierLinksUpdated}</>"),
    # Calendar
    ("비 {item.rainMm}mm", "Rain {item.rainMm}mm"),
    # Day suffix patterns
    ("일Day", "Sun"),
    ("월Day", "Mon"),
    ("화Day", "Tue"),
    ("수Day", "Wed"),
    ("목Day", "Thu"),
    ("금Day", "Fri"),
    ("토Day", "Sat"),
    # Count patterns with 일
    ("({month.recordCount}일)", "({month.recordCount} days)"),
    ("({week.recordCount}일)", "({week.recordCount} days)"),
    ("{h.recordCount}일", "{h.recordCount} days"),
    ("days 기록", "days recorded"),
    ("recent 7일 baseline", "recent 7-day baseline"),
    # Import page
    ("총 {latestImportJob.totalRows}Rows · Success {latestImportJob.successRows} · Failed {latestImportJob.failedRows}",
     "Total {latestImportJob.totalRows} rows · Success {latestImportJob.successRows} · Failed {latestImportJob.failedRows}"),
    # Inventory stock
    ("{isSoldOut ? \"Out of Stock\" : \"장바구니 담기\"}", "{isSoldOut ? \"Out of Stock\" : \"Add to Cart\"}"),
    ("장바구니 담기", "Add to Cart"),
    # Loyverse debug labels
    ("(APP_TIMEZONE 환경변수로 변경)", "(change via APP_TIMEZONE env var)"),
    # Group buttons
    ("+ 그룹 Add", "+ Add Group"),
    ("+ 그룹 Link", "+ Link Group"),
    ("+ 새 Predictions", "+ New Prediction"),
    ("+ 새 Predictions 만들기", "+ Create New Prediction"),
    ("+ 새 Products Add", "+ Add New Product"),
    # Collect status
    ("recent Collect일:", "last collected:"),
    ("External Data Collect 현황", "External Data Collection Status"),
    ("Collect 시각", "Collected At"),
    ("마지막 Refreshed", "Last Refreshed"),
    # School holiday value
    ('factor.schoolHoliday ? "예" : "No"', 'factor.schoolHoliday ? "Yes" : "No"'),
    ('record.externalFactor.schoolHoliday ? "예" : "No"', 'record.externalFactor.schoolHoliday ? "Yes" : "No"'),
    ('"예"', '"Yes"'),
    # Paste content preview
    ('Preview{pastedCsvText.trim() ? " (Paste Content)" : " (Upload 파일)"}',
     'Preview{pastedCsvText.trim() ? " (pasted content)" : " (uploaded file)"}'),
    ("(Upload 파일)", "(uploaded file)"),
    ("(Paste Content)", "(pasted content)"),
    # Analytics links
    ('{ href: "/analytics/daily", label: "일별" }',
     '{ href: "/analytics/daily", label: "Daily" }'),
    ('{ href: "/analytics/monthly", label: "월별" }',
     '{ href: "/analytics/monthly", label: "Monthly" }'),
    ('{ href: "/analytics/segments", label: "세그먼트" }',
     '{ href: "/analytics/segments", label: "Segments" }'),
    ('{ href: "/analytics/weekly", label: "주별" }',
     '{ href: "/analytics/weekly", label: "Weekly" }'),
    # Period labels
    ('{ value: "30d", label: "recent 30일" }', '{ value: "30d", label: "Recent 30 days" }'),
    ('{ value: "7d", label: "recent 7일" }', '{ value: "7d", label: "Recent 7 days" }'),
    ('{ value: "90d", label: "recent 90일" }', '{ value: "90d", label: "Recent 90 days" }'),
    ('{ value: "ALL", label: "Subscriptions 여부 All" }', '{ value: "ALL", label: "All (subscription or not)" }'),
    ('{ value: "createdAt_asc", label: "오래된 가입순" }', '{ value: "createdAt_asc", label: "Oldest join date" }'),
    ('{ value: "createdAt_desc", label: "latest 가입순" }', '{ value: "createdAt_desc", label: "Newest join date" }'),
    ('{ value: "email_asc", label: "Email 오름차순" }', '{ value: "email_asc", label: "Email A-Z" }'),
    ('{ value: "email_desc", label: "Email 내림차순" }', '{ value: "email_desc", label: "Email Z-A" }'),
    ('{ value: "lastMonth", label: "지난 달" }', '{ value: "lastMonth", label: "Last Month" }'),
    ('{ value: "name_asc", label: "Name 오름차순" }', '{ value: "name_asc", label: "Name A-Z" }'),
    ('{ value: "thisMonth", label: "이번 달" }', '{ value: "thisMonth", label: "This Month" }'),
    # Filter labels
    ('"지난 달"', '"Last Month"'),
    ('"이번 달"', '"This Month"'),
    # Predictions labels
    ('"약간 낮게 Predictions"', '"Slightly underpredicted"'),
    ('"약간 높게 Predictions"', '"Slightly overpredicted"'),
    ('"낮게 Predictions"', '"Underpredicted"'),
    ('"높게 Predictions"', '"Overpredicted"'),
    ('"정확"', '"Accurate"'),
    ('"크게 낮게 Predictions"', '"Significantly underpredicted"'),
    ('"크게 높게 Predictions"', '"Significantly overpredicted"'),
    # Method labels
    ('"규칙 기반 v1"', '"Rule-based v1"'),
    ('"규칙 기반 v2"', '"Rule-based v2"'),
    ('"Weights 기반 v1"', '"Weights-based v1"'),
    # Import status labels
    ('{ label: "import됨", color: "bg-purple-100 text-purple-700" }',
     '{ label: "Imported", color: "bg-purple-100 text-purple-700" }'),
    ('{ label: "대기중",   color: "bg-yellow-100 text-yellow-700" }',
     '{ label: "Pending", color: "bg-yellow-100 text-yellow-700" }'),
    ('pending:  "대기 중"', 'pending:  "Pending"'),
    ('{ label: "유효",     color: "bg-green-100 text-green-700" }',
     '{ label: "Valid", color: "bg-green-100 text-green-700" }'),
    ('{ label: "검증중",   color: "bg-blue-100 text-blue-700" }',
     '{ label: "Validating", color: "bg-blue-100 text-blue-700" }'),
    ('validating: "검증중"', 'validating: "Validating"'),
    # Task status
    ('"Run 중"', '"Running"'),
    # Weather codes
    ('"Clouds 조금"', '"Partly Cloudy"'),
    ('"이슬비"', '"Drizzle"'),
    ('"소나기"', '"Shower"'),
    ('"천둥번"', '"Thunderstorm"'),
    ('"안"', '"Foggy"'),
    ('"비"', '"Rain"'),
    # futureWeatherOptions
    ('["Clear", "Clouds 조금", "Cloudy"]', '["Clear", "Partly Cloudy", "Cloudy"]'),
    ('["Clear", "Cloudy", "비", "Clouds 조금", "Clear", "Clear"]', '["Clear", "Cloudy", "Rain", "Partly Cloudy", "Clear", "Clear"]'),
    # seed data
    ('"평일 보통"', '"Normal weekday"'),
    ('"토Day 많음"', '"Sat busy"'),
    # Seed data descriptions
    ('"금Day — Weekend 기대 수요 increase"', '"Friday — anticipated pre-weekend demand increase"'),
    ('"Holiday — 나들이 Customer increase"', '"Holiday — outing customer increase"'),
    ('"Local Event — 유동 인구 increase"', '"Local Event — foot traffic increase"'),
    ('"월Day — 주중 가장 조용한 날"', '"Monday — quietest weekday"'),
    ('"부정적 NZ News 영향"', '"Negative NZ News impact"'),
    ('"토Day — 가장 Sales 높은 날"', '"Saturday — highest sales day"'),
    ('"School Holiday — 가족 Customer increase"', '"School Holiday — family customer increase"'),
    ('"일Day — Weekend 브런치 수요"', '"Sunday — weekend brunch demand"'),
    ('"목Day — Weekend 전 소폭 increase"', '"Thursday — slight increase before weekend"'),
    ('"화Day — average 아래"', '"Tuesday — below average"'),
    ('"더운 날 (28°C+) — 소폭 decrease"', '"Hot day (28°C+) — slight decrease"'),
    ('"Rainy days — 방문 Customer decrease"', '"Rainy days — customer visit decrease"'),
    ('"수Day — baselineValue"', '"Wednesday — baseline"'),
    ('"부정적 World News 영향"', '"Negative World News impact"'),
    # Products validating
    ('productId: z.string().min(1, "Product ID를 Enter해주세요")',
     'productId: z.string().min(1, "Please enter a Product ID")'),
    # Titles
    ('"Analytics 리포트"', '"Analytics Report"'),
    ('"Calendar 시각화"', '"Calendar Visualization"'),
    ('"생산량 추천"', '"Production Recommendation"'),
    ('"일별 Sales Records"', '"Daily Sales Records"'),
    ('"Bagels Beyond Sales 관리 대장"', '"Bagels Beyond Sales Management"'),
    ('"Bagels Beyond Sales 관리"', '"Bagels Beyond Sales Management"'),
    # Labels with Japanese/Korean day names
    ('"내일"', '"Tomorrow"'),
    # Subnav
    ('label: "일별"', 'label: "Daily"'),
    ('label: "월별"', 'label: "Monthly"'),
    ('label: "세그먼트"', 'label: "Segments"'),
    ('label: "주별"', 'label: "Weekly"'),
    # Loyverse API
    ('"API 토큰"', '"API Token"'),
    ('"Active 여부"', '"Active"'),
    ('"Sync된 Categories 수"', '"Synced Categories"'),
    ('"동작 모드"', '"Operating Mode"'),
    ('"연동 Products 수"', '"Integrated Products"'),
    ('"연동된 Products 수"', '"Linked Products"'),
    # Headings
    ("Predictions vs 실제 비교", "Predictions vs Actual Comparison"),
    ("Reflected된 Factor별 영향", "Impact by Applied Factor"),
    ("🎌 Holiday 영향", "🎌 Holiday Impact"),
    ("🏫 School Holiday 영향", "🏫 School Holiday Impact"),
    ("Sales 추이", "Sales Trend"),
    ("월별 Total Sales", "Monthly Total Sales"),
    ("주별 Total Sales", "Weekly Total Sales"),
    # Sub stats
    ('title="average 일 Sold Bagels"', 'title="Daily Avg. Sold Bagels"'),
    ("{result.loyverseMock ? \"예 (실제 HTTP None)\" : \"No\"}",
     "{result.loyverseMock ? \"Yes (no actual HTTP)\" : \"No\"}"),
    # mode selector
    ('{mode === "all" ? "All" : mode === "unmapped" ? "Unmapped" : "Inventory 추적"}',
     '{mode === "all" ? "All" : mode === "unmapped" ? "Unmapped" : "Inventory Tracking"}'),
    # POS provider
    ('{process.env.POS_PROVIDER ?? "(미Settings)"}', '{process.env.POS_PROVIDER ?? "(not configured)"}'),
    # Analytics page inline subnav
    ('{ href: "/analytics/segments", label: "🔍 세그먼트", desc: "조items별 비교" }',
     '{ href: "/analytics/segments", label: "🔍 Segments", desc: "Compare by condition" }'),
    # Import action
    ('`✅ ${validRows} Rows 임포트 실Rows`', '`✅ Run import for ${validRows} rows`'),
    # Running state
    ('isPending ? "Login 중…"', 'isPending ? "Logging in…"'),
    ('isPending ? "가입 중…"', 'isPending ? "Signing up…"'),
    # Partial %
    ("% 차이", "% difference"),
    # Stats
    ("7일 Total Sales", "7-Day Total Sales"),
    ("Daily Avg. Sold량", "Daily Avg. Sold"),
    # Collect status
    ("Collect 시각", "Collected At"),
    # Prediction recommendation text
    ("(예상 Remaining: ", "(Predicted Remaining: "),
    # Header month/week
    ('<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">월</th>',
     '<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Month</th>'),
    ('<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">주</th>',
     '<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Week</th>'),
    # Placeholders
    ('placeholder="8자 이상, 영문+숫자 포함"', 'placeholder="At least 8 characters, including letters and numbers"'),
    ('placeholder="예: Christmas"', 'placeholder="e.g. Christmas"'),
    ('placeholder="예: Clear, Cloudy, 비"', 'placeholder="e.g. Clear, Cloudy, Rain"'),
    ('placeholder="예: Local Market"', 'placeholder="e.g. Local Market"'),
    # Year/month format  
    ('return `${year}년 ${month}월`;', 'return `${year}/${month}`;'),
    # CSV example data
    ('"평일 보통"', '"Normal weekday"'),
    # Loading
    ('로딩 중...', 'Loading...'),
    ('로딩 중…', 'Loading...'),
    ('불러오는 중...', 'Loading...'),
    # Selected file
    ('"Select됨: {fileName}"', '"Selected: {fileName}"'),
    ('Select됨:', 'Selected:'),
    # Import template copied
    ('"✅ Copy됨!"', '"✅ Copied!"'),
    ('"Copy됨!"', '"Copied!"'),
    ('Copy됨', 'Copied'),
    # Predictions sub text
    ('sub="recent Waste Rate(${(metrics.avgWasteRate * 100).toFixed(1)}%)을 고려해 Estimated Sold Qty 대비 ${bufferPct}% buffer applied production recommendation"',
     'sub={`${bufferPct}% buffer over estimated sold qty (Waste Rate: ${(metrics.avgWasteRate * 100).toFixed(1)}%)`}'),
    ('`recent Waste Rate(${(metrics.avgWasteRate * 100).toFixed(1)}%)을 고려해 Estimated Sold Qty 대비 ${bufferPct}% buffer applied production recommendation`',
     '`${bufferPct}% buffer over estimated sold qty based on Waste Rate (${(metrics.avgWasteRate * 100).toFixed(1)}%)`'),
    # Remaining counts
    ('대상: ${input.totalDates} days', 'Target dates: ${input.totalDates}'),
    # Statcard sub values
    ('{recentRecords.length} days 기록', '{recentRecords.length} days recorded'),
    # Holiday
    ('"recent 30일"', '"Recent 30 days"'),
    ('"recent 7일"', '"Recent 7 days"'),
    ('"recent 90일"', '"Recent 90 days"'),
    # Pickup time col header
    ('<th className="pb-2 pr-4">Pickup 시간대</th>', '<th className="pb-2 pr-4">Pickup Time</th>'),
    # Day of week label
    ('factorLabel:   `Day (${["일Day","월Day","화Day","수Day","목Day","금Day","토Day"][dow]})`',
     'factorLabel:   `Day (${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][dow]})`'),
    ('factorValue:   ["일Day","월Day","화Day","수Day","목Day","금Day","토Day"][dow]',
     'factorValue:   ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][dow]'),
    ('const labels = ["일Day", "월Day", "화Day", "수Day", "목Day", "금Day", "토Day"]',
     'const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]'),
    # Subscription service
    ("이미 Cancel됨", "Already cancelled"),
    ("Cancel할 수 없는 Status", "Status cannot be cancelled"),
    # task service  
    ('"알 수 None"', '"Unknown"'),
    ('return "알 수 None"', 'return "Unknown"'),
    # CSV example
    ('"토Day 많음"', '"Sat busy"'),
    ('"평일 보통"', '"Normal weekday"'),
    # Bagels Baked count in prediction
    ("예상 Sold", "Predicted Sold"),
    # weather
    ('if (code <= 49) return "안";', 'if (code <= 49) return "Fog";'),
    ('if (code <= 59) return "이슬비";', 'if (code <= 59) return "Drizzle";'),
    ('if (code <= 69) return "비";', 'if (code <= 69) return "Rain";'),
    ('if (code <= 84) return "소나기";', 'if (code <= 84) return "Shower";'),
    ('if (code <= 99) return "천둥번";', 'if (code <= 99) return "Thunderstorm";'),
    ('if (code <= 2) return "Clouds 조금";', 'if (code <= 2) return "Partly Cloudy";'),
    # Bagels left validation
    ('"Bagels Left 수는 Bagels Baked 수보다 클 수 없습니다"',
     '"Bagels Left cannot be greater than Bagels Baked"'),
    # import됨 
    ('"import됨"', '"Imported"'),
    # B안 policy comment
    ("* Home page routing policy (B안):", "* Home page routing policy:"),
    # Beagle count with 개 suffix
    ('<span>베이글 {p.predictedBagelsSold}</span>', '<span>{p.predictedBagelsSold} bagels</span>'),
    ('<span>베이글', '<span>'),
    # StatCard sub
    ('sub="베이글"', 'sub="bagels"'),
    # Remaining partial translations  
    ('title: "생산량 추천"', 'title: "Production Recommendation"'),
    ('title: "일별 Sales Records"', 'title: "Daily Sales Records"'),
    ('title: "Analytics 리포트"', 'title: "Analytics Report"'),
    ('title: "Calendar 시각화"', 'title: "Calendar Visualization"'),
    ('title: "Bagels Beyond Sales 관리"', 'title: "Bagels Beyond Sales Management"'),
    ('description: "Bagels Beyond Sales 관리 대장"', 'description: "Bagels Beyond Sales Management"'),
    # Remaining Korean words
    ("기록", "records"),
    ("대기중", "Pending"),
    ("대기 중", "Pending"),
    ("유효", "Valid"),
    ("검증중", "Validating"),
    ("비중", "share"),
    ("주별", "weekly"),
    ("월별", "monthly"),
    ("세그먼트", "segments"),
    ("일별", "daily"),
    ("여부", ""),
    ("수행", "perform"),
    ("인증", "authentication"),
    ("토큰", "token"),
    ("모드", "mode"),
    ("동작", "operation"),
    ("환경변수", "environment variable"),
    ("환경", "environment"),
    ("현황", "status"),
    ("영향", "impact"),
    ("차이", "difference"),
    ("추이", "trend"),
    ("리포트", "report"),
    ("시각화", "visualization"),
    ("카탈Log", "catalog"),
    ("카탈로그", "catalog"),
    ("슬러그", "slug"),
    ("비상", "emergency"),
    ("fallback", "fallback"),
    ("관리 대장", "management"),
    ("관리", "management"),
    ("내일", "Tomorrow"),
    ("내일(", "Tomorrow ("),
    ("수요", "demand"),
    ("인구", "traffic"),
    ("유동", "foot"),
    ("방문", "visitor"),
    ("나들이", "outing"),
    ("브런치", "brunch"),
    ("가족", "family"),
    ("소폭", "slight"),
    ("부정적", "negative"),
    ("가장", "most"),
    ("가장 높은", "highest"),
    ("가장 낮은", "lowest"),
    ("조용한", "quiet"),
    ("완전", "full"),
    ("베이스", "base"),
    ("기반", "based"),
    ("규칙", "rule"),
    ("높게", "high"),
    ("낮게", "low"),
    ("약간", "slightly"),
    ("크게", "significantly"),
    ("정확", "accurate"),
    ("기록 수", "record count"),
    ("오래된", "oldest"),
    ("latest", "latest"),
    ("오름차순", "A-Z"),
    ("내림차순", "Z-A"),
    ("가입순", "by join date"),
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
    
    changed = 0
    for filepath in all_files:
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            import re
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
