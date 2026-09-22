import { expect, test } from '@playwright/test'

test('recorded protocol visit governs later subject readiness', async ({ page }) => {
  await page.goto('/studies/TF-201/subjects/S-014/readiness')
  await expect(page.getByRole('button', { name: 'Authorize next visit' })).toBeDisabled()
  await page.goto('/studies/TF-201/subjects/S-014/timeline')
  await page.getByRole('button', { name: 'Record visit' }).click()
  await page.goto('/studies/TF-201/subjects/S-014/readiness')
  await expect(page.getByText('Visit 6: 2026-09-14', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Authorize next visit' }).click()
  await expect(page.getByText('Next visit authorized')).toBeVisible()
  await page.goto('/studies/TF-201/subjects/S-014/timeline')
  await page.getByRole('button', { name: 'Reopen Visit 6' }).click()
  await expect(page.getByRole('status')).toContainText('depends on Visit 6')
})
