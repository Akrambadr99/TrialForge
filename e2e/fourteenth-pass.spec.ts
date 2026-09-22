import { expect, test } from '@playwright/test'

test('subject review and study amendment remain scoped across navigation', async ({ page }) => {
  await page.goto('/trial/subject-workspace?subject=S-015')
  await expect(page.getByLabel('Medical review queue')).toContainText('S-015')
  await page.getByRole('button', { name: 'Claim selected medical review' }).click()
  await expect(page.getByRole('status')).toContainText('claimed')
  await page.goto('/operations')
  await page.goto('/trial/subject-workspace?subject=S-015')
  await expect(page.getByLabel('Selected subject')).toContainText('med-elaine')
  await page.getByRole('button', { name: 'Amend linked study protocol' }).click()
  await expect(page.getByRole('status')).toContainText('related subjects amended')
  await expect(page.getByLabel('Selected subject')).toContainText('protocol v6')
  await page.reload()
  await expect(page.getByLabel('Selected subject')).toContainText('protocol v6')
  await page.getByLabel('Subject collection').getByRole('button', { name: /S-301/ }).click()
  await expect(page.getByLabel('Selected subject')).toContainText('protocol v5')
})
