"""
Full restructure of index.html:
1. Remove carbon-liquidity tab pane
2. Replace top nav tabs with left sidebar navigation
3. Add app-layout wrapper for sidebar + main content
4. Keep ALL functionality intact
"""
import re

with open('templates/index_reformatted.html', 'r', encoding='utf-8') as f:
    content = f.read()

print("Input:", len(content), "bytes,", content.count('\n'), "lines")

# ── Step 1: Remove carbon-liquidity tab pane ──────────────────────────────────
# Find the div with id="tab-carbon-liquidity" and remove it with all its content
# We track div depth to find matching closing tag

start_marker = 'id="tab-carbon-liquidity"'
start_idx = content.find(start_marker)

if start_idx == -1:
    print("WARNING: carbon-liquidity pane not found")
else:
    # Walk backwards to find the opening < of this div
    div_open_start = content.rfind('<div', 0, start_idx)
    
    # Also remove any preceding comment line
    comment_search = content.rfind('<!-- ==', 0, div_open_start)
    if comment_search != -1 and comment_search > div_open_start - 300:
        removal_start = comment_search
    else:
        removal_start = div_open_start
    
    # Count div depth from div_open_start to find matching </div>
    pos = div_open_start + 4  # after <div
    depth = 1
    while depth > 0 and pos < len(content):
        next_open = content.find('<div', pos)
        next_close = content.find('</div>', pos)
        
        if next_close == -1:
            break
        
        if next_open != -1 and next_open < next_close:
            depth += 1
            pos = next_open + 4
        else:
            depth -= 1
            pos = next_close + 6
    
    removal_end = pos
    print(f"Removing carbon-liquidity pane: chars {removal_start}–{removal_end} ({removal_end-removal_start} bytes)")
    content = content[:removal_start] + content[removal_end:]
    print("After removal:", len(content), "bytes")


# ── Step 2: Remove old <nav> tab bar ─────────────────────────────────────────
# Find: <!-- Sub-navigation Tabs Bar --> ... </nav>
nav_comment = '<!-- Sub-navigation Tabs Bar -->'
nav_start = content.find(nav_comment)
if nav_start == -1:
    # Try finding just the nav element with tab-btn
    nav_start = content.find('<nav class="bg-white border-b')
    
if nav_start != -1:
    nav_end = content.find('</nav>', nav_start) + 6  # include </nav>
    content = content[:nav_start] + content[nav_end:]
    print("Old nav tab bar removed")
else:
    print("WARNING: nav tab bar not found")


# ── Step 3: Find </header> and insert sidebar wrapper ─────────────────────────
SIDEBAR_HTML = '''
    <!-- App Layout Wrapper: Sidebar + Content -->
    <div class="app-layout">

        <!-- ═══ Left Sidebar Navigation ═══ -->
        <aside class="bank-sidebar">

            <!-- System Badge -->
            <div class="sidebar-sys-badge">
                <div class="sidebar-sys-name">FIN-01 &nbsp;·&nbsp; v2.4.1</div>
                <div class="sidebar-sys-sub">World Bank Risk Engine</div>
            </div>

            <!-- Navigation -->
            <nav class="sidebar-nav">

                <div class="sidebar-group-label">Analytics</div>

                <button class="sidebar-nav-item tab-btn active" data-tab="dashboard">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="3" width="7" height="8" rx="1"/>
                        <rect x="14" y="3" width="7" height="5" rx="1"/>
                        <rect x="14" y="12" width="7" height="9" rx="1"/>
                        <rect x="3" y="15" width="7" height="6" rx="1"/>
                    </svg>
                    <span>Risk &amp; Capital Dashboard</span>
                </button>

                <button class="sidebar-nav-item tab-btn" data-tab="scenarios">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/>
                        <line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/>
                        <line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/>
                        <line x1="1" y1="14" x2="7" y2="14"/>
                        <line x1="9" y1="8" x2="15" y2="8"/>
                        <line x1="17" y1="16" x2="23" y2="16"/>
                    </svg>
                    <span>Scenario Comparison</span>
                </button>

                <button class="sidebar-nav-item tab-btn" data-tab="supply-chain">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="4" r="2"/>
                        <circle cx="4" cy="20" r="2"/>
                        <circle cx="20" cy="20" r="2"/>
                        <line x1="12" y1="6" x2="12" y2="11"/>
                        <line x1="12" y1="11" x2="4" y2="18"/>
                        <line x1="12" y1="11" x2="20" y2="18"/>
                    </svg>
                    <span>Supply Chain Contagion</span>
                </button>

                <button class="sidebar-nav-item tab-btn" data-tab="horizons">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                    </svg>
                    <span>Multi-Year Horizons</span>
                </button>

                <div class="sidebar-group-label" style="margin-top:8px;">Data</div>

                <button class="sidebar-nav-item tab-btn" data-tab="data-manager">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <ellipse cx="12" cy="5" rx="9" ry="3"/>
                        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
                        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
                    </svg>
                    <span>Data Manager &amp; CSV</span>
                </button>

                <button class="sidebar-nav-item tab-btn" data-tab="onboarding">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                        <polyline points="9 22 9 12 15 12 15 22"/>
                    </svg>
                    <span>Facility Onboarding</span>
                </button>

            </nav>

            <!-- Sidebar Footer -->
            <div class="sidebar-footer">
                <div class="sidebar-status-dot"></div>
                <div>
                    <div class="sidebar-status-label">Engine Online &nbsp;·&nbsp; Basel III Compliant</div>
                    <div class="sidebar-status-sub">BCBS-239 &nbsp;/&nbsp; NGFS Scenarios Active</div>
                </div>
            </div>

        </aside>
        <!-- ═══ End Sidebar ═══ -->

'''

header_end = content.find('</header>')
if header_end != -1:
    insert_pos = header_end + len('</header>')
    content = content[:insert_pos] + SIDEBAR_HTML + content[insert_pos:]
    print("Sidebar inserted after </header>")
else:
    print("ERROR: </header> not found!")


# ── Step 4: Replace <main> to work inside flex layout ─────────────────────────
main_pattern = re.compile(r'<main\s+class="[^"]*max-w-7xl[^"]*"[^>]*>')
match = main_pattern.search(content)
if match:
    content = content[:match.start()] + '<main class="app-main-content">' + content[match.end():]
    print("Main tag replaced")
else:
    # Try simpler
    content = re.sub(r'<main\b[^>]+>', '<main class="app-main-content">', content, count=1)
    print("Main tag replaced (fallback)")


# ── Step 5: After </main>, close app-layout wrapper ──────────────────────────
main_close = content.rfind('</main>')
if main_close != -1:
    content = content[:main_close + 7] + '\n    </div><!-- /.app-layout -->' + content[main_close + 7:]
    print("app-layout wrapper closed")


# ── Step 6: Fix carbon-liquidity tab button if still present ──────────────────
content = re.sub(
    r'<button[^>]*data-tab="carbon-liquidity"[^>]*>.*?</button>',
    '',
    content,
    flags=re.DOTALL
)


# ── Write output ──────────────────────────────────────────────────────────────
with open('templates/index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("\nDone!")
print("Final size:", len(content), "bytes")
print("Final lines:", content.count('\n'))
