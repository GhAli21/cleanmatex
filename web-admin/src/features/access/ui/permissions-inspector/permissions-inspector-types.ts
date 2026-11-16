export type PermissionsInspectorTab = 'ui' | 'api' | 'flags' | 'all'

export interface OpenPermissionsInspectorOptions {
  /** Initial tab when the panel opens. */
  tab?: PermissionsInspectorTab
  /** Override route path for contract resolution (defaults to current pathname). */
  routePath?: string
}

export interface PermissionsInspectorController {
  open: (options?: OpenPermissionsInspectorOptions) => void
  close: () => void
  isOpen: () => boolean
}
