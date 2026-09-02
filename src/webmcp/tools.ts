import type {
  BookRange,
  MutationReceipt,
  ReaderStyle,
  StudyItem,
  StudyItemPayload,
} from '../domain/index.ts'
import { ANNOTATION_COLORS, STUDY_ITEM_KINDS } from '../domain/study.ts'
import type { BookhandCommands } from '../app/commands.ts'
import type { StudyBoardSnapshot } from '../app/commands.ts'
import type { StylePatch } from '../app/presentation.ts'
import {
  errorResult,
  quoteBookContent,
  textResult,
  type ToolDefinition,
  type ToolResult,
} from './model-context.ts'

export interface ToolCallRecord {
  readonly id: string
  readonly name: string
  readonly summary: string
  readonly at: string
  readonly failed?: boolean
}

export interface ToolHostOptions {
  readonly commands: BookhandCommands
  /** Every call is reported so the person can see what the agent did. */
  readonly onCall: (record: Omit<ToolCallRecord, 'id' | 'at'>) => void
}

const BOOK_ID_SCHEMA = {
  type: 'string',
  description:
    'The id of the book you are reading, from get_reading_context. Checked against the open book: a mutation naming a different book is rejected.',
} as const

const ACTION_GROUP_SCHEMA = {
  type: 'string',
  description:
    'Group the writes of one intent under a shared id so the person can undo them together.',
} as const

/** Every tool call is an agent acting; the interface is how a person acts. */
function caller(input: Record<string, unknown>) {
  return {
    origin: 'agent' as const,
    ...(typeof input.actionGroupId === 'string' ? { actionGroupId: input.actionGroupId } : {}),
  }
}

const RANGE_SCHEMA = {
  type: 'object',
  description: 'An exact source range previously returned by another Bookhand tool.',
  properties: {
    startCfi: { type: 'string' },
    endCfi: { type: 'string' },
    cfi: { type: 'string', description: 'The single range CFI spanning start to end.' },
    sectionIndex: { type: 'integer', minimum: 0 },
    textFingerprint: { type: 'string' },
  },
  required: ['startCfi', 'endCfi', 'sectionIndex', 'textFingerprint'],
} as const

/**
 * State the receipt back to the agent in the terms it needs to act on next.
 *
 * The update token is the only part that must be reported precisely, because
 * nothing will hand it over again. The reversal actions are named exactly as
 * the interface names them, so an agent describing what it did to the person
 * describes something the person can actually find on screen.
 */
function describeReceipt(receipt: MutationReceipt<StudyItem>): string {
  const lines = [
    `${receipt.operation === 'create' ? 'Added' : 'Revised'} ${receipt.applied.payload.kind} block ${receipt.applied.id} (revision ${receipt.applied.revision}).`,
    `Scope: ${receipt.scope}`,
    `Attributed to: ${receipt.origin}. Action group: ${receipt.actionGroupId}.`,
  ]
  if (receipt.updateToken) {
    lines.push(
      `updateToken: ${receipt.updateToken} — keep this; it is shown once and is the only way you can revise this block later.`,
    )
  }
  if (receipt.warnings.length > 0) lines.push(`Warnings: ${receipt.warnings.join(' ')}`)
  lines.push(
    `The person can: ${receipt.actions.map((action) => `${action.label} (${action.description})`).join(' ')}`,
  )
  return lines.join('\n')
}

/**
 * A style receipt in words. It states what it replaced, whether the change
 * survives a reload, and the reversals the person can actually see — so an
 * agent can describe what it did without guessing, and can put it back.
 */
function describeStyleReceipt(receipt: MutationReceipt<ReaderStyle>, verb: string): string {
  const lines = [
    `${verb}. Action group: ${receipt.actionGroupId}. Attributed to: ${receipt.origin}.`,
    `Scope: ${receipt.scope}`,
    `Was: ${summarizeStyle(receipt.prior)}`,
    `Now: ${summarizeStyle(receipt.applied)}`,
    receipt.persisted
      ? 'Saved, so it survives a reload.'
      : 'Showing now, but not saved — it will not survive a reload.',
  ]
  if (receipt.warnings.length > 0) lines.push(`Warnings: ${receipt.warnings.join(' ')}`)
  lines.push(
    `The person can: ${receipt.actions.map((action) => `${action.label} (${action.description})`).join(' ')}`,
  )
  return lines.join('\n')
}

function describeBoardReceipt(receipt: MutationReceipt<StudyBoardSnapshot>): string {
  const lines = [
    `The study board is ${receipt.applied.open ? 'on screen' : 'closed'}, laid out ${receipt.applied.view}.`,
    `Was: ${receipt.prior?.open ? 'on screen' : 'closed'}, laid out ${receipt.prior?.view}.`,
    `Scope: ${receipt.scope}`,
    receipt.persisted
      ? 'The layout preference was saved.'
      : 'The layout preference was not changed, so nothing was saved.',
    `Action group: ${receipt.actionGroupId}. Attributed to: ${receipt.origin}.`,
    `The person can: ${receipt.actions.map((action) => `${action.label} (${action.description})`).join(' ')}`,
  ]
  return lines.join('\n')
}

function summarizeStyle(style: ReaderStyle | undefined): string {
  if (!style) return 'unknown'
  return [
    `theme ${style.theme}`,
    `size ${style.fontSizePercent}%`,
    `line height ${style.lineHeight}`,
    `measure ${style.measureCh}ch`,
    `paragraph spacing ${style.paragraphSpacingEm}em`,
    style.customCss ? `${style.customCss.length} characters of book CSS` : 'no book CSS',
  ].join(', ')
}

function asRange(value: unknown): BookRange {
  const record = value as Record<string, unknown>
  if (
    typeof record?.startCfi !== 'string' ||
    typeof record?.endCfi !== 'string' ||
    typeof record?.textFingerprint !== 'string' ||
    !Number.isInteger(record?.sectionIndex)
  ) {
    throw new Error('range must come from a Bookhand tool result, unchanged')
  }
  return {
    startCfi: record.startCfi,
    endCfi: record.endCfi,
    ...(typeof record.cfi === 'string' ? { cfi: record.cfi } : {}),
    sectionIndex: record.sectionIndex as number,
    textFingerprint: record.textFingerprint,
  }
}

function describeRange(range: BookRange): string {
  return `section ${range.sectionIndex}, range ${range.cfi ?? range.startCfi}`
}

export function createBookhandTools(options: ToolHostOptions): readonly ToolDefinition[] {
  const { commands, onCall } = options

  const run = async (
    name: string,
    summary: (result: unknown) => string,
    body: () => Promise<ToolResult>,
  ): Promise<ToolResult> => {
    try {
      const result = await body()
      onCall({ name, summary: summary(result) })
      return result
    } catch (error) {
      // Every refusal this product raises already carries the wording meant for
      // a person, including the ones that came back from the storage worker,
      // where the error class does not survive. The agent gets that same
      // wording, because it will repeat what it is told and what it repeats
      // should be something the person can act on.
      const message = error instanceof Error ? error.message : 'That did not work'
      onCall({ name, summary: message, failed: true })
      return errorResult(message)
    }
  }

  return [
    {
      name: 'get_reading_context',
      description:
        'Read where the person is in the book right now: the book and chapter, how far through they are, the passage currently visible, and their current text selection if any. Call this first to ground any help you give.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      execute: () =>
        run('get_reading_context', () => 'read the current page', async () => {
          const context = await commands.getReadingContext()
          const lines = [
            `Book: ${context.title}`,
            // Every source-linked mutation has to name the book. Saying it here
            // means an agent that grounded itself already has what it needs,
            // instead of having to go back to list_books for an id it was never
            // told.
            `Book id: ${context.bookId}`,
            `Chapter: ${context.chapterLabel ?? 'unknown'}`,
            `Section index: ${context.sectionIndex}`,
            `Progress: ${context.progressPercent}%`,
            '',
            quoteBookContent('Visible passage', context.visible.text),
            '',
            `Visible range: ${JSON.stringify(context.visible.range)}`,
          ]
          if (context.selection) {
            lines.push(
              '',
              quoteBookContent('Selected passage', context.selection.quote),
              '',
              `Selected range: ${JSON.stringify(context.selection.range)}`,
            )
          }
          return textResult(lines.join('\n'))
        }),
    },
    {
      name: 'get_table_of_contents',
      description:
        'List the book’s chapters and sections with the targets needed to navigate to them.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      execute: () =>
        run('get_table_of_contents', () => 'listed the contents', async () => {
          const flatten = (items: readonly { label: string; target: unknown; children: readonly unknown[] }[], depth = 0): string[] =>
            items.flatMap((item) => [
              `${'  '.repeat(depth)}- ${item.label} → ${JSON.stringify(item.target)}`,
              ...flatten(
                item.children as readonly { label: string; target: unknown; children: readonly unknown[] }[],
                depth + 1,
              ),
            ])
          const toc = commands.getTableOfContents()
          if (toc.length === 0) return textResult('This book has no table of contents.')
          return textResult(
            quoteBookContent('Table of contents', flatten(toc as never).join('\n')),
          )
        }),
    },
    {
      name: 'get_passage',
      description:
        'Re-read the exact text at a source range returned earlier. Use this to quote the book accurately instead of relying on memory.',
      inputSchema: {
        type: 'object',
        properties: { range: RANGE_SCHEMA },
        required: ['range'],
        additionalProperties: false,
      },
      execute: (input) =>
        run('get_passage', () => 'looked up a passage', async () => {
          const passage = await commands.getPassage(asRange(input.range))
          return textResult(
            [
              quoteBookContent('Passage', passage.text),
              '',
              `Breadcrumb: ${passage.chapterBreadcrumb.join(' › ')}`,
              `Range: ${JSON.stringify(passage.range)}`,
            ].join('\n'),
          )
        }),
    },
    {
      name: 'navigate_book',
      description:
        'Move the reader to a place in the book: an exact range CFI, a table-of-contents href, a section index, or the previous/next page. The person sees the book move.',
      inputSchema: {
        type: 'object',
        oneOf: [
          { required: ['cfi'] },
          { required: ['href'] },
          { required: ['sectionIndex'] },
          { required: ['direction'] },
        ],
        properties: {
          cfi: { type: 'string', description: 'An exact CFI from a previous tool result.' },
          href: { type: 'string', description: 'A table-of-contents href.' },
          sectionIndex: { type: 'integer', minimum: 0 },
          direction: { type: 'string', enum: ['previous', 'next'] },
        },
        additionalProperties: false,
      },
      execute: (input) =>
        run('navigate_book', () => 'moved the reader', async () => {
          const target =
            typeof input.cfi === 'string'
              ? ({ kind: 'cfi', cfi: input.cfi } as const)
              : typeof input.href === 'string'
                ? ({ kind: 'href', href: input.href } as const)
                : Number.isInteger(input.sectionIndex)
                  ? ({ kind: 'section', sectionIndex: input.sectionIndex as number } as const)
                  : ({
                      kind: 'relative',
                      direction: input.direction === 'previous' ? 'previous' : 'next',
                    } as const)
          const context = await commands.navigateBook(target)
          return textResult(
            `Now at ${context.chapterLabel ?? `section ${context.sectionIndex}`} (${context.progressPercent}%).`,
          )
        }),
    },
    {
      name: 'save_annotation',
      description:
        'Highlight a passage in the book and optionally attach a note. The highlight appears in the book and in the study board, and belongs to the person.',
      inputSchema: {
        type: 'object',
        properties: {
          bookId: BOOK_ID_SCHEMA,
          range: RANGE_SCHEMA,
          quote: {
            type: 'string',
            maxLength: 20_000,
            description:
              'The exact text being highlighted, as returned by a Bookhand tool. It is compared against the text the range resolves to; only whitespace differences are forgiven.',
          },
          color: { type: 'string', enum: [...ANNOTATION_COLORS] },
          note: { type: 'string', maxLength: 20_000 },
        },
        required: ['bookId', 'range', 'quote'],
        additionalProperties: false,
      },
      execute: (input) =>
        run('save_annotation', () => 'highlighted a passage', async () => {
          const range = asRange(input.range)
          const saved = await commands.saveAnnotation({
            bookId: String(input.bookId ?? ''),
            range,
            quote: String(input.quote ?? ''),
            ...(typeof input.color === 'string'
              ? { color: input.color as (typeof ANNOTATION_COLORS)[number] }
              : {}),
            ...(typeof input.note === 'string' ? { note: input.note } : {}),
          })
          return textResult(`Highlighted ${describeRange(range)} as ${saved.id}.`)
        }),
    },
    {
      name: 'set_reading_style',
      description:
        'Change how the book is presented: text size, line height, measure, paragraph spacing, theme, or custom book CSS. Send only the fields you mean to change — anything you restate would overwrite a change the person made a moment ago. Every change is reversible by the person with one action. Picking a shipped theme or adjusting size needs nothing else; custom CSS additionally requires designContextVersion from get_design_context, which explains the semantic roles, contrast floors, and what this CSS can and cannot reach.',
      inputSchema: {
        type: 'object',
        properties: {
          fontSizePercent: { type: 'number', minimum: 70, maximum: 200 },
          lineHeight: { type: 'number', minimum: 1.1, maximum: 2.2 },
          measureCh: { type: 'number', minimum: 40, maximum: 110 },
          paragraphSpacingEm: { type: 'number', minimum: 0, maximum: 2 },
          theme: { type: 'string', enum: ['publisher', 'light', 'sepia', 'dark'] },
          customCss: {
            type: 'string',
            maxLength: 20_000,
            description:
              'CSS applied inside the EPUB document only; it cannot style the library, reader chrome, panels, or Study. Requires designContextVersion.',
          },
          designContextVersion: {
            type: 'string',
            description:
              'The guidance version get_design_context returned. Required with customCss, ignored otherwise.',
          },
          reset: { type: 'boolean', description: 'Restore every presentation default.' },
          undo: {
            type: 'boolean',
            description: 'Put back the presentation as it was before the last change.',
          },
          actionGroupId: ACTION_GROUP_SCHEMA,
        },
        additionalProperties: false,
        dependentRequired: { customCss: ['designContextVersion'] },
      },
      execute: (input) =>
        run('set_reading_style', () => 'changed the presentation', async () => {
          if (input.undo === true) {
            const undone = await commands.undoReadingStyle()
            if (!undone) return textResult('There is no presentation change to undo.')
            return textResult(describeStyleReceipt(undone, 'Put the presentation back'))
          }
          if (input.reset === true) {
            const receipt = await commands.resetReadingStyle(caller(input))
            return textResult(describeStyleReceipt(receipt, 'Restored the default presentation'))
          }
          // Only what was named. Merging over a style read a moment ago would
          // carry that snapshot back over anything changed in between.
          const patch: StylePatch = {
            ...(typeof input.fontSizePercent === 'number'
              ? { fontSizePercent: input.fontSizePercent }
              : {}),
            ...(typeof input.lineHeight === 'number' ? { lineHeight: input.lineHeight } : {}),
            ...(typeof input.measureCh === 'number' ? { measureCh: input.measureCh } : {}),
            ...(typeof input.paragraphSpacingEm === 'number'
              ? { paragraphSpacingEm: input.paragraphSpacingEm }
              : {}),
            ...(typeof input.theme === 'string'
              ? { theme: input.theme as ReaderStyle['theme'] }
              : {}),
            ...(typeof input.customCss === 'string' ? { customCss: input.customCss } : {}),
          }
          if (Object.keys(patch).length === 0) {
            return textResult('Nothing to change: name at least one presentation field.')
          }
          const receipt = await commands.setReadingStyle({
            patch,
            ...caller(input),
            ...(typeof input.designContextVersion === 'string'
              ? { designContextVersion: input.designContextVersion }
              : {}),
          })
          return textResult(describeStyleReceipt(receipt, 'Updated the presentation'))
        }),
    },
    {
      name: 'upsert_study_item',
      description:
        'Put a study block on this book’s board, or update one you created. Blocks are prose, quotation, equation, steps, or question. Attach the source range so the person can jump back to where it came from. One ordinary block needs nothing else; before composing several blocks into one piece of teaching, call get_design_context for the composition hierarchy this board expects.',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description:
              'Revise an existing block instead of adding one. You may only revise blocks you created, and must supply the updateToken you were given when you created it.',
          },
          updateToken: {
            type: 'string',
            description: 'The token returned when you created this block. Required to revise it.',
          },
          actionToken: {
            type: 'string',
            description:
              'Your own name for this action. Retrying with the same token and the same content returns the first result instead of writing twice.',
          },
          actionGroupId: {
            type: 'string',
            description:
              'Group the blocks of one lesson under a shared id so the person can undo them together.',
          },
          kind: { type: 'string', enum: [...STUDY_ITEM_KINDS] },
          text: { type: 'string', maxLength: 20_000, description: 'Prose or quotation body.' },
          attribution: { type: 'string', maxLength: 500 },
          expression: { type: 'string', maxLength: 5_000, description: 'Equation body.' },
          caption: { type: 'string', maxLength: 500 },
          title: { type: 'string', maxLength: 500, description: 'Title for a steps block.' },
          steps: { type: 'array', maxItems: 100, items: { type: 'string', maxLength: 5_000 } },
          prompt: { type: 'string', maxLength: 20_000, description: 'Question body.' },
          answer: { type: 'string', maxLength: 20_000 },
          bookId: BOOK_ID_SCHEMA,
          sourceRange: RANGE_SCHEMA,
          sourceQuote: {
            type: 'string',
            maxLength: 20_000,
            description:
              'The exact text sourceRange covers. Required with sourceRange, and checked against the book, so a block can never cite words the book does not contain.',
          },
          sourceLabel: { type: 'string', maxLength: 500 },
        },
        required: ['kind'],
        dependentRequired: { sourceRange: ['bookId', 'sourceQuote'] },
        additionalProperties: false,
      },
      execute: (input) =>
        run('upsert_study_item', () => 'added to the study board', async () => {
          const payload = toPayload(input)
          const receipt = await commands.upsertStudyItem({
            payload,
            origin: 'agent',
            ...(typeof input.id === 'string' ? { id: input.id } : {}),
            ...(typeof input.updateToken === 'string' ? { updateToken: input.updateToken } : {}),
            ...(typeof input.actionToken === 'string' ? { actionToken: input.actionToken } : {}),
            ...(typeof input.actionGroupId === 'string'
              ? { actionGroupId: input.actionGroupId }
              : {}),
            ...(input.sourceRange
              ? {
                  bookId: String(input.bookId ?? ''),
                  sourceRange: asRange(input.sourceRange),
                  sourceQuote: String(input.sourceQuote ?? ''),
                }
              : {}),
            ...(typeof input.sourceLabel === 'string' ? { sourceLabel: input.sourceLabel } : {}),
          })
          return textResult(describeReceipt(receipt))
        }),
    },
    {
      name: 'list_study_items',
      description: 'Read what is already on this book’s study board, so you can build on it rather than repeat it.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      execute: () =>
        run('list_study_items', () => 'read the study board', async () => {
          const items = await commands.listStudyItems()
          if (items.length === 0) return textResult('The study board is empty.')
          return textResult(
            items
              .map((item) => `${item.id} · ${item.payload.kind} · ${JSON.stringify(item.payload)}`)
              .join('\n'),
          )
        }),
    },
    {
      name: 'set_study_board_view',
      description:
        'Change what the study board is doing. "docked" and "expanded" are layout preferences the person keeps; "focus" brings the board forward and moves focus to it without changing their preference; "close" returns to the book without deleting anything. Prefer focus when you only want the person to look at what you added.',
      inputSchema: {
        type: 'object',
        properties: {
          view: {
            type: 'string',
            enum: ['docked', 'expanded', 'focus', 'close'],
            description:
              'docked | expanded change the stored layout. focus | close change only what is on screen now.',
          },
          undo: {
            type: 'boolean',
            description: 'Put the layout back the way it was before your last change to it.',
          },
          actionGroupId: ACTION_GROUP_SCHEMA,
        },
        additionalProperties: false,
      },
      execute: (input) =>
        run('set_study_board_view', () => 'changed the board layout', async () => {
          if (input.undo === true) {
            const undone = await commands.undoStudyBoardView()
            if (!undone) return textResult('There is no board layout change to undo.')
            return textResult(describeBoardReceipt(undone))
          }
          const view = input.view
          if (view !== 'docked' && view !== 'expanded' && view !== 'focus' && view !== 'close') {
            return textResult('Choose one of: docked, expanded, focus, close.')
          }
          const receipt = await commands.setStudyBoardView(view, caller(input))
          return textResult(describeBoardReceipt(receipt))
        }),
    },
  ]
}

function toPayload(input: Record<string, unknown>): StudyItemPayload {
  const text = typeof input.text === 'string' ? input.text : ''
  switch (input.kind) {
    case 'prose':
      return { kind: 'prose', text }
    case 'quotation':
      return {
        kind: 'quotation',
        text,
        ...(typeof input.attribution === 'string' ? { attribution: input.attribution } : {}),
      }
    case 'equation':
      return {
        kind: 'equation',
        expression: typeof input.expression === 'string' ? input.expression : text,
        ...(typeof input.caption === 'string' ? { caption: input.caption } : {}),
      }
    case 'steps':
      return {
        kind: 'steps',
        ...(typeof input.title === 'string' ? { title: input.title } : {}),
        steps: Array.isArray(input.steps)
          ? input.steps.filter((step): step is string => typeof step === 'string')
          : text
            ? text.split('\n').filter(Boolean)
            : [],
      }
    case 'question':
      return {
        kind: 'question',
        prompt: typeof input.prompt === 'string' ? input.prompt : text,
        ...(typeof input.answer === 'string' ? { answer: input.answer } : {}),
      }
    default:
      throw new Error(`kind must be one of ${STUDY_ITEM_KINDS.join(', ')}`)
  }
}
