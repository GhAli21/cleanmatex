import 'server-only'

import fs from 'node:fs/promises'
import path from 'node:path'

import type { AbstractIntlMessages } from 'next-intl'

const SUPPORTED_LOCALES = ['en', 'ar'] as const
const DEFAULT_LOCALE = 'en'

type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]
type MessageNode = Record<string, unknown>

function isPlainObject(value: unknown): value is MessageNode {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isSupportedLocale(locale: string): locale is SupportedLocale {
  return SUPPORTED_LOCALES.includes(locale as SupportedLocale)
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

async function loadJsonFile(filePath: string): Promise<MessageNode> {
  const fileContents = await fs.readFile(filePath, 'utf8')
  const parsed = JSON.parse(fileContents) as unknown

  if (!isPlainObject(parsed)) {
    throw new Error(`Locale file must contain a JSON object: ${filePath}`)
  }

  return parsed
}

function mergeMessageTrees(target: MessageNode, source: MessageNode): MessageNode {
  const merged: MessageNode = { ...target }

  for (const [key, value] of Object.entries(source)) {
    const existingValue = merged[key]

    if (isPlainObject(existingValue) && isPlainObject(value)) {
      merged[key] = mergeMessageTrees(existingValue, value)
      continue
    }

    merged[key] = value
  }

  return merged
}

function wrapInNamespace(namespaceSegments: string[], value: MessageNode): MessageNode {
  return namespaceSegments.reduceRight<MessageNode>(
    (accumulator, segment) => ({ [segment]: accumulator }),
    value
  )
}

async function loadDirectoryMessages(
  directoryPath: string,
  namespaceSegments: string[] = []
): Promise<MessageNode> {
  const entries = await fs.readdir(directoryPath, { withFileTypes: true })
  const sortedEntries = [...entries].sort((left, right) => left.name.localeCompare(right.name))

  let messages: MessageNode = {}

  for (const entry of sortedEntries) {
    const entryPath = path.join(directoryPath, entry.name)

    if (entry.isDirectory()) {
      const nestedMessages = await loadDirectoryMessages(entryPath, [
        ...namespaceSegments,
        entry.name,
      ])
      messages = mergeMessageTrees(messages, nestedMessages)
      continue
    }

    if (!entry.isFile() || !entry.name.endsWith('.json')) {
      continue
    }

    const fileNamespace = entry.name.replace(/\.json$/u, '')
    const fileMessages = await loadJsonFile(entryPath)
    const namespacedMessages = wrapInNamespace(
      [...namespaceSegments, fileNamespace],
      fileMessages
    )

    messages = mergeMessageTrees(messages, namespacedMessages)
  }

  return messages
}

export async function loadLocaleMessages(locale: string): Promise<AbstractIntlMessages> {
  const safeLocale = isSupportedLocale(locale) ? locale : DEFAULT_LOCALE
  const messagesRoot = path.join(process.cwd(), 'messages')
  const localeDirectory = path.join(messagesRoot, safeLocale)
  const legacyLocaleFile = path.join(messagesRoot, `${safeLocale}.json`)

  if (await pathExists(localeDirectory)) {
    return (await loadDirectoryMessages(localeDirectory)) as AbstractIntlMessages
  }

  if (await pathExists(legacyLocaleFile)) {
    return (await loadJsonFile(legacyLocaleFile)) as AbstractIntlMessages
  }

  throw new Error(`No locale catalog found for locale "${safeLocale}"`)
}
