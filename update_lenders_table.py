
import os

path = r"c:\Veltro\client\src\pages\Lenders.tsx"
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

target = '''                                        <span className="text-muted-foreground text-sm font-medium">
                                          {LENDER_TYPES.find((t) => t.value === lender.lenderType)?.label || "Lender"}
                                        </span>'''

# Try with different indentations
target_alt = '''                                       <TableCell className="hidden lg:table-cell">
                                         <span className="text-muted-foreground text-sm font-medium">
                                           {LENDER_TYPES.find((t) => t.value === lender.lenderType)?.label || "Lender"}
                                         </span>
                                       </TableCell>'''

replacement = '''                                       <TableCell className="hidden lg:table-cell">
                                         <TierBadge type={lender.lenderType} />
                                       </TableCell>'''

if target_alt in content:
    new_content = content.replace(target_alt, replacement)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Successfully updated using target_alt")
elif "LENDER_TYPES.find" in content:
    # Fallback to a more flexible string search for the table cell
    # Find the line with LENDER_TYPES.find inside a TableCell
    lines = content.splitlines()
    new_lines = []
    skip = 0
    updated = False
    for i, line in enumerate(lines):
        if skip > 0:
            skip -= 1
            continue
        
        if '<TableCell className="hidden lg:table-cell">' in line and i + 2 < len(lines) and "LENDER_TYPES.find" in lines[i+1] or "LENDER_TYPES.find" in lines[i+2]:
             # This is likely the one. We need to find the closing TableCell
             found_closing = -1
             for j in range(i+1, min(i+10, len(lines))):
                 if '</TableCell>' in lines[j]:
                     found_closing = j
                     break
             if found_closing != -1:
                 # Reconstruct with TierBadge
                 new_lines.append(line)
                 new_lines.append('                                         <TierBadge type={lender.lenderType} />')
                 new_lines.append('                                       </TableCell>')
                 skip = found_closing - i
                 updated = True
                 continue
        new_lines.append(line)
    
    if updated:
        with open(path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(new_lines))
        print("Successfully updated using flexible search")
    else:
        print("Could not find target strings")
else:
    print("Could not find LENDER_TYPES.find")
