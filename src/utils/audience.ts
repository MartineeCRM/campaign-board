type Condition =
  | { type: 'rule'; text: string }
  | { type: 'group'; operator: 'and' | 'or'; children: Condition[] }
  | { type: 'not'; child: Condition }

function matchingClose(value: string): number {
  let depth = 0
  let quoted = false

  for (let i = 0; i < value.length; i++) {
    if (value[i] === '"' && value[i - 1] !== '\\') quoted = !quoted
    if (quoted) continue
    if (value[i] === '(') depth++
    if (value[i] === ')' && --depth === 0) return i
  }

  return -1
}

function unwrap(value: string): string {
  let result = value.trim()
  while (result.startsWith('(') && matchingClose(result) === result.length - 1) {
    result = result.slice(1, -1).trim()
  }
  return result
}

function splitTopLevel(value: string, operator: 'and' | 'or'): string[] {
  const separator = ` ${operator} `
  const parts: string[] = []
  let depth = 0
  let quoted = false
  let start = 0

  for (let i = 0; i < value.length; i++) {
    if (value[i] === '"' && value[i - 1] !== '\\') quoted = !quoted
    if (quoted) continue
    if (value[i] === '(') depth++
    if (value[i] === ')') depth--
    if (depth === 0 && value.slice(i, i + separator.length).toLowerCase() === separator) {
      parts.push(value.slice(start, i).trim())
      start = i + separator.length
      i = start - 1
    }
  }

  if (parts.length === 0) return [value]
  parts.push(value.slice(start).trim())
  return parts
}

function parseCondition(value: string): Condition {
  const text = unwrap(value)
  for (const operator of ['or', 'and'] as const) {
    const parts = splitTopLevel(text, operator)
    if (parts.length > 1 && parts.every(Boolean)) {
      const children = parts.map(parseCondition).flatMap((child) =>
        child.type === 'group' && child.operator === operator ? child.children : [child],
      )
      return { type: 'group', operator, children }
    }
  }
  if (/^not\s+/i.test(text)) return { type: 'not', child: parseCondition(text.replace(/^not\s+/i, '')) }
  return { type: 'rule', text }
}

function formatOrGroup(condition: Condition, indent = ''): string[] {
  const children = condition.type === 'group' && condition.operator === 'or' ? condition.children : [condition]
  const [first, ...rest] = children
  const firstText = first.type === 'rule' ? first.text : formatCondition(first)
  return [`${indent}(${firstText} OR`, ...rest.map((item) => `  ${indent}${item.type === 'rule' ? item.text : formatCondition(item)}`), `${indent})`]
}

function formatCondition(condition: Condition): string {
  if (condition.type === 'rule') return condition.text
  if (condition.type === 'not') return `NOT ${formatCondition(condition.child)}`
  return condition.children.map(formatCondition).join(` ${condition.operator.toUpperCase()} `)
}

function renderCondition(condition: Condition): string[] {
  if (condition.type === 'not') {
    const child = condition.child
    if (child.type === 'group' && child.operator === 'or') {
      const [first, ...rest] = child.children
      return ['AND NOT', `(${formatCondition(first)} OR`, ...rest.map((item) => `  ${formatCondition(item)}`), ')']
    }
    return ['AND NOT', `(${formatCondition(child)})`]
  }

  if (condition.type !== 'group' || condition.operator !== 'and') {
    return formatOrGroup(condition, '• ')
  }

  const negativeIndex = condition.children.findIndex((item) => item.type === 'not')
  const included = negativeIndex < 0 ? condition.children : condition.children.slice(0, negativeIndex)
  const excluded = negativeIndex < 0 ? [] : condition.children.slice(negativeIndex)
  const lines: string[] = []

  included.forEach((item, index) => {
    const hasNextIncluded = index < included.length - 1
    if (item.type === 'group' && item.operator === 'or') {
      const [first, ...rest] = item.children
      lines.push(`• (${formatCondition(first)} OR`, ...rest.map((child) => `  ${formatCondition(child)}`), `)${hasNextIncluded ? ' AND' : ''}`)
    } else if (item.type === 'rule') {
      lines.push(`• ${item.text}${hasNextIncluded ? ' AND' : ''}`)
    } else {
      lines.push(`• ${formatCondition(item)}${hasNextIncluded ? ' AND' : ''}`)
    }
  })

  excluded.forEach((item) => lines.push(...renderCondition(item)))
  return lines
}

export function formatAudience(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (!normalized) return ''

  const heading = normalized.match(/^"((?:[^"\\]|\\.)+)"(?:\s+\[([^\]]*)\])?\s*/)
  const name = heading?.[1]
  const description = heading?.[2]
  const expression = heading ? normalized.slice(heading[0].length).trim() : normalized
  if (!expression) return [name, description].filter(Boolean).join('\n')

  const condition = parseCondition(expression)
  if (!name && condition.type === 'rule') return value

  return [name, description, '', ...renderCondition(condition)].filter((line) => line !== undefined).join('\n').trim()
}
