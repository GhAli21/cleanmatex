/**
 * Light/dark, density and text size live only on the Appearance page
 * (sys_users_mst.ui_*). The old settings-engine keys user.theme / user.density
 * were shown on User Preferences but nothing read them (PR-07 task 6 follow-up).
 */
import fs from 'node:fs'
import path from 'node:path'

test('User Preferences has no second theme or density control and links to Appearance', () => {
  const page = fs.readFileSync(path.join(__dirname, '../../../app/dashboard/settings/preferences/page.tsx'), 'utf8')
  expect(page).not.toMatch(/user\.theme|user\.density/)
  expect(page).toContain("href=\"/dashboard/account/appearance\"")
})
