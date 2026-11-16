import type {
  OpenPermissionsInspectorOptions,
  PermissionsInspectorController,
} from './permissions-inspector-types'

/**
 * Singleton for opening the permissions inspector outside React trees.
 */
class PermissionsInspectorManager implements PermissionsInspectorController {
  private controller: PermissionsInspectorController | null = null

  setController(controller: PermissionsInspectorController | null) {
    this.controller = controller
  }

  open(options?: OpenPermissionsInspectorOptions) {
    if (!this.controller) {
      if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
        console.warn(
          'PermissionsInspectorProvider not mounted. Add <PermissionsInspectorProvider> to AppProviders.'
        )
      }
      return
    }
    this.controller.open(options)
  }

  close() {
    this.controller?.close()
  }

  isOpen() {
    return this.controller?.isOpen() ?? false
  }
}

export const permissionsInspector = new PermissionsInspectorManager()
