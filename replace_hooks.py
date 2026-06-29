with open('hooks.ts', 'r') as f:
    content = f.read()

content = content.replace('return { ...s, quantity: Math.max(0, s.quantity + diff) };', 'return { ...s, quantity: s.quantity + diff };')

with open('hooks.ts', 'w') as f:
    f.write(content)
