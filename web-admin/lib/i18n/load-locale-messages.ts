import 'server-only'

import fs from 'node:fs/promises'
import path from 'node:path'

import type { AbstractIntlMessages } from 'next-intl'

const SUPPORTED_LOCALES = ['en', 'ar'] as const
const DEFAULT_LOCALE = 'en'
const INDEX_FILE_NAME = 'index'

type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]
type MessageNode = Record<string, unknown>
type LocaleCatalogLocation = {
  localeDirectory: string
  legacyLocaleFile: string
  messagesRoot: string
}

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
    const nextNamespaceSegments =
      fileNamespace === INDEX_FILE_NAME
        ? namespaceSegments
        : [...namespaceSegments, fileNamespace]
    const fileMessages = await loadJsonFile(entryPath)
    const namespacedMessages =
      nextNamespaceSegments.length > 0
        ? wrapInNamespace(nextNamespaceSegments, fileMessages)
        : fileMessages

    messages = mergeMessageTrees(messages, namespacedMessages)
  }

  return messages
}

function collectAncestorDirectories(startDirectory: string): string[] {
  const directories: string[] = []
  let currentDirectory = path.resolve(startDirectory)

  while (true) {
    directories.push(currentDirectory)
    const parentDirectory = path.dirname(currentDirectory)

    if (parentDirectory === currentDirectory) {
      break
    }

    currentDirectory = parentDirectory
  }

  return directories
}

function getRuntimeSeedDirectories(): string[] {
  const mainModulePath =
    typeof require !== 'undefined' && require.main?.filename
      ? path.dirname(require.main.filename)
      : ''
  const processArgvPath = process.argv[1] ? path.dirname(process.argv[1]) : ''

  return [process.cwd(), __dirname, mainModulePath, processArgvPath].filter(Boolean)
}

function getLocaleCatalogCandidates(locale: SupportedLocale): LocaleCatalogLocation[] {
  const seenRoots = new Set<string>()
  const candidates: LocaleCatalogLocation[] = []

  for (const seedDirectory of getRuntimeSeedDirectories()) {
    for (const ancestorDirectory of collectAncestorDirectories(seedDirectory)) {
      for (const messagesRoot of [
        path.join(ancestorDirectory, 'messages'),
        path.join(ancestorDirectory, 'web-admin', 'messages'),
      ]) {
        const normalizedRoot = path.normalize(messagesRoot)
        if (seenRoots.has(normalizedRoot)) {
          continue
        }

        seenRoots.add(normalizedRoot)
        candidates.push({
          messagesRoot: normalizedRoot,
          localeDirectory: path.join(normalizedRoot, locale),
          legacyLocaleFile: path.join(normalizedRoot, `${locale}.json`),
        })
      }
    }
  }

  return candidates
}

export async function loadLocaleMessages(locale: string): Promise<AbstractIntlMessages> {
  const safeLocale = isSupportedLocale(locale) ? locale : DEFAULT_LOCALE
  const candidates = getLocaleCatalogCandidates(safeLocale)

  for (const candidate of candidates) {
    if (await pathExists(candidate.localeDirectory)) {
      return (await loadDirectoryMessages(candidate.localeDirectory)) as AbstractIntlMessages
    }

    if (await pathExists(candidate.legacyLocaleFile)) {
      return (await loadJsonFile(candidate.legacyLocaleFile)) as AbstractIntlMessages
    }
  }

  throw new Error(
    `No locale catalog found for locale "${safeLocale}". Checked: ${candidates
      .map((candidate) => candidate.messagesRoot)
      .join(', ')}`
  )
}
