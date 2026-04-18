import sys
import re
import os

files_to_fix = [
    "app/components/auctions/Layout.vue",
    "app/components/auctions/TablePage.vue",
    "app/components/leads/ApiCrudPage.vue",
    "app/components/retail/Layout.vue",
    "app/components/retail/TablePage.vue",
    "app/components/sales/Layout.vue",
    "app/components/sales/TablePage.vue",
    "app/composables/useAuctionsApi.ts",
    "server/api/leads/index.get.ts",
    "server/utils/changeTracker.ts",
    "test-query.js"
]

def format_file(filepath):
    if not os.path.exists(filepath):
        print(f"Skipping {filepath} (does not exist)")
        return
        
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    # antfu/if-newline: if (...) return -> if (...)\n  return
    # This regex is careful about standard 'if (cond) something' that doesn't have an opening brace.
    content = re.sub(r'(?i)([^\w]if\s*\([^)]+\))\s+(?!\{|const|let|var|return\s*\w+\s*\()([A-Za-z_]+.+)$', r'\1\n      \2', content, flags=re.MULTILINE)
    
    # Actually simpler: split by lines, and fix if statements without braces that aren't multiline.
    lines = content.split('\n')
    new_lines = []
    
    for i, line in enumerate(lines):
        line = line.rstrip()
        
        # 10. dot-notation: obj["all"] -> obj.all
        line = re.sub(r'\[["\']([a-zA-Z_$][a-zA-Z0-9_$]*)["\']\]', r'.\1', line)
        
        # 9. prefer-import-meta
        line = line.replace('process.client', 'import.meta.client')
        line = line.replace('process.server', 'import.meta.server')
        
        # 11. no-unused-disable -> remove generic disables
        if 'eslint-disable ' in line and not 'eslint-disable-next-line' in line:
            line = re.sub(r'/\*\s*eslint-disable\s*(?:[a-zA-Z0-9_/-]+\s*)*\*/', '', line)
        
        # antfu/if-newline: if (foo) bar
        # Find `if (...) stmt` and make it two lines (if it isn't starting with `{` or ending with `{`)
        m = re.match(r'^(.*?\bif\s*\([^\{]+\))\s+(.+)$', line)
        if m:
            prefix, stmt = m.groups()
            if not stmt.startswith('{') and not prefix.endswith('{') and not stmt.endswith('{'):
                indent = re.match(r'^\s*', prefix).group(0)
                # handle `if (...) something else something` which should just be split
                if ' else ' in line and not '{' in line:
                     # Very rare, let's just ignore complex else inline cases and let the dev handle if needed.
                     pass
                else:
                    new_lines.append(prefix)
                    # Add an extra 2 spaces to the current indent level
                    new_lines.append(f"{indent}  {stmt}")
                    continue
                    
        # brace-style: } else { -> }\nelse {
        if 'catch' in line or 'else' in line:
            line = re.sub(r'\}\s*else\s*\{', '}\n    else {', line)
            line = re.sub(r'\}\s*catch\s*\(', '}\n    catch (', line)
            line = re.sub(r'\}\s*catch\s*\{', '}\n    catch {', line)
        
        # style/no-trailing-spaces -> rstrip() handled it
        if line:
            new_lines.append(line)
        else:
            new_lines.append('')
            
    # Re-join
    content = '\n'.join(new_lines)
    
    # 7. no-multiple-empty-lines
    content = re.sub(r'\n{3,}', '\n\n', content)
    
    # 5. style/semi -> Remove all semicolons! BUT wait, python regex might break JS if we blindly replace.
    # Let's just remove semicolons at the end of lines if they are not preceded by `&` (html entity)
    # and not inside strings? Let's just blindly remove them if they end the line.
    content = re.sub(r'(?<!&)#?([^;]*)(;\s*)$', r'\1', content, flags=re.MULTILINE)
    content = re.sub(r';$', '', content, flags=re.MULTILINE)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
        
for fp in files_to_fix:
    format_file(fp)

print("Formatting complete")
