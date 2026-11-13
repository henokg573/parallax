import { Fragment, type CSSProperties, type ReactNode } from 'react'
import parse, { domToReact, Element, type DOMNode, type HTMLReactParserOptions } from 'html-react-parser'

const descriptionClasses = {
  h1: 'mb-5 mt-0 border-b border-amber-200 pb-3 text-2xl font-extrabold tracking-tight text-emerald-950 sm:text-3xl',
  h2: 'mb-3 mt-8 border-l-4 border-amber-400 pl-3 text-xl font-bold tracking-tight text-emerald-950 first:mt-0 sm:text-2xl',
  h3: 'mb-2 mt-6 text-lg font-bold text-emerald-900 first:mt-0',
  p: 'my-3 leading-7 text-zinc-700 first:mt-0 last:mb-0',
  ul: 'my-4 list-disc space-y-2 pl-6 marker:text-emerald-700',
  ol: 'my-4 list-decimal space-y-2 pl-6 marker:font-bold marker:text-emerald-700',
  li: 'pl-1 leading-7 text-zinc-700',
  blockquote: 'my-5 border-l-4 border-emerald-200 pl-4 italic text-zinc-600',
}

function renderInline(text: string): ReactNode[] {
  const tokenPattern = /\*\*[^*]+\*\*|__[^_]+__|\*[^*\n]+\*|`[^`\n]+`|\[[^\]]+\]\(https?:\/\/[^)\s]+\)/g
  const nodes: ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  let key = 0

  while ((match = tokenPattern.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index))
    const token = match[0]
    const link = token.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/)

    if (link) {
      nodes.push(
        <a className="font-semibold text-emerald-800 underline decoration-emerald-300 underline-offset-2 hover:text-emerald-950" href={link[2]} key={key++} rel="noreferrer" target="_blank">
          {link[1]}
        </a>,
      )
    } else if (token.startsWith('**') || token.startsWith('__')) {
      nodes.push(<strong className="font-bold text-zinc-950" key={key++}>{token.slice(2, -2)}</strong>)
    } else if (token.startsWith('`')) {
      nodes.push(<code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[0.9em] text-emerald-950" key={key++}>{token.slice(1, -1)}</code>)
    } else {
      nodes.push(<em className="italic text-zinc-800" key={key++}>{token.slice(1, -1)}</em>)
    }

    lastIndex = tokenPattern.lastIndex
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex))
  return nodes
}

function heading(line: string): { level: 1 | 2 | 3; text: string } | null {
  const numberedHeading = line.match(/^\*\*(\d+\.\s+.+?)\*\*$/)
  if (numberedHeading) return { level: 3, text: numberedHeading[1] }

  const markdownHeading = line.match(/^\s*(#{1,3})\s+(.+?)\s*#*\s*$/)
  if (markdownHeading) {
    return {
      level: Math.min(markdownHeading[1].length, 3) as 1 | 2 | 3,
      text: markdownHeading[2],
    }
  }

  const label = line.replace(/^\*\*|\*\*$/g, '').trim().toLowerCase()
  if ([
    'three big conversations',
    'more than conversations',
    'event details',
    'come and be part of the conversation!',
  ].includes(label)) {
    return { level: 2, text: line.trim() }
  }

  if (/^[A-Z0-9\s&!?,'’–-]+$/.test(line.trim()) && /[A-Z]/.test(line)) {
    return { level: 1, text: line.trim() }
  }

  return null
}

function listItem(line: string): { type: 'ul' | 'ol'; text: string } | null {
  const ordered = line.match(/^\s*\d+[.)]\s+(.+?)\s*$/)
  if (ordered) return { type: 'ol', text: ordered[1] }

  const unordered = line.match(/^\s*[-+*]\s+(.+?)\s*$/)
  if (unordered) return { type: 'ul', text: unordered[1] }

  return null
}

function startsQuestionList(lines: string[], start: number) {
  let index = start
  while (index < lines.length && !lines[index].trim()) index++
  let questionCount = 0
  while (index < lines.length && lines[index].trim().endsWith('?')) {
    questionCount++
    index++
  }
  return questionCount > 1
}

function renderMarkdown(content: string): ReactNode[] {
  const lines = content.replace(/\r\n?/g, '\n').split('\n')
  const blocks: ReactNode[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index].trim()
    if (!line) {
      index++
      continue
    }

    const title = heading(line)
    if (title) {
      const className = title.level === 1 ? descriptionClasses.h1 : title.level === 2 ? descriptionClasses.h2 : descriptionClasses.h3
      const Tag = title.level === 1 ? 'h2' : title.level === 2 ? 'h3' : 'h4'
      blocks.push(<Tag className={className} key={`heading-${index}`}>{renderInline(title.text)}</Tag>)
      index++
      continue
    }

    const numberedSection = line.match(/^\s*(\d+\.\s+.+)$/)
    if (numberedSection && startsQuestionList(lines, index + 1)) {
      blocks.push(<h4 className={descriptionClasses.h3} key={`section-${index}`}>{numberedSection[1]}</h4>)
      index++
      continue
    }

    const firstItem = listItem(line)
    if (firstItem) {
      const items: string[] = []
      const listType = firstItem.type
      while (index < lines.length) {
        const current = lines[index].trim()
        if (!current && listItem(lines[index + 1] ?? '')?.type === listType) {
          index++
          continue
        }
        const item = listItem(current)
        if (!item || item.type !== listType) break
        items.push(item.text)
        index++
      }

      const List = listType
      const listClass = `${descriptionClasses[listType]}${listType === 'ol' && items.length === 1 ? ' font-bold text-emerald-950' : ''}`
      blocks.push(
        <List className={listClass} key={`list-${index}`}>
          {items.map((item, itemIndex) => <li className={descriptionClasses.li} key={`${index}-${itemIndex}`}>{renderInline(item)}</li>)}
        </List>,
      )
      continue
    }

    if (/^\s*(---+|___+|\*\*\*+)\s*$/.test(line)) {
      blocks.push(<hr className="my-6 border-zinc-200" key={`rule-${index}`} />)
      index++
      continue
    }

    const paragraphLines: string[] = []
    while (index < lines.length) {
      const current = lines[index].trim()
      if (!current || heading(current) || listItem(current) || /^\s*(---+|___+|\*\*\*+)\s*$/.test(current)) break
      paragraphLines.push(current)
      index++
    }

    if (paragraphLines.length > 1 && paragraphLines.every((paragraphLine) => paragraphLine.endsWith('?'))) {
      const [leadQuestion, ...listQuestions] = paragraphLines
      blocks.push(
        <p className="my-2 font-semibold italic leading-7 text-emerald-900" key={`question-lead-${index}`}>
          {renderInline(leadQuestion)}
        </p>,
        <ul className={descriptionClasses.ul} key={`question-list-${index}`}>
          {listQuestions.map((question, questionIndex) => (
            <li className={descriptionClasses.li} key={`${index}-${questionIndex}`}>{renderInline(question)}</li>
          ))}
        </ul>,
      )
      continue
    }

    blocks.push(
      <p className={descriptionClasses.p} key={`paragraph-${index}`}>
        {paragraphLines.map((paragraphLine, lineIndex) => (
          <Fragment key={lineIndex}>
            {lineIndex > 0 && <br />}
            {renderInline(paragraphLine)}
          </Fragment>
        ))}
      </p>,
    )
  }

  return blocks
}

const htmlPattern = /<\/?[a-z][\w:-]*(?:\s|\/?>)/i

const allowedStyleProperties: Record<string, keyof CSSProperties> = {
  'background': 'background',
  'background-color': 'backgroundColor',
  'border': 'border',
  'border-bottom': 'borderBottom',
  'border-left': 'borderLeft',
  'border-radius': 'borderRadius',
  'border-right': 'borderRight',
  'border-top': 'borderTop',
  'color': 'color',
  'display': 'display',
  'flex-direction': 'flexDirection',
  'font-family': 'fontFamily',
  'font-size': 'fontSize',
  'font-style': 'fontStyle',
  'font-weight': 'fontWeight',
  'gap': 'gap',
  'height': 'height',
  'justify-content': 'justifyContent',
  'letter-spacing': 'letterSpacing',
  'line-height': 'lineHeight',
  'margin': 'margin',
  'margin-bottom': 'marginBottom',
  'margin-left': 'marginLeft',
  'margin-right': 'marginRight',
  'margin-top': 'marginTop',
  'max-width': 'maxWidth',
  'padding': 'padding',
  'padding-bottom': 'paddingBottom',
  'padding-left': 'paddingLeft',
  'padding-right': 'paddingRight',
  'padding-top': 'paddingTop',
  'text-align': 'textAlign',
  'text-decoration': 'textDecoration',
  'text-transform': 'textTransform',
  'width': 'width',
}

function safeInlineStyle(node: Element): CSSProperties | undefined {
  const style: CSSProperties = {}
  const declarations = (node.attribs.style ?? '').split(';')
  const safeValuePattern = /^[#(),.%\w\s+"' -]+$/

  for (const declaration of declarations) {
    const separator = declaration.indexOf(':')
    if (separator < 0) continue

    const property = declaration.slice(0, separator).trim().toLowerCase()
    const key = allowedStyleProperties[property]
    const value = declaration.slice(separator + 1).trim()
    if (
      !key ||
      value.length > 160 ||
      !safeValuePattern.test(value) ||
      /\b(?:url|expression|javascript)\s*[\(:]/i.test(value)
    ) continue

    Object.assign(style, { [key]: value })
  }

  return Object.keys(style).length ? style : undefined
}

function safeHTML(content: string, title = false): ReactNode {
  const options: HTMLReactParserOptions = {
    replace(node) {
      if (!(node instanceof Element)) return

      const children = domToReact(node.children as DOMNode[], options)
      const style = safeInlineStyle(node)
      switch (node.name) {
        case 'div':
          return <div style={style}>{children}</div>
        case 'h1':
        case 'h2':
          return title ? <div style={style}>{children}</div> : <h2 className={descriptionClasses.h1} style={style}>{children}</h2>
        case 'h3':
        case 'h4':
        case 'h5':
        case 'h6':
          return title ? <div style={style}>{children}</div> : <h3 className={descriptionClasses.h2} style={style}>{children}</h3>
        case 'p':
          return <p className={descriptionClasses.p} style={style}>{children}</p>
        case 'ul':
          return <ul className={descriptionClasses.ul} style={style}>{children}</ul>
        case 'ol':
          return <ol className={descriptionClasses.ol} style={style}>{children}</ol>
        case 'li':
          return <li className={descriptionClasses.li} style={style}>{children}</li>
        case 'strong':
        case 'b':
          return <strong className="font-bold text-zinc-950" style={style}>{children}</strong>
        case 'em':
        case 'i':
          return <em className="italic text-zinc-800" style={style}>{children}</em>
        case 'a': {
          const href = node.attribs.href ?? ''
          if (!/^(https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i.test(href)) return <>{children}</>
          return <a className="font-semibold text-emerald-800 underline decoration-emerald-300 underline-offset-2 hover:text-emerald-950" href={href} rel="noreferrer" style={style} target="_blank">{children}</a>
        }
        case 'blockquote':
          return <blockquote className={descriptionClasses.blockquote} style={style}>{children}</blockquote>
        case 'span':
          return <span style={style}>{children}</span>
        case 'br':
          return <br />
        case 'hr':
          return <hr className="my-6 border-zinc-200" />
        case 'script':
        case 'style':
          return <></>
        default:
          return style ? <div style={style}>{children}</div> : <>{children}</>
      }
    },
  }

  return parse(content, options)
}

export function ExperienceDescription({ content, variant = 'description' }: { content: string; variant?: 'description' | 'summary' | 'title' }) {
  if (!content.trim()) return null

  const isHTML = htmlPattern.test(content)
  const renderedContent = isHTML ? safeHTML(content, variant === 'title') : renderMarkdown(content)
  if (variant === 'title') {
    if (!isHTML && !/^\\s*#{1,6}\\s/.test(content)) {
      return <h1 className="mt-3 text-3xl font-bold tracking-tight text-zinc-950 sm:text-4xl">{content}</h1>
    }
    return (
      <div aria-level={1} className="mt-3 text-3xl font-bold tracking-tight text-zinc-950 sm:text-4xl" role="heading">
        {renderedContent}
      </div>
    )
  }
  if (variant === 'summary') {
    return <div className="mt-2 text-base text-zinc-600">{renderedContent}</div>
  }

  return (
    <article className="mt-7 rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/70 via-white to-amber-50/50 p-5 text-sm leading-7 text-zinc-700 shadow-sm sm:p-8 sm:text-base">
      {renderedContent}
    </article>
  )
}
